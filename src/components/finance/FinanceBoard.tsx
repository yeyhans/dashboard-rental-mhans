import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Download,
  Package,
  Percent,
  PiggyBank,
  Receipt,
  Search,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCLP } from "../../lib/delivery";
import type {
  FinanceBoard as FinanceBoardData,
  FinanceRow,
} from "../../services/financeService";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { StatusBadge } from "../shared/StatusBadge";
import { Button } from "../ui/button";
import { financePaymentTone } from "./financePaymentTone";
import { financeRowsToCsv, formatDay } from "./financeExport";
import { businessDay } from "../../lib/businessDay";

/** UTF-8 BOM so Excel opens the CSV with the right encoding instead of mangling accents. */
const CSV_BOM = "﻿";

/**
 * Finanzas & Cobranza.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Finanzas_Cobranza_Canonical_RC2.1.4.html`: tres
 * pestañas — Pendientes, Pagados, Finanzas — cada una con su fila de indicadores y su tabla.
 * RC2.1.2 se comparó con RC2.1.4 y tienen el mismo contenido; manda la revisión más nueva.
 */
interface FinanceBoardProps {
  data: FinanceBoardData;
  periodLabel: string;
}

type Tab = "pendientes" | "pagados" | "finanzas";

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "pendientes", label: "Pendientes" },
  { value: "pagados", label: "Pagados" },
  { value: "finanzas", label: "Finanzas" },
];

function matches(row: FinanceRow, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    row.reference.toLowerCase().includes(n) ||
    row.client.toLowerCase().includes(n) ||
    row.project.toLowerCase().includes(n) ||
    (row.invoiceNumber ?? "").toLowerCase().includes(n)
  );
}

/** Thin wrapper over the shared KpiCard: keeps the D-10 tone-colored value, icon and footer meta. */
function Kpi({
  icon,
  label,
  value,
  meta,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta: string;
  tone?: string;
}) {
  return (
    <KpiCard
      icon={icon}
      label={label}
      value={<span className={tone}>{value}</span>}
      footer={meta}
    />
  );
}

export default function FinanceBoard({ data, periodLabel }: FinanceBoardProps) {
  const [tab, setTab] = useState<Tab>("pendientes");
  const [search, setSearch] = useState("");

  const pendingRows = useMemo(
    () => data.pendingRows.filter((r) => matches(r, search.trim())),
    [data.pendingRows, search],
  );
  const paidRows = useMemo(
    () => data.paidRows.filter((r) => matches(r, search.trim())),
    [data.paidRows, search],
  );

  // D-10: "Exportar" descarga en CSV, sin dependencias nuevas, las filas ya cargadas/filtradas de
  // la pestaña activa. Sin selector de período ni "Filtros": la consulta trae todo pedido no
  // cancelado sin acotar por fecha (ver FinanceService), así que un selector de período o un botón
  // "Filtros" sin una query que los respalde sería un control decorativo — queda abierto.
  const handleExport = () => {
    if (typeof window === "undefined" || tab === "finanzas") return;
    const rows = tab === "pendientes" ? pendingRows : paidRows;
    const csv = financeRowsToCsv(rows, tab);
    // D-16: BOM so Excel reads accents correctly; the file's date is the Chilean business day,
    // not the server's UTC one (R3-104, same rule as `businessDay.ts`).
    const blob = new Blob([CSV_BOM + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const today = businessDay(new Date());
    link.href = url;
    link.download = `finanzas-${tab}-${today}.csv`;
    // Attached to the DOM before the click, same reason as F-04/D-13's warning: Firefox and
    // Safari can silently ignore `click()` on a detached anchor. Revoking the object URL is
    // deferred so the browser has started the download before the URL is invalidated.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finanzas & Cobranza"
        subtitle="¿Cuánto dinero ingresó y qué dinero falta cobrar?"
        date={periodLabel}
        actions={
          tab !== "finanzas" ? (
            <Button variant="outline" size="sm" onClick={handleExport}>
              <Download className="mr-1 h-3.5 w-3.5" />
              Exportar
            </Button>
          ) : undefined
        }
      />

      <div
        role="tablist"
        aria-label="Vistas de cobranza"
        className="flex gap-0.5 border-b border-[var(--color-border)]"
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
              tab === item.value
                ? "border-[var(--color-text-primary)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== "finanzas" && (
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={
              tab === "pendientes"
                ? "Buscar en pendientes"
                : "Buscar en pagados"
            }
            aria-label={
              tab === "pendientes"
                ? "Buscar en pendientes"
                : "Buscar en pagados"
            }
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
          />
        </div>
      )}

      {tab === "pendientes" && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Wallet}
              label="Monto Pendiente"
              value={formatCLP(data.pending.montoPendiente)}
              meta={`${data.pending.documentosPendientes} documentos`}
            />
            <Kpi
              icon={Package}
              label="Pedidos Pendientes"
              value={String(data.pending.pedidosPendientes)}
              meta="Órdenes de arriendo"
            />
            <Kpi
              icon={PiggyBank}
              label="Reservas Pendientes"
              value={String(data.pending.reservasPendientes)}
              meta={formatCLP(data.pending.montoReservasPendientes)}
              tone="text-[var(--color-warn)]"
            />
            <Kpi
              icon={AlertTriangle}
              label="Pagos Vencidos"
              value={formatCLP(data.pending.montoVencido)}
              meta={`${data.pending.documentosVencidos} documentos`}
              tone="text-[var(--color-crit)]"
            />
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Facturas pendientes de cobro: cliente, total, reserva, saldo y
                  estado de pago
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">
                      ID Pedido
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Proyecto
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Reserva
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Saldo Pendiente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      OC
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Factura
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Pago
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={9}
                        className="p-8 text-center text-[var(--color-text-secondary)]"
                      >
                        {search
                          ? "Ningún documento coincide con la búsqueda."
                          : "No hay cobros pendientes."}
                      </td>
                    </tr>
                  )}
                  {pendingRows.map((row) => {
                    const payment = financePaymentTone(row);
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--color-border-soft)]"
                      >
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <a
                            href={`/orders/${row.id}`}
                            className="underline underline-offset-2"
                          >
                            {row.reference}
                          </a>
                        </td>
                        <td className="px-3 py-2">{row.client}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                          {row.project}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCLP(row.total)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)]">
                          {formatCLP(row.reserve)}
                        </td>
                        <td className="px-3 py-2 text-right font-mono font-semibold">
                          {formatCLP(row.outstanding)}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                          {row.purchaseOrder || "—"}
                        </td>
                        <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                          {row.invoiceNumber || "—"}
                        </td>
                        <td className="px-3 py-2">
                          <StatusBadge
                            tone={payment.tone}
                            label={payment.label}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "pagados" && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi
              icon={CheckCircle2}
              label="Cobrado Período"
              value={formatCLP(data.paid.cobradoPeriodo)}
              meta="Pagos completos"
              tone="text-[var(--color-ok)]"
            />
            <Kpi
              icon={Package}
              label="Pedidos Pagados"
              value={String(data.paid.pedidosPagados)}
              meta="Cerrados"
            />
            <Kpi
              icon={Receipt}
              label="Ticket Promedio"
              value={formatCLP(data.paid.ticketPromedio)}
              meta="Por pedido"
            />
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Facturas pagadas: cliente, fecha de pago, total y documentos
                  asociados
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">
                      ID Pedido
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Proyecto
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Fecha Pago
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      OC
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Factura
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={7}
                        className="p-8 text-center text-[var(--color-text-secondary)]"
                      >
                        {search
                          ? "Ningún documento coincide con la búsqueda."
                          : "Todavía no hay pagos registrados."}
                      </td>
                    </tr>
                  )}
                  {paidRows.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-border-soft)]"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <a
                          href={`/orders/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {row.reference}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.client}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.project}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {formatDay(row.paidAt)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCLP(row.total)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.purchaseOrder || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.invoiceNumber || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === "finanzas" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={TrendingUp}
              label="Ingresos Período"
              value={formatCLP(data.summary.ingresosPeriodo)}
              meta="Facturado, sin cancelados"
            />
            <Kpi
              icon={CheckCircle2}
              label="Cobros Recibidos"
              value={formatCLP(data.summary.cobrosRecibidos)}
              meta="Reservas incluidas"
              tone="text-[var(--color-ok)]"
            />
            <Kpi
              icon={Clock}
              label="Por Cobrar"
              value={formatCLP(data.summary.porCobrar)}
              meta="Diferencia"
              tone="text-[var(--color-warn)]"
            />
            <Kpi
              icon={Percent}
              label="Tasa de Cobranza"
              value={`${data.summary.tasaCobranza}%`}
              meta="Cobrado sobre facturado"
            />
          </div>

          <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold">
              Composición del período
            </h2>
            <div
              className="h-3 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
              role="img"
              aria-label={`Cobrado ${data.summary.tasaCobranza}% de lo facturado`}
            >
              <div
                className="h-full bg-[var(--color-ok)]"
                style={{
                  width: `${Math.min(100, Math.max(0, data.summary.tasaCobranza))}%`,
                }}
              />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
              La reserva acordada en cada pedido cuenta como cobro recibido en
              cuanto entra, porque es dinero en caja. El saldo restante sigue en
              Por Cobrar hasta que el pedido queda pagado completo — mezclar
              ambos haría desaparecer esa parte de la deuda.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
