import type { ReactNode } from "react";
import { Image as ImageIcon } from "lucide-react";
import { formatCLP } from "../../../lib/delivery";
import type { OrderItemRow } from "../orderDetail";

export interface OrderItemsTableRow extends OrderItemRow {
  key: string;
  imageUrl?: string | undefined;
  /** Extra lines under the name: stock badge, availability conflicts. */
  details?: ReactNode;
}

const TH_CLASS =
  "whitespace-nowrap border-b border-[var(--color-border)] px-3 py-[7px] text-left font-mono text-[10px] font-normal uppercase tracking-[0.07em] text-[var(--color-text-faint)]";
const TD_CLASS =
  "border-b border-[var(--color-border-soft)] px-3 py-2.5 align-middle";

/**
 * Canon RC2.1.2 `.prod-tbl`. The canon "Categoría" column is omitted: `line_items` stores no
 * category. Up to 768px the rows stack as label/value cards (`.order-items-table` in
 * `globals.css`, labels from `data-label`).
 */
export function OrderItemsTable({
  rows,
  total,
}: {
  rows: readonly OrderItemsTableRow[];
  total: number;
}) {
  return (
    <div className="order-items-table">
      <table className="w-full border-collapse text-xs">
        <caption className="sr-only">
          Detalle de equipos y productos del pedido, con cantidad, precio y
          subtotal
        </caption>
        <thead>
          <tr>
            <th scope="col" className={TH_CLASS}>
              SKU
            </th>
            <th scope="col" className={TH_CLASS}>
              Equipo / Producto
            </th>
            <th scope="col" className={`${TH_CLASS} text-center`}>
              Cant
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              Precio Unit.
            </th>
            <th scope="col" className={`${TH_CLASS} text-right`}>
              Subtotal
            </th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="transition-colors hover:bg-[#FAFAF2]">
              <td
                data-label="SKU"
                className={`${TD_CLASS} font-mono text-[11px] text-[var(--color-text-faint)]`}
              >
                {row.sku || "—"}
              </td>
              <td data-label="Equipo" className={TD_CLASS}>
                <div className="order-item-main flex items-start gap-2.5">
                  {row.imageUrl ? (
                    <img
                      src={row.imageUrl}
                      alt=""
                      loading="lazy"
                      className="h-9 w-9 flex-shrink-0 rounded-[var(--radius-sm)] border border-[var(--color-border)] object-cover"
                    />
                  ) : (
                    <span
                      aria-hidden="true"
                      className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-surface-2)]"
                    >
                      <ImageIcon className="h-4 w-4 text-[var(--color-text-faint)]" />
                    </span>
                  )}
                  <div className="min-w-0">
                    <div className="font-medium text-[var(--color-text-primary)]">
                      {row.name}
                    </div>
                    {row.details}
                  </div>
                </div>
              </td>
              <td data-label="Cant" className={`${TD_CLASS} text-center`}>
                {row.quantity}
              </td>
              <td
                data-label="Precio Unit."
                className={`${TD_CLASS} text-right font-mono`}
              >
                {formatCLP(row.unitPrice)}
              </td>
              <td
                data-label="Subtotal"
                className={`${TD_CLASS} text-right font-mono font-semibold`}
              >
                {formatCLP(row.subtotal)}
              </td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="order-items-total">
            <td
              colSpan={4}
              className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-right text-[11px] font-semibold text-[var(--color-text-faint)]"
            >
              Subtotal arriendo (neto)
            </td>
            <td className="border-t border-[var(--color-border)] bg-[var(--color-surface-2)] px-3 py-2.5 text-right font-mono text-[13px] font-bold text-[var(--color-text-primary)]">
              {formatCLP(total)}
            </td>
          </tr>
        </tfoot>
      </table>
    </div>
  );
}
