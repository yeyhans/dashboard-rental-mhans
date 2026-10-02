import type { BudgetDocumentData, LineItem } from "../core/types";
import { orderBreakdown } from "../../orderBreakdown";
import { reserveAmount } from "../../finance";
import { reserveLabel } from "../../pricing";

/**
 * Loose order record. Both budget routes hand over different shapes of the same order: the DB row
 * (flat columns, sometimes mirrored under `metadata`) and the `BudgetData` payload (everything
 * under `metadata`). Every read goes through `pick`, which looks in `metadata` first and then at
 * the top level, so one mapper serves both.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type BudgetOrderInput = Record<string, any>;

export interface BudgetProfileInput {
  rut?: string | null;
}

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})/;
const DDMMAAAA = /^\d{2}-\d{2}-\d{4}$/;

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

/** 'YYYY-MM-DD[...]' or 'DD-MM-AAAA' → 'DD-MM-AAAA'; anything else comes back untouched. */
export function toDDMMAAAA(value: string): string {
  const match = DATE_ONLY.exec(value);
  if (match) return `${match[3]}-${match[2]}-${match[1]}`;
  return value;
}

/**
 * Adds calendar days to a date-only string and formats it DD-MM-AAAA. Works on UTC calendar days
 * so the process time zone (Chile is behind UTC) can never shift the result by one day.
 */
export function addDaysDDMMAAAA(value: string, days: number): string {
  let year: number;
  let month: number;
  let day: number;
  const iso = DATE_ONLY.exec(value);
  if (iso) {
    [year, month, day] = [Number(iso[1]), Number(iso[2]), Number(iso[3])];
  } else if (DDMMAAAA.test(value)) {
    [day, month, year] = [
      Number(value.slice(0, 2)),
      Number(value.slice(3, 5)),
      Number(value.slice(6, 10)),
    ];
  } else {
    return "";
  }
  const shifted = new Date(Date.UTC(year!, month! - 1, day! + days));
  if (Number.isNaN(shifted.getTime())) return "";
  return `${pad(shifted.getUTCDate())}-${pad(shifted.getUTCMonth() + 1)}-${shifted.getUTCFullYear()}`;
}

function pick(order: BudgetOrderInput, key: string): unknown {
  const fromMeta = order.metadata?.[key];
  if (fromMeta !== undefined && fromMeta !== null && fromMeta !== "")
    return fromMeta;
  const top = order[key];
  return top === undefined || top === null ? undefined : top;
}

function text(value: unknown): string {
  return typeof value === "string"
    ? value.trim()
    : value === undefined || value === null
      ? ""
      : String(value).trim();
}

function amount(value: unknown): number {
  const parsed =
    typeof value === "number" ? value : parseFloat(String(value ?? ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

function discountPercent(order: BudgetOrderInput): number | undefined {
  const lines: BudgetOrderInput[] = Array.isArray(order.coupon_lines)
    ? order.coupon_lines
    : [];
  const percentCoupon = lines.find((line) => line?.discount_type === "percent");
  if (!percentCoupon) return undefined;
  const pct = amount(
    percentCoupon.metadata?.coupon_amount ?? percentCoupon.amount,
  );
  return pct > 0 ? pct : undefined;
}

function formatPct(pct: number): string {
  return String(pct).replace(".", ",");
}

/** Single place that turns an order (+ the client's profile) into what the budget PDF prints. */
export function buildBudgetDocumentData(
  order: BudgetOrderInput,
  profile?: BudgetProfileInput | null,
  now: Date = new Date(),
): BudgetDocumentData {
  const billing: BudgetOrderInput = order.billing ?? {};
  const flat = (key: string): string =>
    text(billing[key] ?? order[`billing_${key}`]);

  const jornadasParsed = parseInt(
    String(pick(order, "num_jornadas") ?? "1"),
    10,
  );
  const numJornadas =
    Number.isFinite(jornadasParsed) && jornadasParsed >= 1 ? jornadasParsed : 1;

  const lineItems: LineItem[] = (
    Array.isArray(order.line_items) ? order.line_items : []
  ).map((item: BudgetOrderInput) => ({
    name: text(item.name),
    ...(item.sku ? { sku: String(item.sku) } : {}),
    price: amount(item.price),
    quantity: amount(item.quantity),
  }));

  const startRaw = text(pick(order, "order_fecha_inicio"));
  const endRaw = text(pick(order, "order_fecha_termino"));

  const calculatedSubtotal = amount(pick(order, "calculated_subtotal"));
  const calculatedIva = amount(pick(order, "calculated_iva"));
  const calculatedTotal = amount(pick(order, "calculated_total"));
  const discountAmount = Math.max(
    0,
    amount(pick(order, "calculated_discount")),
  );

  const shippingLines: BudgetOrderInput[] = Array.isArray(order.shipping_lines)
    ? order.shipping_lines
    : [];
  const shippingTotal = Math.max(
    0,
    amount(shippingLines[0]?.total ?? pick(order, "shipping_total")),
  );

  const breakdown = orderBreakdown({
    lineItems,
    jornadas: numJornadas,
    discount: discountAmount,
    shippingTotal,
    calculatedSubtotal,
    calculatedIva,
  });

  const reserve = reserveAmount({
    total: calculatedTotal,
    reserveType: order.reserve_type,
    reserveValue: order.reserve_value,
  });

  const pct = discountPercent(order);
  const retire = text(pick(order, "order_retire_name"));

  return {
    orderId: Number(order.id ?? order.order_id),
    issueDate: `${pad(now.getDate())}-${pad(now.getMonth() + 1)}-${now.getFullYear()}`,
    client: {
      name: `${flat("first_name")} ${flat("last_name")}`.trim(),
      email: flat("email"),
      rut: text(profile?.rut) || text(billing.rut),
      company: flat("company"),
      phone: flat("phone"),
    },
    reservation: {
      title: text(pick(order, "order_proyecto")) || "Proyecto de Arriendo",
      startDate: toDDMMAAAA(startRaw),
      endDate: toDDMMAAAA(endRaw),
      retireLabel: retire || "El cliente",
      returnDate: addDaysDDMMAAAA(endRaw, 1),
    },
    note: text(pick(order, "order_comments")),
    numJornadas,
    lineItems,
    discount: {
      amount: discountAmount,
      ...(pct !== undefined && discountAmount > 0 ? { pct } : {}),
      label:
        pct !== undefined && discountAmount > 0
          ? `Descuento ${formatPct(pct)}%`
          : "Descuento",
    },
    shipping: { label: "Móvil rental", total: shippingTotal },
    totals: {
      productsNet: breakdown.products.net,
      subtotal: calculatedSubtotal,
      iva: calculatedIva,
      total: calculatedTotal,
      reserve,
      reserveLabel: reserveLabel(order.reserve_type, order.reserve_value),
      balance: Math.max(0, calculatedTotal - reserve),
    },
  };
}
