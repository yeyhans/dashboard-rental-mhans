import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryError, UNIT_ERRORS } from "../../lib/inventoryUnits";
import { allCallArgs, callArgs, sharedDouble as db } from "./supabaseDouble";

vi.mock("../../lib/supabase", async () => {
  const { sharedDouble } = await import("./supabaseDouble");
  return { supabaseAdmin: sharedDouble.client };
});

const { SerialisedAssetService, SERIAL_ERROR, VALUATION_ERRORS } = await import(
  "../serialisedAssetService"
);

const unitRow = {
  id: 5,
  product_id: 42,
  asset_tag: "MH-00005",
  serial_number: "SN-5",
  condition: "operational",
  wear: "used",
  location: "N-E1 · Estante 1",
  location_id: "loc-1",
  kit_code: null,
  notes: null,
  acquisition_cost: 900000,
  purchase_date: "2026-01-15",
  market_price: 750000,
  row_version: 5,
  created_at: "2026-10-14T00:00:00Z",
  updated_at: "2026-10-14T00:00:00Z",
};

async function expectInventoryError(
  promise: Promise<unknown>,
  status: number,
  message: string,
) {
  try {
    await promise;
    expect.unreachable("expected an InventoryError");
  } catch (error) {
    expect(error).toBeInstanceOf(InventoryError);
    expect((error as InventoryError).status).toBe(status);
    expect((error as InventoryError).message).toBe(message);
  }
}

afterEach(() => {
  db.reset();
  vi.restoreAllMocks();
});

describe("SerialisedAssetService.createUnit", () => {
  it("writes the unit, its serial and its valuation in one insert, with no follow-up update", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    db.queue("products", { data: { id: 42 }, error: null });
    db.queue(
      "serialised_assets",
      { data: null, error: null },
      { data: [], error: null },
      { data: [], error: null },
      { data: [{ ...unitRow, row_version: 1 }], error: null },
    );

    const unit = await SerialisedAssetService.createUnit({
      product_id: 42,
      location: "Estante 1",
      serial_number: "SN-REAL",
      acquisition_cost: 900000,
    });

    const builders = db.buildersFor("serialised_assets");
    const insertBuilder = builders.find(
      (b) => callArgs(b, "insert") !== undefined,
    );
    const [insert] = callArgs(insertBuilder!, "insert");
    expect(insert[0]).toMatchObject({
      serial_number: "SN-REAL",
      acquisition_cost: 900000,
    });
    expect(builders.some((b) => callArgs(b, "update") !== undefined)).toBe(
      false,
    );
    expect(unit.row_version).toBe(1);
  });

  it("rejects amounts beyond the numeric(12,2) column or with sub-cent precision", async () => {
    await expectInventoryError(
      SerialisedAssetService.createUnit({
        product_id: 42,
        location: "x",
        market_price: 1e10,
      }),
      400,
      VALUATION_ERRORS.MARKET_PRICE,
    );
    await expectInventoryError(
      SerialisedAssetService.createUnit({
        product_id: 42,
        location: "x",
        acquisition_cost: 0.001,
      }),
      400,
      VALUATION_ERRORS.ACQUISITION_COST,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("judges 'future' by the Chile calendar date, not the UTC date", async () => {
    vi.useFakeTimers();
    try {
      // 2026-10-27 02:30 UTC is still 2026-10-26 in Santiago (UTC-3 in October).
      vi.setSystemTime(new Date("2026-10-27T02:30:00Z"));
      await expectInventoryError(
        SerialisedAssetService.updateAsset(
          5,
          { purchase_date: "2026-10-27" },
          4,
        ),
        400,
        VALUATION_ERRORS.PURCHASE_DATE_FUTURE,
      );
    } finally {
      vi.useRealTimers();
    }
  });

  it("rejects purchase dates before 1900 (Postgres year 0000 is not a date)", async () => {
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { purchase_date: "0000-01-01" }, 4),
      400,
      VALUATION_ERRORS.PURCHASE_DATE,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects an invalid valuation before any write", async () => {
    await expectInventoryError(
      SerialisedAssetService.createUnit({
        product_id: 42,
        location: "x",
        market_price: -1,
      }),
      400,
      VALUATION_ERRORS.MARKET_PRICE,
    );
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("SerialisedAssetService review hardening", () => {
  it("rejects an empty or whitespace-only serial before any write", async () => {
    await expectInventoryError(
      SerialisedAssetService.createUnit({
        product_id: 42,
        location: "x",
        serial_number: "   ",
      }),
      400,
      SERIAL_ERROR,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects a serial that is not text before any write", async () => {
    await expectInventoryError(
      SerialisedAssetService.createUnit({
        product_id: 42,
        location: "x",
        serial_number: 123 as unknown as string,
      }),
      400,
      SERIAL_ERROR,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("validates a caller serial on the bulk path before any write", async () => {
    await expectInventoryError(
      SerialisedAssetService.bulkCreateAssets(42, 1, {
        location: "x",
        serial_number: "   ",
      }),
      400,
      SERIAL_ERROR,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("checks the caller's own serial for duplicates, not only the generated ones", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    db.queue("products", { data: { id: 42 }, error: null });
    db.queue(
      "serialised_assets",
      { data: null, error: null },
      { data: [], error: null },
      { data: [{ serial_number: "sn-real " }], error: null },
    );

    await expectInventoryError(
      SerialisedAssetService.bulkCreateAssets(42, 1, {
        location: "x",
        serial_number: " SN-REAL",
      }),
      409,
      `${UNIT_ERRORS.BULK_SERIAL_TAKEN}: SN-REAL`,
    );
    const builders = db.buildersFor("serialised_assets");
    expect(builders.some((b) => callArgs(b, "insert") !== undefined)).toBe(
      false,
    );
  });

  it("validates valuation fields on the bulk path too, before any write", async () => {
    await expectInventoryError(
      SerialisedAssetService.bulkCreateAssets(42, 1, {
        location: "x",
        acquisition_cost: -1,
      }),
      400,
      VALUATION_ERRORS.ACQUISITION_COST,
    );
    expect(db.from).not.toHaveBeenCalled();
  });
});

describe("SerialisedAssetService.updateAsset valuation fields", () => {
  it("writes acquisition_cost, purchase_date and market_price under the row_version guard", async () => {
    db.queue("serialised_assets", { data: unitRow, error: null });

    const unit = await SerialisedAssetService.updateAsset(
      5,
      {
        acquisition_cost: 900000,
        purchase_date: "2026-01-15",
        market_price: 750000,
        notes: " n ",
      },
      4,
    );

    const [update] = db.buildersFor("serialised_assets");
    expect(callArgs(update, "update")).toEqual([
      {
        notes: "n",
        acquisition_cost: 900000,
        purchase_date: "2026-01-15",
        market_price: 750000,
      },
    ]);
    expect(allCallArgs(update, "eq")).toEqual([
      ["id", 5],
      ["row_version", 4],
    ]);
    expect(unit.market_price).toBe(750000);
  });

  it("accepts a valuation-only patch and lets null clear a value", async () => {
    db.queue("serialised_assets", { data: unitRow, error: null });

    await SerialisedAssetService.updateAsset(5, { market_price: null }, 4);

    const [update] = db.buildersFor("serialised_assets");
    expect(callArgs(update, "update")).toEqual([{ market_price: null }]);
  });

  it("rejects negative, non-numeric and non-finite amounts before touching the database", async () => {
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { acquisition_cost: -1 }, 4),
      400,
      VALUATION_ERRORS.ACQUISITION_COST,
    );
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { market_price: "100" }, 4),
      400,
      VALUATION_ERRORS.MARKET_PRICE,
    );
    await expectInventoryError(
      SerialisedAssetService.updateAsset(
        5,
        { market_price: Number.POSITIVE_INFINITY },
        4,
      ),
      400,
      VALUATION_ERRORS.MARKET_PRICE,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("rejects malformed, impossible and future purchase dates", async () => {
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { purchase_date: "15/01/2026" }, 4),
      400,
      VALUATION_ERRORS.PURCHASE_DATE,
    );
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { purchase_date: "2026-02-31" }, 4),
      400,
      VALUATION_ERRORS.PURCHASE_DATE,
    );
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { purchase_date: "2999-01-01" }, 4),
      400,
      VALUATION_ERRORS.PURCHASE_DATE_FUTURE,
    );
    expect(db.from).not.toHaveBeenCalled();
  });

  it("still answers 409 when the version moved on", async () => {
    db.queue(
      "serialised_assets",
      { data: null, error: null },
      { data: { id: 5 }, error: null },
    );

    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, { acquisition_cost: 10 }, 4),
      409,
      UNIT_ERRORS.CONFLICT,
    );
  });

  it("still rejects an empty patch", async () => {
    await expectInventoryError(
      SerialisedAssetService.updateAsset(5, {}, 4),
      400,
      UNIT_ERRORS.EMPTY_PATCH,
    );
  });
});
