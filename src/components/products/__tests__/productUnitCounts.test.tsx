import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { chunkProductIds, fetchProductUnitCounts } from "../productUnitCounts";
import { ProductUnitCountCells } from "../ProductUnitCountCells";
import type { ProductUnitCounts } from "../../../types/inventory";

function counts(partial: Partial<ProductUnitCounts> = {}): ProductUnitCounts {
  return { product_id: 1, total: 0, available: 0, in_rental: 0, maintenance: 0, damaged: 0, blocked: 0, retired: 0, ...partial };
}

describe("chunkProductIds", () => {
  it("dedupes and splits into chunks of at most 200 ids", () => {
    const ids = Array.from({ length: 450 }, (_, i) => i + 1);
    const chunks = chunkProductIds([...ids, 1, 2]);
    expect(chunks.map((c) => c.length)).toEqual([200, 200, 50]);
    expect(chunks[0]?.[0]).toBe(1);
  });

  it("drops non-positive and non-integer ids", () => {
    expect(chunkProductIds([0, -1, 2.5, 3])).toEqual([[3]]);
  });
});

describe("fetchProductUnitCounts", () => {
  it("calls the counts endpoint once per chunk and indexes rows by product id", async () => {
    const fetchImpl = vi.fn(async (url: string) => {
      const ids = new URL(url, "http://x").searchParams.get("product_ids")!.split(",").map(Number);
      return new Response(
        JSON.stringify({ success: true, data: { counts: ids.map((id) => counts({ product_id: id, total: id })) } }),
        { status: 200 },
      );
    });
    const ids = Array.from({ length: 201 }, (_, i) => i + 1);
    const result = await fetchProductUnitCounts(ids, { fetchImpl: fetchImpl as unknown as typeof fetch });

    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(String(fetchImpl.mock.calls[0]?.[0])).toMatch(/^\/api\/inventory\/counts\?product_ids=1,2,/);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.get(201)?.total).toBe(201);
      expect(result.data.size).toBe(201);
    }
  });

  it("fails as a whole when one chunk fails, without throwing", async () => {
    const fetchImpl = vi.fn(async () => new Response(JSON.stringify({ success: false, error: "x" }), { status: 500 }));
    const result = await fetchProductUnitCounts([1, 2], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(result).toEqual({ ok: false, error: "No pudimos cargar el stock por unidad" });
  });

  it("does not call the network for an empty list", async () => {
    const fetchImpl = vi.fn();
    const result = await fetchProductUnitCounts([], { fetchImpl: fetchImpl as unknown as typeof fetch });
    expect(fetchImpl).not.toHaveBeenCalled();
    expect(result.ok && result.data.size).toBe(0);
  });
});

describe("ProductUnitCountCells (list columns Stock | Disp. | Arriendo | Estado)", () => {
  function renderRow(node: React.ReactNode) {
    return renderToStaticMarkup(
      <table>
        <tbody>
          <tr>{node}</tr>
        </tbody>
      </table>,
    );
  }

  it("renders stock, available and rented counts plus the canon status pill", () => {
    const html = renderRow(<ProductUnitCountCells counts={counts({ total: 5, available: 3, in_rental: 2 })} />);
    const cells = html.match(/<td[^>]*>.*?<\/td>/g) ?? [];
    expect(cells).toHaveLength(4);
    expect(cells[0]).toContain(">5<");
    expect(cells[1]).toContain(">3<");
    expect(cells[2]).toContain(">2<");
    expect(cells[3]).toContain("Disponible");
  });

  it("shows the placeholder while counts are unknown", () => {
    const html = renderRow(<ProductUnitCountCells counts={undefined} />);
    expect((html.match(/>—</g) ?? []).length).toBe(4);
  });

  it("shows 'Sin unidades' for a product with no units", () => {
    const html = renderRow(<ProductUnitCountCells counts={counts()} />);
    expect(html).toContain("Sin unidades");
  });
});
