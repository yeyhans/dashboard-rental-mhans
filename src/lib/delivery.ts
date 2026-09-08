/**
 * Delivery — the pure derivations.
 *
 * Source: `Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Delivery_Canonical_RC2.1.3.html`.
 * The canonical fixes four indicators (Envíos Hoy with a day-over-day delta, Por Despachar,
 * Entregados Hoy, and a Costo Delivery card broken into hoy / semana / mes), an active-today
 * table, and a history with its own totals row.
 *
 * What the canonical shows and the schema cannot back: the **Conductor** column and the **Pago
 * Delivery** state. `shipping_usage` has twelve columns and neither exists — only a free-form
 * `metadata` jsonb with no agreed shape. Inventing a key here would produce a column that reads
 * empty forever and looks like missing data rather than a missing feature, so both are omitted
 * and recorded instead.
 */

/** The five shipment states of the `shipping_usage_status_check` constraint. */
export const SHIPMENT_STATUSES = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'] as const;
export type ShipmentStatus = (typeof SHIPMENT_STATUSES)[number];

export const SHIPMENT_LABELS: Record<ShipmentStatus, string> = {
  pending: 'Pendiente',
  processing: 'En preparación',
  shipped: 'En ruta',
  delivered: 'Entregado',
  cancelled: 'Cancelado',
};

export function isShipmentStatus(value: unknown): value is ShipmentStatus {
  return typeof value === 'string' && (SHIPMENT_STATUSES as readonly string[]).includes(value);
}

export function shipmentLabel(status: string): string {
  return isShipmentStatus(status) ? SHIPMENT_LABELS[status] : status;
}

/** Awaiting dispatch: recorded but not yet on the road. `shipped` has already left. */
export function isAwaitingDispatch(status: string): boolean {
  return status === 'pending' || status === 'processing';
}

/**
 * Whether a shipment's equipment has actually left and a `checkout` movement may be registered
 * against it (T-026 gap 2/4, R3-201 CRITICAL: review on `e1a5b23`+`05c83cf`).
 *
 * `pending`/`processing` (`isAwaitingDispatch`) means the equipment is still on the shelf —
 * registering a checkout there would mark it as "out" before it physically leaves, corrupting
 * `hasOpenCheckout` and blocking that unit for whichever order actually needs it. `delivered` and
 * `cancelled` are excluded too: the dispatch is already closed one way or the other.
 *
 * Canonical evidence: `MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html`'s `renderActions` cfg
 * only offers `'Registrar entrega / Check-Out'` from the `preparacion` stage, i.e. the moment the
 * equipment is confirmed leaving — the real DB equivalent of "confirmed leaving" in
 * `shipping_usage.status` is `shipped`, not `pending`/`processing` (still being prepared) nor
 * `delivered` (already arrived).
 */
export function canRecordCheckout(status: string): boolean {
  return status === 'shipped';
}

/**
 * The dispatch state machine (T-026 gap 2/4, R3-205 CRITICAL: re-review on the R3-201 fix).
 *
 * `canRecordCheckout` gates checkout on `status === 'shipped'`, but nothing in the repo ever
 * wrote `shipped` into `shipping_usage.status` — `DeliveryService` only READ that column. The
 * checkout control was unreachable in the real flow. `DeliveryService.updateShipmentStatus` is
 * the write path this validates before it touches the database.
 *
 * The canonical (`MarioHans_OS_Area01_Delivery_Canonical_RC2.1.3.html`) declares no
 * `data-action` that changes an active shipment's status — its "Delivery activos" table is
 * read-only; the only interactive button in the whole page (`mark-paid`) changes a PAYMENT state
 * that has no backing column anyway (see the header note in `DeliveryBoard.tsx`). The transitions
 * below follow the real DB contract instead: `shipping_usage_status_check`
 * (`supabase/migrations/0000_baseline.sql`) allows exactly
 * `pending | processing | shipped | delivered | cancelled`, and the columns `shipped_at` /
 * `delivered_at` exist specifically to be stamped on the two transitions that matter operationally.
 */
const SHIPMENT_TRANSITIONS: Record<ShipmentStatus, readonly ShipmentStatus[]> = {
  pending: ['processing', 'shipped', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
};

export function canTransitionShipment(from: string, to: string): boolean {
  if (!isShipmentStatus(from) || !isShipmentStatus(to)) return false;
  return SHIPMENT_TRANSITIONS[from].includes(to);
}

/** Single-sourced so the service and the endpoint's error matcher cannot drift (same posture as `MOVEMENT_TRANSITION_ERRORS`). */
export const SHIPMENT_TRANSITION_ERRORS = {
  NOT_FOUND: 'Envío no encontrado',
  ILLEGAL: 'Ese cambio de estado no está permitido para este envío',
  RACE: 'El estado del envío cambió mientras se procesaba la solicitud, intenta de nuevo',
} as const;

function isoDay(value: string | Date): string {
  if (typeof value === 'string') return value.slice(0, 10);
  const y = value.getFullYear();
  const m = String(value.getMonth() + 1).padStart(2, '0');
  const d = String(value.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split('-').map(Number);
  const date = new Date(Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

export interface ShipmentLike {
  readonly status: string;
  readonly cost: number;
  readonly createdAt: string | null;
  readonly deliveredAt: string | null;
}

export interface DeliveryKpis {
  enviosHoy: number;
  enviosAyer: number;
  /** Percentage change against yesterday, or `null` when yesterday had none. */
  variacionDiaria: number | null;
  porDespachar: number;
  entregadosHoy: number;
  costoHoy: number;
  costoSemana: number;
  costoMes: number;
}

/**
 * Aggregates the indicator row.
 *
 * `variacionDiaria` is `null` — not `0` and not `100` — when yesterday had no shipments. Dividing
 * by zero would print `Infinity%`, and reporting `+100%` for "one shipment after a blank day"
 * dresses noise up as a trend. The view renders the null case as "sin referencia".
 *
 * Cancelled shipments count in neither the volume nor the cost: they never left, and folding them
 * into Costo Delivery would inflate a figure the business uses to settle with the courier.
 */
export function deliveryKpis(shipments: readonly ShipmentLike[], now: Date): DeliveryKpis {
  const today = isoDay(now);
  const yesterday = shiftDay(today, -1);
  const weekStart = shiftDay(today, -6);
  const monthStart = `${today.slice(0, 7)}-01`;

  const kpis: DeliveryKpis = {
    enviosHoy: 0,
    enviosAyer: 0,
    variacionDiaria: null,
    porDespachar: 0,
    entregadosHoy: 0,
    costoHoy: 0,
    costoSemana: 0,
    costoMes: 0,
  };

  for (const shipment of shipments) {
    if (shipment.status === 'cancelled') continue;

    const created = shipment.createdAt ? isoDay(shipment.createdAt) : null;
    const delivered = shipment.deliveredAt ? isoDay(shipment.deliveredAt) : null;
    const cost = Number.isFinite(shipment.cost) ? shipment.cost : 0;

    if (created === today) kpis.enviosHoy++;
    if (created === yesterday) kpis.enviosAyer++;
    if (isAwaitingDispatch(shipment.status)) kpis.porDespachar++;
    if (delivered === today) kpis.entregadosHoy++;

    if (created) {
      if (created === today) kpis.costoHoy += cost;
      if (created >= weekStart && created <= today) kpis.costoSemana += cost;
      if (created >= monthStart && created <= today) kpis.costoMes += cost;
    }
  }

  if (kpis.enviosAyer > 0) {
    kpis.variacionDiaria = Math.round(((kpis.enviosHoy - kpis.enviosAyer) / kpis.enviosAyer) * 100);
  }

  return kpis;
}

export interface HistoryTotals {
  totalEnvios: number;
  costoTotal: number;
  promedioPorEnvio: number;
}

/**
 * The history footer. The average divides by the number of shipments, so an empty history gives
 * `0` rather than `NaN` — a `NaN` here renders as "NaN" in the card with no error anywhere.
 */
export function historyTotals(shipments: readonly ShipmentLike[]): HistoryTotals {
  const counted = shipments.filter(s => s.status !== 'cancelled');
  const costoTotal = counted.reduce((sum, s) => sum + (Number.isFinite(s.cost) ? s.cost : 0), 0);

  return {
    totalEnvios: counted.length,
    costoTotal,
    promedioPorEnvio: counted.length > 0 ? Math.round(costoTotal / counted.length) : 0,
  };
}

/** CLP has no decimals. */
export function formatCLP(amount: number): string {
  return `$${Math.round(amount).toLocaleString('es-CL')}`;
}
