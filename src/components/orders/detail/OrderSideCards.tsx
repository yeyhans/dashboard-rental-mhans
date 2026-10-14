import type { ReactNode } from "react";
import {
  ArrowRight,
  Calendar,
  Hash,
  Mail,
  Phone,
  Receipt,
  User,
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { formatCLP } from "../../../lib/delivery";
import {
  jornadasLabel,
  rentalDateParts,
  type BalanceTone,
  type OrderFinancialSummary,
  type OrderPaymentSummary,
} from "../orderDetail";
import { DetailCard } from "./DetailCard";

/**
 * Canon RC2.1.2 aside cards of the order detail screen (`.actions-card`, `.client-card`,
 * `.dates-grid`, `.ep-card`, `.fin-rows`) plus the main-column `.nota-block`. Presentational
 * only: every value and handler comes from `ProcessOrder`.
 */

const ICON = "h-3.5 w-3.5";

/* ------------------------------------------------------------------------------------------ */

export function OrderActionsCard({
  primary,
  secondary,
  note,
}: {
  primary?: {
    label: string;
    icon?: ReactNode;
    onClick: () => void;
    disabled?: boolean;
  };
  secondary?: ReactNode;
  note?: string;
}) {
  return (
    <DetailCard
      title="Acciones"
      icon={<ArrowRight className={ICON} aria-hidden="true" />}
      bodyClassName="p-3"
    >
      {primary && (
        <button
          type="button"
          onClick={primary.onClick}
          disabled={primary.disabled}
          className="mb-2 flex w-full items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-text-primary)] px-[14px] py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-[var(--color-ink-hover)] disabled:opacity-50"
        >
          {primary.icon}
          {primary.label}
        </button>
      )}
      {secondary && (
        <div className="flex gap-1.5 [&>*]:flex-1 [&>*]:justify-center">
          {secondary}
        </div>
      )}
      {note && (
        <p className="mb-0 mt-2 text-center text-[10px] leading-normal text-[var(--color-text-faint)]">
          {note}
        </p>
      )}
    </DetailCard>
  );
}

/* ------------------------------------------------------------------------------------------ */

function ClientField({
  icon,
  children,
}: {
  icon: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-[7px] break-all text-[11px] text-[var(--color-text-secondary)]">
      {icon}
      {children}
    </div>
  );
}

export function OrderClientCard({
  name,
  company,
  email,
  phone,
  customerId,
  rut,
}: {
  name: string;
  company?: string | null;
  email?: string | null;
  phone?: string | null;
  customerId?: string | null;
  rut?: string | null;
}) {
  return (
    <DetailCard
      title="Cliente"
      icon={<User className={ICON} aria-hidden="true" />}
      bodyClassName="flex flex-col gap-1.5 px-[14px] py-3"
    >
      <div className="text-sm font-semibold text-[var(--color-text-primary)]">
        {name || "Sin nombre"}
      </div>
      {company && (
        <div className="mb-1 text-[11px] text-[var(--color-text-faint)]">
          {company}
        </div>
      )}
      {email && (
        <ClientField icon={<Mail className={ICON} aria-hidden="true" />}>
          {email}
        </ClientField>
      )}
      {phone && (
        <ClientField icon={<Phone className={ICON} aria-hidden="true" />}>
          {phone}
        </ClientField>
      )}
      {rut && (
        <ClientField icon={<Receipt className={ICON} aria-hidden="true" />}>
          <span>
            RUT empresa <span className="font-mono">{rut}</span>
          </span>
        </ClientField>
      )}
      {customerId && (
        <ClientField icon={<Hash className={ICON} aria-hidden="true" />}>
          <span>
            ID cliente <span className="font-mono">{customerId}</span>
          </span>
        </ClientField>
      )}
    </DetailCard>
  );
}

/* ------------------------------------------------------------------------------------------ */

function DateItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  const parts = rentalDateParts(value);
  return (
    <div>
      <div className="mb-[3px] text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
        {label}
      </div>
      <div className="text-xs font-semibold text-[var(--color-text-primary)]">
        {parts.date}
      </div>
      {parts.weekday && (
        <div className="text-[10px] text-[var(--color-text-secondary)]">
          {parts.weekday}
        </div>
      )}
    </div>
  );
}

export function OrderDatesCard({
  start,
  end,
  jornadas,
}: {
  start?: string | null;
  end?: string | null;
  jornadas?: unknown;
}) {
  const duration = jornadasLabel(jornadas);
  return (
    <DetailCard
      title="Fechas del Arriendo"
      icon={<Calendar className={ICON} aria-hidden="true" />}
      bodyClassName="grid grid-cols-2 gap-2.5 px-[14px] py-3"
    >
      <DateItem label="Inicio rodaje" value={start} />
      <DateItem label="Término rodaje" value={end} />
      {duration && (
        <div className="col-span-2">
          <div className="mb-[3px] text-[10px] uppercase tracking-[0.08em] text-[var(--color-text-faint)]">
            Duración
          </div>
          <span className="mt-1.5 inline-flex items-center gap-[5px] rounded bg-[var(--color-text-primary)] px-2 py-[3px] text-[11px] font-semibold text-white">
            <Calendar className={ICON} aria-hidden="true" />
            {duration}
          </span>
        </div>
      )}
    </DetailCard>
  );
}

/* ------------------------------------------------------------------------------------------ */

const TONE_TEXT: Record<BalanceTone, string> = {
  ok: "text-[var(--color-ok)]",
  warn: "text-[var(--color-warn)]",
  crit: "text-[var(--color-crit)]",
};

function EpRow({ label, children }: { label: ReactNode; children: ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-[var(--color-border-soft)] py-[7px] last:border-b-0">
      <div className="text-[11px] text-[var(--color-text-secondary)]">
        {label}
      </div>
      <div className="text-right">{children}</div>
    </div>
  );
}

export function OrderPaymentCard({
  statusLabel,
  summary,
  paymentMethod,
  transactionId,
  children,
}: {
  statusLabel: string;
  summary: OrderPaymentSummary;
  paymentMethod?: string | null;
  transactionId?: string | null;
  /** Extra content under the rows (return report, reserve editor). */
  children?: ReactNode;
}) {
  return (
    <DetailCard title="Estado del Pedido" noPad>
      <div className="px-[14px] py-3">
        <div className="mb-3 text-[13px] font-bold uppercase tracking-[0.04em] text-[var(--color-text-primary)]">
          {statusLabel}
        </div>
        <EpRow label={summary.reserveLabel}>
          <div className="font-mono text-xs font-semibold text-[var(--color-ok)]">
            {formatCLP(summary.reserveAmount)}
          </div>
          <span
            className={cn(
              "mt-[3px] inline-flex items-center rounded-[10px] px-[7px] py-px text-[10px] font-semibold",
              summary.tag === "pagado"
                ? "bg-[var(--color-ok-bg)] text-[var(--color-ok)]"
                : "bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
            )}
          >
            {summary.tag === "pagado" ? "Pagado" : "Pendiente"}
          </span>
        </EpRow>
        <EpRow label="Saldo pendiente">
          <div
            className={cn(
              "font-mono text-xs font-semibold",
              TONE_TEXT[summary.balanceTone],
            )}
          >
            {summary.balance > 0 ? formatCLP(summary.balance) : "—"}
          </div>
        </EpRow>
        {paymentMethod && (
          <EpRow label="Método de pago">
            <div className="text-xs text-[var(--color-text-primary)]">
              {paymentMethod}
            </div>
          </EpRow>
        )}
        {transactionId && (
          <EpRow label="ID transacción">
            <div className="break-all font-mono text-[11px] text-[var(--color-text-primary)]">
              {transactionId}
            </div>
          </EpRow>
        )}
        {children}
      </div>
      <div className="border-t border-[var(--color-border-soft)] px-[14px] py-2 text-center text-[10px] italic text-[var(--color-text-faint)]">
        Valores incluyen IVA (19%)
      </div>
    </DetailCard>
  );
}

/* ------------------------------------------------------------------------------------------ */

function FinRow({
  label,
  value,
  className,
  labelClassName,
  valueClassName,
}: {
  label: ReactNode;
  value: ReactNode;
  className?: string;
  labelClassName?: string;
  valueClassName?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-between gap-3 border-b border-[var(--color-border-soft)] px-[14px] py-[7px] last:border-b-0",
        className,
      )}
    >
      <span
        className={cn(
          "text-[11px] text-[var(--color-text-secondary)]",
          labelClassName,
        )}
      >
        {label}
      </span>
      <span className={cn("font-mono text-xs font-medium", valueClassName)}>
        {value}
      </span>
    </div>
  );
}

const MUTED_VALUE = "font-normal text-[var(--color-text-faint)]";

export function OrderFinancialCard({
  summary,
  couponCodes = [],
  footer,
}: {
  summary: OrderFinancialSummary;
  couponCodes?: readonly string[];
  footer?: ReactNode;
}) {
  return (
    <DetailCard
      title="Resumen Financiero"
      icon={<Receipt className={ICON} aria-hidden="true" />}
      noPad
    >
      <div className="flex flex-col">
        <FinRow
          label="Subtotal arriendo"
          value={formatCLP(summary.productsSubtotal)}
        />
        <FinRow
          label={
            <span>
              Descuento
              {couponCodes.map((code) => (
                <span
                  key={code}
                  className="ml-1.5 rounded-[3px] bg-[var(--color-surface-2)] px-1.5 py-px font-mono text-[10px] text-[var(--color-text-faint)]"
                >
                  {code}
                </span>
              ))}
            </span>
          }
          value={
            summary.discount > 0 ? `− ${formatCLP(summary.discount)}` : "$0"
          }
          valueClassName={
            summary.discount > 0 ? "text-[var(--color-ok)]" : MUTED_VALUE
          }
        />
        <FinRow
          label="Delivery"
          value={summary.shipping > 0 ? formatCLP(summary.shipping) : "$0"}
          valueClassName={summary.shipping > 0 ? undefined : MUTED_VALUE}
        />
        <div
          aria-hidden="true"
          className="my-0.5 h-px bg-[var(--color-border)]"
        />
        <FinRow
          label="Subtotal"
          value={formatCLP(summary.net)}
          className="bg-[var(--color-surface-2)]"
        />
        <FinRow
          label="IVA (19%)"
          value={formatCLP(summary.iva)}
          valueClassName={MUTED_VALUE}
        />
        <FinRow
          label="TOTAL"
          value={formatCLP(summary.total)}
          className="border-t-2 border-t-[var(--color-border)] bg-[var(--color-surface-2)]"
          labelClassName="text-[13px] font-bold text-[var(--color-text-primary)]"
          valueClassName="text-[15px] font-bold text-[var(--color-text-primary)]"
        />
      </div>
      {footer && (
        <div className="border-t border-[var(--color-border-soft)] px-[14px] py-2 text-center text-[10px] text-[var(--color-text-faint)]">
          {footer}
        </div>
      )}
    </DetailCard>
  );
}

/* ------------------------------------------------------------------------------------------ */

export function OrderNoteBlock({ text }: { text?: string | null }) {
  if (!text || text.trim() === "") return null;
  return (
    <div className="rounded-[var(--radius-lg)] border border-[var(--color-border)] bg-[var(--color-surface-soft)] px-[14px] py-3">
      <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.1em] text-[var(--color-text-faint)]">
        Nota interna
      </div>
      <p className="m-0 whitespace-pre-line text-xs leading-relaxed text-[var(--color-text-secondary)]">
        {text}
      </p>
    </div>
  );
}
