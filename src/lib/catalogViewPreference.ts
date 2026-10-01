const STORAGE_KEY = "mhans:catalog-view-mode";

export type CatalogViewMode = "list" | "grid";

function isCatalogViewMode(value: unknown): value is CatalogViewMode {
  return value === "list" || value === "grid";
}

/**
 * D-23 (05e): the list/grid toggle persists per browser via `localStorage`, wrapped in
 * try/catch on both read and write — a private window, blocked storage, or SSR (no `window`)
 * must fall back to the default silently instead of crashing the catalog.
 */
export function loadCatalogViewMode(
  defaultMode: CatalogViewMode = "list",
): CatalogViewMode {
  try {
    if (typeof window === "undefined") return defaultMode;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return isCatalogViewMode(stored) ? stored : defaultMode;
  } catch {
    return defaultMode;
  }
}

export function saveCatalogViewMode(mode: CatalogViewMode): void {
  try {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, mode);
  } catch {
    // Storage unavailable (private window, quota, disabled) — the toggle still works in-memory.
  }
}
