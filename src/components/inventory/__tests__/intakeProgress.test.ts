import { describe, expect, it, vi } from "vitest";
import {
  bumpTotalAssets,
  createLatestGate,
  fetchIntakeProgress,
} from "../intakeProgress";

/**
 * D-7 (A-17). After registering a unit the dashboard only nudged `total_assets` optimistically, but
 * the card headlines `products_with_assets / published_products` and the percentage, which stayed
 * at their server-rendered values until the operator pressed "Actualizar". The authoritative
 * numbers come from `/api/inventory/progress`; the dashboard now re-reads them after every created
 * unit, ignoring answers that arrive out of order.
 */
const progress = {
  published_products: 139,
  products_with_assets: 5,
  total_assets: 9,
  completion_percentage: 4,
};

function response(body: unknown, ok = true) {
  return { ok, json: async () => body } as Response;
}

describe("fetchIntakeProgress", () => {
  it("returns the progress payload from the endpoint", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ success: true, data: progress }),
    );

    await expect(fetchIntakeProgress(fetchImpl as never)).resolves.toEqual(
      progress,
    );
    expect(fetchImpl).toHaveBeenCalledWith("/api/inventory/progress");
  });

  it("throws the server message when the endpoint refuses", async () => {
    const fetchImpl = vi.fn(async () =>
      response({ success: false, error: "Error al obtener el avance" }, false),
    );
    await expect(fetchIntakeProgress(fetchImpl as never)).rejects.toThrow(
      "Error al obtener el avance",
    );
  });

  it("throws a Spanish fallback on a malformed payload", async () => {
    const fetchImpl = vi.fn(async () => response({ success: true }));
    await expect(fetchIntakeProgress(fetchImpl as never)).rejects.toThrow(
      /avance/i,
    );
  });
});

describe("bumpTotalAssets", () => {
  it("adds one unit without touching the product counters", () => {
    expect(bumpTotalAssets(progress)).toEqual({
      ...progress,
      total_assets: 10,
    });
  });
});

describe("createLatestGate", () => {
  it("accepts only the most recently started request", () => {
    const gate = createLatestGate();
    const first = gate.next();
    const second = gate.next();

    expect(gate.isLatest(first)).toBe(false);
    expect(gate.isLatest(second)).toBe(true);
  });
});
