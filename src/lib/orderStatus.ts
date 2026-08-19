/**
 * Canonical `orders.status` vocabulary — Portal Cliente v1.2 (ADR-001).
 *
 * Single source of truth for the dashboard. Before this module the eight (previously seven)
 * values were spelled out by hand in 29 files under `src/`, each with its own list and its own
 * Spanish labels. That duplication is what makes a status migration dangerous: it turns one
 * rename into 29 independent chances to miss one, and the ones that get missed are the rarely
 * opened screens, where a wrong status is noticed last.
 *
 * Mirrors `supabase/migrations/0003_m4_status_portal_v12.sql`. The database CHECK constraint is
 * the real authority — if the two ever disagree, this file is the one that is wrong.
 */

/** The eight values the migrated `orders_status_check` constraint admits. */
export const ORDER_STATUSES = [
  'request',
  'evaluation',
  'confirmed',
  'preparation',
  'in-rental',
  'return',
  'completed',
  'cancelled',
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

/**
 * Every value the PRE-migration constraint permitted.
 *
 * Kept after the migration on purpose: order archives, exported reports and the rollback snapshot
 * still carry these, and `migrateLegacyStatus` needs a definition of "legacy" to answer against.
 * `pending` and `refunded` hold zero rows in production but were constraint-permitted, so they
 * are covered here for the same reason the SQL `CASE` covers them.
 *
 * Note this is NOT the workflow documented in `.claude/rules/01-business-context.md`, which lists
 * `reviewing`, `preparing`, `delivering` and `paid`. Those four were never database values.
 */
export const LEGACY_ORDER_STATUSES = [
  'pending',
  'processing',
  'on-hold',
  'completed',
  'cancelled',
  'refunded',
  'failed',
] as const;

export type LegacyOrderStatus = (typeof LEGACY_ORDER_STATUSES)[number];

/**
 * Spanish labels, taken verbatim from the client's approved design.
 *
 * Source: `CONSOLIDADO WEB YEYSON/Area 02 - portal Cliente/
 * MarioHans_OS_Client_Portal_Canonical_Visual_v2.0.html` — the `<option>` values of the Pedidos
 * filter. Do not paraphrase them here: the customer portal renders these exact strings, and the
 * dashboard naming the same state differently is precisely the inconsistency this consolidation
 * is meant to remove.
 *
 * Note the grammatical gender. The client writes "pedido" (masculine), so the labels are
 * `Confirmado` / `Completado` / `Cancelado`, not the `Confirmada` / `Completada` / `Cancelada`
 * that "orden" would take. An earlier draft of this file invented the labels and got six of the
 * eight wrong for that reason.
 */
export const STATUS_LABELS: Record<OrderStatus, string> = {
  request: 'Solicitud',
  evaluation: 'Evaluación',
  confirmed: 'Confirmado',
  preparation: 'Preparación',
  'in-rental': 'En arriendo',
  return: 'Devolución',
  completed: 'Completado',
  cancelled: 'Cancelado',
};

/**
 * The forward mapping, identical to the `CASE` in `0003_m4_status_portal_v12.sql`.
 *
 * Three source values collapse into `cancelled`, which is why there is no inverse here: the
 * rollback reads the `(id, status)` snapshot instead. Anything that needs to tell a migrated
 * `failed` from a migrated `cancelled` must read `orders.cancellation_reason`.
 */
const LEGACY_TO_V12: Record<LegacyOrderStatus, OrderStatus> = {
  completed: 'completed',
  cancelled: 'cancelled',
  failed: 'cancelled',
  'on-hold': 'request',
  processing: 'confirmed',
  pending: 'request',
  refunded: 'cancelled',
};

/** Narrows an untrusted value to `OrderStatus`. Accepts non-strings without throwing. */
export function isOrderStatus(value: unknown): value is OrderStatus {
  return typeof value === 'string' && (ORDER_STATUSES as readonly string[]).includes(value);
}

/** Narrows an untrusted value to `LegacyOrderStatus`. `completed` and `cancelled` are both. */
export function isLegacyOrderStatus(value: unknown): value is LegacyOrderStatus {
  return typeof value === 'string' && (LEGACY_ORDER_STATUSES as readonly string[]).includes(value);
}

/**
 * Maps a pre-migration value to its v1.2 equivalent.
 *
 * Returns `null` — not the input — for anything that is not a legacy status. A passthrough would
 * let an unknown value travel onward looking as though it had been migrated, which is the failure
 * this whole module exists to prevent.
 */
export function migrateLegacyStatus(value: unknown): OrderStatus | null {
  return isLegacyOrderStatus(value) ? LEGACY_TO_V12[value] : null;
}

/**
 * Spanish label for display. Falls back to the raw value rather than throwing or rendering
 * `undefined`: if the database somehow holds an unexpected status, an admin reading the raw
 * string is far more useful than a blank cell or a crashed React island.
 */
export function statusLabel(status: string): string {
  return isOrderStatus(status) ? STATUS_LABELS[status] : status;
}

/* ---------------------------------------------------------------------------------------------
 * State machine
 * ------------------------------------------------------------------------------------------ */

/**
 * The single linear chain, from `TRANSICIONES_VALIDAS` in Área 01 §5
 * (`CONSOLIDADO WEB YEYSON/Área 01 · Rental Técnico/
 * MarioHans_OS_Area01_Final_Architecture_Module_Consolidation_v1.1.html`).
 *
 * The order is the only entity in the system modelled as an explicit state machine, and the
 * document is emphatic that no view may skip a stage. Each stage has exactly one successor, and
 * the action that advances it is an operational fact, not a UI affordance:
 *
 *   Solicitud     --("Confirmar y crear pedido", genera presupuesto versionado)--> En evaluación
 *   En evaluación --("Registrar preparación")------------------------------------> Confirmada
 *   Confirmada    --(asignación de unidades por N° de serie)---------------------> Preparación
 *   Preparación   --("Registrar entrega")---------------------------------------> En Arriendo
 *   En Arriendo   --("Registrar devolución")------------------------------------> Devolución
 *   Devolución    --("Completar pedido")----------------------------------------> Completado
 */
const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus>> = {
  request: 'evaluation',
  evaluation: 'confirmed',
  confirmed: 'preparation',
  preparation: 'in-rental',
  'in-rental': 'return',
  return: 'completed',
};

/**
 * The two exits. Área 01 describes the machine as "lineal con dos salidas terminales".
 *
 * That document actually keeps three terminals — Completado, Rechazada and Cancelada — where the
 * v1.2 vocabulary has two, collapsing Rechazada and Cancelada into `cancelled`. The distinction is
 * not lost: it lives in `orders.cancellation_reason`, added by migration 0003 for exactly this.
 */
export const TERMINAL_STATUSES = ['completed', 'cancelled'] as const;

export function isTerminalStatus(status: unknown): boolean {
  return typeof status === 'string' && (TERMINAL_STATUSES as readonly string[]).includes(status);
}

/** The one stage an order may advance to, or `null` at a terminal. */
export function nextStatus(status: OrderStatus): OrderStatus | null {
  return NEXT_STATUS[status] ?? null;
}

/**
 * Whether a status change is legal.
 *
 * Two rules, and no third:
 *  1. Advance exactly one stage along the chain. Skipping is how an order reaches `in-rental`
 *     without anyone having assigned units by serial number during `preparation`.
 *  2. Cancel from any non-terminal stage. This is NOT in the Área 01 table, which maps only the
 *     advance action — but email 06 "Equipos no disponibles" fires when staff finds no
 *     availability for an order still awaiting review, so early termination demonstrably exists.
 *
 * Going backwards is never allowed. Neither is leaving a terminal state.
 */
export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  if (!isOrderStatus(from) || !isOrderStatus(to)) return false;
  if (isTerminalStatus(from)) return false;
  if (to === 'cancelled') return true;
  return NEXT_STATUS[from] === to;
}

/* ---------------------------------------------------------------------------------------------
 * Presentation
 * ------------------------------------------------------------------------------------------ */

/**
 * The five tones of the design system. `Diseño/MarioHans OS Design System/tokens/colors.css`
 * defines a `-text / -tint / -border` triplet plus a base for each, and nothing else is chromatic:
 * "Brand is black & white; the only chromatic language is functional status."
 */
export const STATUS_TONES_VALUES = ['success', 'warning', 'danger', 'info', 'neutral'] as const;

export type StatusTone = (typeof STATUS_TONES_VALUES)[number];

/**
 * Tone per status — derived, not chosen.
 *
 * `Diseño/MarioHans OS Design System/components/data/StatusBadge.jsx` carries a `STATES` table
 * that names each operational stage in Spanish and fixes its tone. Its key set is not the v1.2
 * enum (it is a 13-entry superset that also covers equipment states), but every v1.2 status lands
 * on exactly one named stage, so the tone comes from the design system rather than from taste:
 *
 *   request → solicitud · evaluation → evaluacion · confirmed → confirmado
 *   preparation → preparacion · in-rental → activo · return → retorno
 *   completed → finalizado · cancelled → rechazado
 *
 * Before this map, five components each kept their own `bg-yellow-100 text-yellow-800`-style
 * table, and they disagreed: the same order read "En Espera" amber on one screen and gray on
 * another. Colour here is information, so a disagreement is a wrong reading, not a style nit.
 */
export const STATUS_TONES: Record<OrderStatus, StatusTone> = {
  request: 'neutral',
  evaluation: 'info',
  confirmed: 'success',
  preparation: 'warning',
  'in-rental': 'info',
  return: 'warning',
  completed: 'neutral',
  cancelled: 'danger',
};

/**
 * Tone for display, `neutral` for anything unrecognised.
 *
 * The fallback is deliberate and matches `statusLabel`: legacy rows exist between the code deploy
 * and the 0003 apply, and exported archives carry them forever. A gray badge on an unexpected
 * value is a far better outcome than a thrown error inside a React island.
 */
export function statusTone(status: string): StatusTone {
  return isOrderStatus(status) ? STATUS_TONES[status] : 'neutral';
}

/**
 * Tailwind classes for a status badge, one tone across tint, text and border.
 *
 * Returned as data rather than as a React component on purpose: the project has no jsdom or
 * testing-library, so a component would ship untested, while a pure string is covered here.
 *
 * The arbitrary-value syntax is not a shortcut around Tailwind's palette — it IS the design
 * system's rule, whose bundled oxlint config enforces "referenciar siempre custom properties,
 * nunca hexadecimales crudos". The five duplicated maps this replaces were built from
 * `bg-yellow-100 text-yellow-800`, Tailwind palette colours that appear in no token file and
 * drifted apart between components.
 */
const TONE_BADGE_CLASSES: Record<StatusTone, string> = {
  success: 'bg-[var(--success-tint)] text-[var(--success-text)] border-[var(--success-border)]',
  warning: 'bg-[var(--warning-tint)] text-[var(--warning-text)] border-[var(--warning-border)]',
  danger: 'bg-[var(--danger-tint)] text-[var(--danger-text)] border-[var(--danger-border)]',
  info: 'bg-[var(--info-tint)] text-[var(--info-text)] border-[var(--info-border)]',
  neutral: 'bg-[var(--neutral-tint)] text-[var(--neutral-text)] border-[var(--neutral-border)]',
};

export function statusBadgeClass(status: string): string {
  return TONE_BADGE_CLASSES[statusTone(status)];
}

/**
 * Ready-made `<select>` options, in chain order.
 *
 * `OrderEstado.tsx` hand-wrote nine of these, including `trash` and `auto-draft` — values the
 * `orders_status_check` constraint never admitted, so choosing one produced a constraint
 * violation surfaced as a 500. Chain order matters too: the machine only advances one stage, so
 * the option immediately below the current one is the only ordinary move.
 */
export const STATUS_OPTIONS: ReadonlyArray<{ value: OrderStatus; label: string }> =
  ORDER_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

/* ---------------------------------------------------------------------------------------------
 * Email trigger matrix
 * ------------------------------------------------------------------------------------------ */

/**
 * Which of the eight approved transactional emails fires on ENTERING a status.
 *
 * Resolved by joining two sources, not by reading either alone. The email handoff
 * (`correos/MarioHans_OS_Rental_Email_Flow_Developer_Handoff_v1.0.html`) names states in the
 * operational Spanish of the flow diagram — "En espera", "Disponibilidad confirmada", "Arriendo en
 * curso" — which does not map onto the v1.2 enum by itself; four of its eight rows were ambiguous
 * or explicitly "Por definir". Área 01 §5 supplies the missing half.
 *
 * The two resolutions worth knowing:
 *
 *  · **04 Equipos disponibles fires on `evaluation`, not `confirmed`.** The handoff warns
 *    "Disponibilidad confirmada ≠ reserva confirmada", and the email is the one that ASKS for the
 *    25% deposit — so the reservation cannot already be confirmed when it goes out.
 *  · **06 Equipos no disponibles fires on `cancelled`.** The handoff left it "Por definir (posible
 *    correspondencia con Fallido)"; Área 01's "dos salidas terminales" settles it.
 *
 * Three of the eight emails are absent here on purpose:
 *  · 01 Registro and 02 Contrato hang off the ACCOUNT lifecycle, not off `orders.status`.
 *  · 05 Pedido actualizado is marked "Evento, no estado" — it fires on a new presupuesto version,
 *    so it cannot be keyed on a status at all.
 *
 * `preparation` and `return` send nothing, and that is deliberate: both are internal operational
 * stages (bodega assigns units, check-in verifies equipment) where nothing is asked of the
 * customer. There is no ninth template to write.
 */
export const EMAIL_ON_ENTER: Partial<Record<OrderStatus, string>> = {
  request: 'solicitud-recibida', //      03
  evaluation: 'equipos-disponibles', //  04
  'in-rental': 'equipos-entregados', //  07
  completed: 'pedido-completado', //     08
  cancelled: 'equipos-no-disponibles', //06
};
