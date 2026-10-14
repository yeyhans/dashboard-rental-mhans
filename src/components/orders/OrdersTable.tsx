import type { ComponentType } from "react";
import {
  ArrowRightLeft,
  ChevronRight,
  FileCheck,
  FileText,
  MoreHorizontal,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { StatusBadge } from "../shared/StatusBadge";
import { statusLabel } from "../../lib/orderStatus";
import {
  formatOrderDateWithWeekday,
  summarizeOrderProducts,
} from "../../lib/orderDateFormat";
import { toBadgeTone } from "./orderListMetrics";

/** The order fields the Pedidos table renders. `Order` satisfies it structurally. */
export interface OrdersTableRow {
  id: number;
  status: string;
  customer_id?: number | string | null;
  date_created?: string | null;
  billing_first_name?: string | null;
  billing_last_name?: string | null;
  billing_email?: string | null;
  order_proyecto?: string | null;
  order_fecha_inicio?: string | null;
  order_fecha_termino?: string | null;
  num_jornadas?: number | string | null;
  calculated_total?: number | string | null;
  calculated_iva?: number | string | null;
  calculated_subtotal?: number | string | null;
  line_items?: unknown;
  new_pdf_on_hold_url?: string | null;
  new_pdf_processing_url?: string | null;
}

/** CLP with dot thousands separators, no decimals (e.g. 119000 → "119.000"). */
export function formatCurrency(value: string | number | null | undefined) {
  const numValue = typeof value === "string" ? parseFloat(value) : value;
  if (numValue == null || Number.isNaN(numValue)) return "0";
  return Math.round(numValue)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/** Canon Jornadas cell: "1 día" / "N días"; empty when the count is missing or not a number. */
export function formatJornadas(
  value: number | string | null | undefined,
): string {
  if (value === null || value === undefined || value === "") return "";
  const days = Number(value);
  if (!Number.isFinite(days)) return "";
  return `${days} ${days === 1 ? "día" : "días"}`;
}

export interface OrderRowAction {
  id: string;
  label: string;
  group: "order" | "documents";
  icon: ComponentType<{ className?: string }>;
  onSelect: () => void;
}

interface OrderRowActionHandlers {
  onView: () => void;
  onChangeStatus: () => void;
  onOpenUrl: (url: string) => void;
}

/**
 * The ⋯ menu of one row: Ver pedido and Cambiar estado (opens ProcessOrder, as the status badge
 * click did before), then the PDFs the list already offered — latest budget first, each older
 * budget version, and the processing order.
 */
export function buildOrderRowActions(
  order: OrdersTableRow,
  { onView, onChangeStatus, onOpenUrl }: OrderRowActionHandlers,
): OrderRowAction[] {
  const actions: OrderRowAction[] = [
    {
      id: "view",
      label: "Ver pedido",
      group: "order",
      icon: ChevronRight,
      onSelect: onView,
    },
    {
      id: "status",
      label: "Cambiar estado",
      group: "order",
      icon: ArrowRightLeft,
      onSelect: onChangeStatus,
    },
  ];

  const budgetUrls = (order.new_pdf_on_hold_url ?? "")
    .split(",")
    .map((url) => url.trim())
    .filter(Boolean);
  const latest = budgetUrls[budgetUrls.length - 1];
  if (latest) {
    actions.push({
      id: "budget-latest",
      label:
        budgetUrls.length > 1
          ? `Presupuesto (v${budgetUrls.length}, más reciente)`
          : "Presupuesto",
      group: "documents",
      icon: FileText,
      onSelect: () => onOpenUrl(latest),
    });
    budgetUrls.slice(0, -1).forEach((url, index) => {
      actions.push({
        id: `budget-v${index + 1}`,
        label: `Presupuesto v${index + 1}`,
        group: "documents",
        icon: FileText,
        onSelect: () => onOpenUrl(url),
      });
    });
  }

  const processingUrl = order.new_pdf_processing_url?.trim();
  if (processingUrl) {
    actions.push({
      id: "processing",
      label: "Orden de proceso",
      group: "documents",
      icon: FileCheck,
      onSelect: () => onOpenUrl(processingUrl),
    });
  }

  return actions;
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener");
}

function OrderRowMenu({
  order,
  onChangeStatus,
}: {
  order: OrdersTableRow;
  onChangeStatus: () => void;
}) {
  const actions = buildOrderRowActions(order, {
    onView: () => openInNewTab(`/orders/${order.id}`),
    onChangeStatus,
    onOpenUrl: openInNewTab,
  });
  const orderActions = actions.filter((a) => a.group === "order");
  const documents = actions.filter((a) => a.group === "documents");

  const renderItem = ({ id, label, icon: Icon, onSelect }: OrderRowAction) => (
    <DropdownMenuItem key={id} onSelect={onSelect} className="text-xs">
      <Icon className="mr-2 h-3.5 w-3.5 text-muted-foreground" />
      {label}
    </DropdownMenuItem>
  );

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={`Acciones del pedido ${order.id}`}
        className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[5px] border border-border bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[230px]">
        {orderActions.map(renderItem)}
        {documents.length > 0 && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="pb-0.5 text-[9px] font-bold uppercase tracking-[0.06em] text-[var(--color-text-faint)]">
              Documentos
            </DropdownMenuLabel>
            {documents.map(renderItem)}
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const TH_CLASS =
  "whitespace-nowrap border-b border-border bg-[var(--color-surface-soft)] px-3 py-2 text-left font-mono text-[10px] font-normal uppercase tracking-[0.07em] text-[var(--color-text-faint)]";
const TD_CLASS =
  "border-b border-[var(--color-border-soft)] px-3 py-[11px] align-middle";

interface OrdersTableProps<T extends OrdersTableRow> {
  orders: readonly T[];
  /** Opens the ProcessOrder dialog for `order` (owned by the container). */
  onChangeStatus: (order: T) => void;
}

/**
 * Presentational Pedidos table (canon RC2.1.2 `.tbl`): bordered radius-10 frame, mono uppercase
 * header, 8 columns with the status badge stacked under the order number and a single ⋯ menu
 * per row. Data, filters and the status dialog stay in `OrdersDashboard`.
 */
export function OrdersTable<T extends OrdersTableRow>({
  orders,
  onChangeStatus,
}: OrdersTableProps<T>) {
  return (
    <div className="orders-table overflow-x-auto rounded-[10px] border border-border bg-background">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Listado de pedidos: cliente, proyecto, fechas de arriendo, monto y
          acciones
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH_CLASS}>
              Nº Pedido
            </th>
            <th scope="col" className={TH_CLASS}>
              Cliente
            </th>
            <th scope="col" className={TH_CLASS}>
              Proyecto
            </th>
            <th scope="col" className={TH_CLASS}>
              Inicio · Término
            </th>
            <th scope="col" className={TH_CLASS}>
              Jornadas
            </th>
            <th scope="col" className={TH_CLASS}>
              Monto
            </th>
            <th scope="col" className={TH_CLASS}>
              Productos
            </th>
            <th scope="col" className={`${TH_CLASS} sticky right-0`}>
              Acciones
            </th>
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => {
            const products = summarizeOrderProducts(order.line_items);
            return (
              <tr
                key={order.id}
                className="group transition-colors hover:bg-[#FAFAF2]"
              >
                <td data-label="Nº Pedido" className={TD_CLASS}>
                  <div className="flex flex-col items-start gap-1">
                    <span className="font-mono text-xs font-semibold text-foreground">
                      {order.id}
                    </span>
                    <StatusBadge
                      variant="canon"
                      tone={toBadgeTone(order.status)}
                      label={statusLabel(order.status)}
                    />
                  </div>
                </td>
                {/* Two-line cells keep one wrapper so the mobile card (flex row: label | value)
                    stacks the lines on the right instead of spreading them across the row. */}
                <td data-label="Cliente" className={TD_CLASS}>
                  <div>
                    <div className="font-medium text-foreground">
                      {`${order.billing_first_name ?? ""} ${order.billing_last_name ?? ""}`.trim()}
                    </div>
                    <div className="mt-px text-[10px] text-[var(--color-text-faint)]">
                      {order.billing_email}
                    </div>
                  </div>
                </td>
                <td
                  data-label="Proyecto"
                  className={`${TD_CLASS} font-medium text-foreground`}
                >
                  {order.order_proyecto ?? ""}
                </td>
                <td
                  data-label="Fechas"
                  className={`${TD_CLASS} whitespace-nowrap`}
                >
                  {order.order_fecha_inicio && order.order_fecha_termino ? (
                    <div>
                      <div className="text-[11px] text-foreground">
                        Inicio{" "}
                        <strong className="font-semibold">
                          {formatOrderDateWithWeekday(order.order_fecha_inicio)}
                        </strong>
                      </div>
                      <div className="text-[11px] text-[var(--color-text-faint)]">
                        Término{" "}
                        {formatOrderDateWithWeekday(order.order_fecha_termino)}
                      </div>
                    </div>
                  ) : (
                    <span className="text-[11px] text-[var(--color-text-faint)]">
                      Sin fechas
                    </span>
                  )}
                </td>
                <td
                  data-label="Jornadas"
                  className={`${TD_CLASS} whitespace-nowrap text-foreground`}
                >
                  {formatJornadas(order.num_jornadas)}
                </td>
                <td
                  data-label="Monto"
                  className={`${TD_CLASS} whitespace-nowrap`}
                >
                  <div>
                    <div className="font-semibold text-foreground">
                      {`$${formatCurrency(order.calculated_total)}`}
                    </div>
                    <div className="mt-px text-[10px] text-[var(--color-text-faint)]">
                      {`IVA $${formatCurrency(order.calculated_iva)} · Neto $${formatCurrency(order.calculated_subtotal)}`}
                    </div>
                  </div>
                </td>
                <td
                  data-label="Productos"
                  className={`${TD_CLASS} max-w-[14rem] truncate text-[11px] text-muted-foreground`}
                  title={products.title}
                >
                  {products.label || "-"}
                </td>
                <td
                  className={`${TD_CLASS} sticky right-0 bg-background text-right group-hover:bg-[#FAFAF2]`}
                >
                  <OrderRowMenu
                    order={order}
                    onChangeStatus={() => onChangeStatus(order)}
                  />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
