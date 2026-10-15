import type { ProductUnitCounts } from "../../types/inventory";

/** Same cap as `ProductUnitCountsService` / `GET /api/inventory/counts`. */
export const COUNTS_CHUNK_SIZE = 200;

const LOAD_ERROR = "No pudimos cargar el stock por unidad";

/** Distinct positive integer ids, split into request-sized chunks. */
export function chunkProductIds(ids: readonly number[]): number[][] {
  const unique = [...new Set(ids.filter((id) => Number.isInteger(id) && id > 0))];
  const chunks: number[][] = [];
  for (let start = 0; start < unique.length; start += COUNTS_CHUNK_SIZE) {
    chunks.push(unique.slice(start, start + COUNTS_CHUNK_SIZE));
  }
  return chunks;
}

export type CountsResult = { ok: true; data: Map<number, ProductUnitCounts> } | { ok: false; error: string };

/**
 * Stock / Disp. / Arriendo for the catalog list, one request per 200 products. All or nothing: a
 * half-filled column would read as "0 units" for the products whose chunk failed.
 */
export async function fetchProductUnitCounts(
  ids: readonly number[],
  options: { fetchImpl?: typeof fetch; accessToken?: string | undefined } = {},
): Promise<CountsResult> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = {};
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  const data = new Map<number, ProductUnitCounts>();
  try {
    const responses = await Promise.all(
      chunkProductIds(ids).map(async (chunk) => {
        const response = await fetchImpl(`/api/inventory/counts?product_ids=${chunk.join(",")}`, {
          headers,
          credentials: "same-origin",
        });
        const payload = await response.json();
        if (!response.ok || !payload?.success) throw new Error(payload?.error ?? `HTTP ${response.status}`);
        return (payload.data?.counts ?? []) as ProductUnitCounts[];
      }),
    );
    for (const rows of responses) for (const row of rows) data.set(row.product_id, row);
  } catch (error) {
    console.error("[productUnitCounts] Error al cargar los conteos de unidades:", { count: ids.length, error });
    return { ok: false, error: LOAD_ERROR };
  }
  return { ok: true, data };
}
