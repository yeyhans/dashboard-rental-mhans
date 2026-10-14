/**
 * Pure view-model helpers for the order detail screen (`/orders/[id]`), canon RC2.1.2.
 *
 * Kept free of React so the project's node-only test runner covers them directly (no jsdom).
 * Every input here comes from `orders` columns, several of them jsonb or free text, so the
 * helpers accept loose values and never throw.
 */
import { DEFAULT_RESERVE_VALUE, reserveAmount } from "../../lib/finance";
import {
  ORDER_STATUSES,
  STATUS_LABELS,
  canonicalStatus,
  type OrderStatus,
} from "../../lib/orderStatus";

function toNumber(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : Number.parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

/* ---------------------------------------------------------------------------------------------
 * Pipeline
 * ------------------------------------------------------------------------------------------ */

export type PipelineStepState = "done" | "active" | "pending" | "cancelled";

export interface PipelineStep {
  key: OrderStatus;
  label: string;
  state: PipelineStepState;
  /** 1-based position along the chain; the cancelled step has none. */
  number: number | null;
}

const PIPELINE_CHAIN = ORDER_STATUSES.filter(
  (status) => status !== "cancelled",
);

/**
 * The seven chain stages with their state for `status`. A cancelled order gets an extra
 * cancelled step and leaves the chain pending: the data does not record the stage it left from.
 * Legacy values are placed on their v1.2 stage; an unknown value leaves every stage pending.
 */
export function orderPipelineSteps(status: unknown): PipelineStep[] {
  const current = canonicalStatus(status);
  const activeIndex =
    current && current !== "cancelled" ? PIPELINE_CHAIN.indexOf(current) : -1;

  const steps: PipelineStep[] = PIPELINE_CHAIN.map((key, index) => ({
    key,
    label: STATUS_LABELS[key],
    state:
      index < activeIndex
        ? "done"
        : index === activeIndex
          ? "active"
          : "pending",
    number: index + 1,
  }));

  if (current === "cancelled") {
    steps.push({
      key: "cancelled",
      label: STATUS_LABELS.cancelled,
      state: "cancelled",
      number: null,
    });
  }
  return steps;
}

/* ---------------------------------------------------------------------------------------------
 * Products
 * ------------------------------------------------------------------------------------------ */

export interface OrderItemInput {
  sku?: unknown;
  name?: unknown;
  quantity?: unknown;
  price?: unknown;
}

export interface OrderItemRow {
  sku: string;
  name: string;
  quantity: number;
  unitPrice: number;
  /** price x quantity x jornadas, the business rule for an item subtotal. */
  subtotal: number;
}

/** Number of rental days, never below one (the pricing rule treats a missing value as one). */
export function resolveJornadas(jornadas: unknown): number {
  const parsed = Math.trunc(toNumber(jornadas));
  return parsed >= 1 ? parsed : 1;
}

export function orderItemRows(
  items: readonly OrderItemInput[],
  jornadas: unknown,
): { rows: OrderItemRow[]; total: number } {
  const days = resolveJornadas(jornadas);
  const rows = items.map((item) => {
    const unitPrice = toNumber(item.price);
    const quantity = Math.trunc(toNumber(item.quantity));
    return {
      sku: typeof item.sku === "string" ? item.sku : "",
      name: typeof item.name === "string" ? item.name : "",
      quantity,
      unitPrice,
      subtotal: Math.round(unitPrice * quantity * days),
    };
  });
  return { rows, total: rows.reduce((sum, row) => sum + row.subtotal, 0) };
}

/* ---------------------------------------------------------------------------------------------
 * Budget versions (`new_pdf_on_hold_url` is a comma separated list, oldest first)
 * ------------------------------------------------------------------------------------------ */

export interface BudgetVersion {
  version: number;
  url: string;
  isCurrent: boolean;
}

export function budgetVersions(
  urlList: string | null | undefined,
): BudgetVersion[] {
  const urls = (urlList ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter((url) => url.length > 0);
  return urls
    .map((url, index) => ({
      version: index + 1,
      url,
      isCurrent: index === urls.length - 1,
    }))
    .reverse();
}

/* ---------------------------------------------------------------------------------------------
 * Payment state (ep-card)
 * ------------------------------------------------------------------------------------------ */

export type PaymentTag = "pagado" | "pendiente";
export type BalanceTone = "ok" | "warn" | "crit";

export interface OrderPaymentSummary {
  reserveLabel: string;
  reserveAmount: number;
  tag: PaymentTag;
  balance: number;
  balanceTone: BalanceTone;
}

/**
 * Reserve and balance from the order total and its reserve configuration. There is no payment
 * ledger: `pago_completo` is the only payment fact stored, so the reserve is either part of a
 * fully paid order or pending.
 */
export function orderPaymentSummary(input: {
  total: number;
  reserveType: string | null | undefined;
  reserveValue: unknown;
  isPaid: boolean;
}): OrderPaymentSummary {
  const total = Number.isFinite(input.total) ? input.total : 0;
  const configured = toNumber(input.reserveValue);
  const value =
    input.reserveValue === null ||
    input.reserveValue === undefined ||
    input.reserveValue === ""
      ? DEFAULT_RESERVE_VALUE
      : configured;
  const reserve = reserveAmount({
    total,
    reserveType: input.reserveType ?? null,
    reserveValue: value,
  });
  const balance = input.isPaid ? 0 : Math.max(total - reserve, 0);
  return {
    reserveLabel:
      input.reserveType === "fixed"
        ? "Pago reserva (monto fijo)"
        : `Pago reserva ${value}%`,
    reserveAmount: reserve,
    tag: input.isPaid ? "pagado" : "pendiente",
    balance,
    balanceTone: balance === 0 ? "ok" : balance < total * 0.5 ? "warn" : "crit",
  };
}

/* ---------------------------------------------------------------------------------------------
 * Financial summary
 * ------------------------------------------------------------------------------------------ */

export interface OrderFinancialSummary {
  productsSubtotal: number;
  discount: number;
  shipping: number;
  net: number;
  iva: number;
  total: number;
}

export function orderFinancialSummary(
  order: {
    calculated_subtotal?: unknown;
    calculated_discount?: unknown;
    shipping_total?: unknown;
    calculated_iva?: unknown;
    calculated_total?: unknown;
  },
  productsSubtotal: number,
): OrderFinancialSummary {
  return {
    productsSubtotal,
    discount: toNumber(order.calculated_discount),
    shipping: toNumber(order.shipping_total),
    net: toNumber(order.calculated_subtotal),
    iva: toNumber(order.calculated_iva),
    total: toNumber(order.calculated_total),
  };
}

/* ---------------------------------------------------------------------------------------------
 * Dates and labels
 * ------------------------------------------------------------------------------------------ */

const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
] as const;

/**
 * `DD/MM/YYYY` plus the full weekday for a `date` column. UTC getters on purpose: the column has
 * no time, and local getters shift the day at the UTC-4 boundary (same rule as
 * `formatOrderDateWithWeekday`). An unparseable value is shown as stored, without a weekday.
 */
export function rentalDateParts(value: string | null | undefined): {
  date: string;
  weekday: string;
} {
  if (!value) return { date: "—", weekday: "" };
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, weekday: "" };
  const day = String(date.getUTCDate()).padStart(2, "0");
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return {
    date: `${day}/${month}/${date.getUTCFullYear()}`,
    weekday: WEEKDAYS[date.getUTCDay()] ?? "",
  };
}

export function jornadasLabel(jornadas: unknown): string {
  const count = Math.trunc(toNumber(jornadas));
  if (count <= 0) return "";
  return `${count} jornada${count === 1 ? "" : "s"}`;
}

export function clientLine(
  name: string | null | undefined,
  company: string | null | undefined,
): string {
  return [name, company]
    .map((part) => (part ?? "").trim())
    .filter((part) => part.length > 0)
    .join(" · ");
}
