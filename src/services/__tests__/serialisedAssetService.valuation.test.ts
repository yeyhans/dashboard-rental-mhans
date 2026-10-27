import { afterEach, describe, expect, it, vi } from "vitest";

import { InventoryError, UNIT_ERRORS } from "../../lib/inventoryUnits";
import { allCallArgs, callArgs, sharedDouble as db } from "./supabaseDouble";

vi.mock("../../lib/supabase", async () => {
  const { sharedDouble } = await import("./supabaseDouble");
  return { supabaseAdmin: sharedDouble.client };
});

const { SerialisedAssetService, VALUATION_ERRORS } = await import(
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
  it("inserts one unit, then applies serial and valuation under the issued row_version", async () => {
    vi.spyOn(console, "log").mockImplementation(() => {});
    db.queue("products", { data: { id: 42 }, error: null });
    db.queue(
      "serialised_assets",
      { data: null, error: null },
      { data: [], error: null },
      { data: [{ ...unitRow, row_version: 1 }], error: null },
      { data: { ...unitRow, row_version: 2 }, error: null },
    );

    const unit = await SerialisedAssetService.createUnit({
      product_id: 42,
      location: "Estante 1",
      serial_number: "SN-REAL",
      acquisition_cost: 900000,
    });

    const builders = db.buildersFor("serialised_assets");
    const update = builders[builders.length - 1];
    expect(callArgs(update, "update")).toEqual([
      { serial_number: "SN-REAL", acquisition_cost: 900000 },
    ]);
    expect(allCallArgs(update, "eq")).toEqual([
      ["id", 5],
      ["row_version", 1],
    ]);
    expect(unit.row_version).toBe(2);
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
