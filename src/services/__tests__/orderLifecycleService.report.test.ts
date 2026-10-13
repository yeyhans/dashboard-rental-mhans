import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-04b: `OrderLifecycleService.getReturnReport` reads `orders.return_report` with `select('*')`,
 * so it works before migration 0018 (the key is simply absent) and after it.
 */
const state = vi.hoisted(() => ({
  select: "",
  result: { data: null as unknown, error: null as unknown },
}));

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: (columns: string) => {
        state.select = columns;
        return { eq: () => ({ maybeSingle: async () => state.result }) };
      },
    }),
  },
}));

const { OrderLifecycleService } = await import("../orderLifecycleService");

describe("OrderLifecycleService.getReturnReport", () => {
  afterEach(() => {
    state.result = { data: null, error: null };
  });

  it("returns the stored report, reading with *", async () => {
    const report = { finalized_at: "x", finalized_by: null, lines: [] };
    state.result = { data: { id: 7, return_report: report }, error: null };

    await expect(OrderLifecycleService.getReturnReport(7)).resolves.toEqual(
      report,
    );
    expect(state.select).toBe("*");
  });

  it("returns null before the migration (no such key) or for an unknown order", async () => {
    state.result = { data: { id: 7 }, error: null };
    await expect(OrderLifecycleService.getReturnReport(7)).resolves.toBeNull();

    state.result = { data: null, error: null };
    await expect(OrderLifecycleService.getReturnReport(7)).resolves.toBeNull();
  });

  it("throws on a database error", async () => {
    state.result = { data: null, error: new Error("db down") };
    await expect(OrderLifecycleService.getReturnReport(7)).rejects.toThrow(
      "db down",
    );
  });
});
