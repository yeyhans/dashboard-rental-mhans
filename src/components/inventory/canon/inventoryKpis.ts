import type { ProductUnitCounts } from "../../../types/inventory";

/** The four canon KPI cards of "Catálogo de Equipos", computed from real units. */
export interface InventoryKpis {
  publishedModels: number;
  /** Non-archived units across the catalog. */
  unitsInInventory: number;
  availableToday: number;
  /** Whole percent of `unitsInInventory`; 0 when there are no units. */
  availablePct: number;
  inRental: number;
  /** Maintenance (incl. cleaning) + damaged + blocked: the "requieren atención" card. */
  attention: number;
}

export function summarizeInventoryKpis(counts: readonly ProductUnitCounts[], publishedModels: number): InventoryKpis {
  let total = 0;
  let available = 0;
  let inRental = 0;
  let attention = 0;
  for (const row of counts) {
    total += row.total;
    available += row.available;
    inRental += row.in_rental;
    attention += row.maintenance + row.damaged + row.blocked;
  }
  return {
    publishedModels,
    unitsInInventory: total,
    availableToday: available,
    availablePct: total > 0 ? Math.round((available / total) * 100) : 0,
    inRental,
    attention,
  };
}
