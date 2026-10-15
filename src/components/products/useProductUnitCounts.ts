import { useEffect, useState } from "react";
import type { ProductUnitCounts } from "../../types/inventory";
import { fetchProductUnitCounts } from "./productUnitCounts";

/**
 * Per-product unit counts for the catalog list. `counts` stays `null` until loaded or when the
 * load fails (0021 not applied yet), so the columns keep the placeholder instead of zeros.
 */
export function useProductUnitCounts(productIds: readonly number[], accessToken?: string) {
  const [counts, setCounts] = useState<Map<number, ProductUnitCounts> | null>(null);
  const [error, setError] = useState<string | null>(null);
  const key = [...new Set(productIds)].sort((a, b) => a - b).join(",");

  useEffect(() => {
    let isCancelled = false;
    const ids = key ? key.split(",").map(Number) : [];
    fetchProductUnitCounts(ids, { accessToken }).then((result) => {
      if (isCancelled) return;
      if (result.ok) {
        setCounts(result.data);
        setError(null);
      } else {
        setCounts(null);
        setError(result.error);
      }
    });
    return () => {
      isCancelled = true;
    };
  }, [key, accessToken]);

  return { counts, error };
}
