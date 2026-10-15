import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `AssetMovementService.listOpenCheckoutsForOrder` (admin status jump, 2026-10-14). The status
 * routes call it before closing an order or sending it back from the rental, so it must answer
 * "which units are still out for this order" and must never take the status change down with it.
 */
const state = vi.hoisted(() => ({
  result: { data: [] as any[] | null, error: null as any },
  calls: [] as Array<[string, ...unknown[]]>,
  throwOnFrom: false,
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (state.throwOnFrom) throw new Error("relation does not exist");
      state.calls.push(["from", table]);
      const chain: any = {
        select: (columns: string) => {
          state.calls.push(["select", columns]);
          return chain;
        },
        eq: (column: string, value: unknown) => {
          state.calls.push(["eq", column, value]);
          return chain;
        },
        is: (column: string, value: unknown) => {
          state.calls.push(["is", column, value]);
          return Promise.resolve(state.result);
        },
      };
      return chain;
    },
  },
}));

const { AssetMovementService } = await import("../assetMovementService");

beforeEach(() => {
  state.result = { data: [], error: null };
  state.calls = [];
  state.throwOnFrom = false;
});

describe("AssetMovementService.listOpenCheckoutsForOrder", () => {
  it("queries only the open checkouts of the order", async () => {
    await AssetMovementService.listOpenCheckoutsForOrder(42);

    expect(state.calls).toContainEqual(["from", "asset_movements"]);
    expect(state.calls).toContainEqual(["eq", "order_id", 42]);
    expect(state.calls).toContainEqual(["eq", "direction", "checkout"]);
    expect(state.calls).toContainEqual(["is", "closed_by_movement_id", null]);
  });

  it("returns the asset tags of the units still out", async () => {
    state.result.data = [
      { asset_id: 1, serialised_assets: { asset_tag: "MH-00001" } },
      { asset_id: 2, serialised_assets: { asset_tag: "MH-00002" } },
    ];

    await expect(
      AssetMovementService.listOpenCheckoutsForOrder(42),
    ).resolves.toEqual(["MH-00001", "MH-00002"]);
  });

  it("falls back to the asset id when the unit has no tag", async () => {
    state.result.data = [{ asset_id: 7, serialised_assets: null }];

    await expect(
      AssetMovementService.listOpenCheckoutsForOrder(42),
    ).resolves.toEqual(["Unidad #7"]);
  });

  it("returns an empty list when the order has nothing out", async () => {
    await expect(
      AssetMovementService.listOpenCheckoutsForOrder(42),
    ).resolves.toEqual([]);
  });

  it("fails soft when the inventory query errors", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    state.result = { data: null, error: { code: "42P01", message: "missing" } };

    await expect(
      AssetMovementService.listOpenCheckoutsForOrder(42),
    ).resolves.toEqual([]);
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("fails soft when the client throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    state.throwOnFrom = true;

    await expect(
      AssetMovementService.listOpenCheckoutsForOrder(42),
    ).resolves.toEqual([]);
    consoleError.mockRestore();
  });
});
