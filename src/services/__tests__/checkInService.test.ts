import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * T-01: the Check-In board lists only orders still to be received — `in-rental` and `return` —
 * ordered by return date, one server page at a time. It used to load every active stage plus
 * every completed order under a fixed `.limit(200)`, so a busy month silently dropped returns.
 */
type Call = { method: string; args: unknown[] };

const queries = vi.hoisted(() => [] as Call[][]);
const results = vi.hoisted(
  () => [] as { data: unknown; error: unknown; count?: number }[],
);

function chain(index: number) {
  const calls: Call[] = [];
  queries[index] = calls;
  const proxy: any = new Proxy(
    {},
    {
      get(_target, method: string) {
        if (method === "then") {
          const result = results[index] ?? { data: [], error: null, count: 0 };
          return (resolve: (v: unknown) => void) => resolve(result);
        }
        return (...args: unknown[]) => {
          calls.push({ method, args });
          return proxy;
        };
      },
    },
  );
  return proxy;
}

let fromCount = 0;
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table !== "orders") throw new Error(`unexpected table ${table}`);
      return chain(fromCount++);
    },
  },
}));

const { CheckInService, CHECK_IN_PAGE_SIZE, CHECK_IN_KPI_ROW_LIMIT } =
  await import("../checkInService");

const NOW = new Date("2026-10-13T15:00:00Z");

function row(id: number, status: string, end: string) {
  return {
    id,
    order_key: null,
    status,
    order_proyecto: "Rodaje",
    order_fecha_termino: end,
    billing_first_name: "Ana",
    billing_last_name: "Pérez",
    billing_company: null,
    line_items: [{ name: "Cámara", sku: "CAM", product_id: 1, quantity: 2 }],
  };
}

/** The page query is the one that calls `range`. */
function pageQuery(): Call[] {
  return queries.find((calls) => calls.some((c) => c.method === "range"))!;
}

describe("CheckInService.getBoard", () => {
  afterEach(() => {
    queries.length = 0;
    results.length = 0;
    fromCount = 0;
  });

  it("lists only in-rental and return orders, by return date", async () => {
    await CheckInService.getBoard(NOW);

    const calls = pageQuery();
    expect(calls).toContainEqual({
      method: "in",
      args: ["status", ["in-rental", "return"]],
    });
    expect(calls).toContainEqual({
      method: "order",
      args: ["order_fecha_termino", { ascending: true }],
    });
    expect(calls.some((c) => c.method === "limit")).toBe(false);
  });

  it("paginates on the server with range and an exact count", async () => {
    await CheckInService.getBoard(NOW, { page: 3, pageSize: 20 });

    const calls = pageQuery();
    expect(calls).toContainEqual({ method: "range", args: [40, 59] });
    const select = calls.find((c) => c.method === "select")!;
    expect(select.args[1]).toEqual({ count: "exact" });
  });

  it("returns the page metadata and keeps the server order", async () => {
    results[0] = {
      data: [row(5, "return", "2026-10-10"), row(6, "in-rental", "2026-10-14")],
      error: null,
      count: 45,
    };

    const board = await CheckInService.getBoard(NOW, { page: 1, pageSize: 20 });

    expect(board.entries.map((e) => e.id)).toEqual([5, 6]);
    expect(board.pagination).toEqual({
      page: 1,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it("clamps an invalid page and page size", async () => {
    const board = await CheckInService.getBoard(NOW, {
      page: -2,
      pageSize: 10_000,
    });

    expect(board.pagination.page).toBe(1);
    expect(board.pagination.pageSize).toBe(CHECK_IN_PAGE_SIZE.max);
  });

  it("throws when the page query fails", async () => {
    results[0] = { data: null, error: new Error("db down") };

    await expect(CheckInService.getBoard(NOW)).rejects.toThrow("db down");
  });
});

/* H-2 --------------------------------------------------------------------------------------- */

describe("CheckInService.getBoard — bounds (H-2)", () => {
  afterEach(() => {
    queries.length = 0;
    results.length = 0;
    fromCount = 0;
  });

  it("clamps a page past the end to the last page", async () => {
    results[0] = { data: [], error: null, count: 45 };
    results[1] = {
      data: [row(9, "return", "2026-10-10")],
      error: null,
      count: 45,
    };

    const board = await CheckInService.getBoard(NOW, { page: 9, pageSize: 20 });

    const ranges = queries
      .flat()
      .filter((c) => c.method === "range")
      .map((c) => c.args);
    expect(ranges).toEqual([
      [160, 179],
      [40, 59],
    ]);
    expect(board.pagination.page).toBe(3);
    expect(board.entries.map((e) => e.id)).toEqual([9]);
  });

  it("bounds the KPI queries and selects only the two columns they need", async () => {
    await CheckInService.getBoard(NOW);

    const kpiQueries = queries.filter(
      (calls) => !calls.some((c) => c.method === "range"),
    );
    expect(kpiQueries).toHaveLength(2);
    for (const calls of kpiQueries) {
      expect(calls.find((c) => c.method === "select")?.args[0]).toBe(
        "status, order_fecha_termino",
      );
      expect(calls).toContainEqual({
        method: "limit",
        args: [CHECK_IN_KPI_ROW_LIMIT],
      });
    }
  });
});

describe("CheckInService.getBoard — KPI limit (H-3)", () => {
  afterEach(() => {
    queries.length = 0;
    results.length = 0;
    fromCount = 0;
    vi.restoreAllMocks();
  });

  it("warns when a KPI query hits the row limit instead of truncating silently", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    results[1] = {
      data: Array.from({ length: CHECK_IN_KPI_ROW_LIMIT }, () => ({
        status: "return",
        order_fecha_termino: "2026-10-10",
      })),
      error: null,
    };

    await CheckInService.getBoard(NOW);

    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("[CheckInService]"),
      expect.objectContaining({ limit: CHECK_IN_KPI_ROW_LIMIT }),
    );
  });

  it("stays quiet under the limit", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    await CheckInService.getBoard(NOW);
    expect(warn).not.toHaveBeenCalled();
  });
});
