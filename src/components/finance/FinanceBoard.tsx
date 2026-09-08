import React, { useMemo, useState } from 'react';
import { Search } from 'lucide-react';
import { formatCLP } from '../../lib/delivery';
import type { FinanceBoard as FinanceBoardData, FinanceRow } from '../../services/financeService';

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

type Tab = 'pendientes' | 'pagados' | 'finanzas';

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: 'pendientes', label: 'Pendientes' },
  { value: 'pagados', label: 'Pagados' },
  { value: 'finanzas', label: 'Finanzas' },
];

function formatDay(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

function matches(row: FinanceRow, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    row.reference.toLowerCase().includes(n) ||
    row.client.toLowerCase().includes(n) ||
    row.project.toLowerCase().includes(n) ||
    (row.invoiceNumber ?? '').toLowerCase().includes(n)
  );
}

function Kpi({ label, value, meta, tone }: { label: string; value: string; meta: string; tone?: string }) {
  return (
    <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <div className="text-xs text-[var(--color-text-secondary)]">{label}</div>
      <div className={`mt-1 font-mono text-xl font-semibold ${tone ?? ''}`}>{value}</div>
      <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">{meta}</div>
    </div>
  );
}

export default function FinanceBoard({ data, periodLabel }: FinanceBoardProps) {
  const [tab, setTab] = useState<Tab>('pendientes');
  const [search, setSearch] = useState('');

  const pendingRows = useMemo(
    () => data.pendingRows.filter(r => matches(r, search.trim())),
    [data.pendingRows, search]
  );
  const paidRows = useMemo(
    () => data.paidRows.filter(r => matches(r, search.trim())),
    [data.paidRows, search]
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div
          role="tablist"
          aria-label="Vistas de cobranza"
          className="flex gap-0.5 border-b border-[var(--color-border)]"
        >
          {TABS.map(item => (
            <button
              key={item.value}
              role="tab"
              type="button"
              aria-selected={tab === item.value}
              onClick={() => setTab(item.value)}
              className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
                tab === item.value
                  ? 'border-[var(--color-text-primary)] font-medium text-[var(--color-text-primary)]'
                  : 'border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-text-secondary)]">{periodLabel}</span>
      </div>

      {tab !== 'finanzas' && (
        <div className="relative max-w-sm">
          <Search
            className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
            aria-hidden="true"
          />
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={tab === 'pendientes' ? 'Buscar en pendientes' : 'Buscar en pagados'}
            aria-label={tab === 'pendientes' ? 'Buscar en pendientes' : 'Buscar en pagados'}
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
          />
        </div>
      )}

      {tab === 'pendientes' && (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              label="Monto Pendiente"
              value={formatCLP(data.pending.montoPendiente)}
              meta={`${data.pending.documentosPendientes} documentos`}
            />
            <Kpi
              label="Pedidos Pendientes"
              value={String(data.pending.pedidosPendientes)}
              meta="Órdenes de arriendo"
            />
            <Kpi
              label="Reservas Pendientes"
              value={String(data.pending.reservasPendientes)}
              meta={formatCLP(data.pending.montoReservasPendientes)}
              tone="text-[var(--color-warn)]"
            />
            <Kpi
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
                  Facturas pendientes de cobro: cliente, total, reserva, saldo y estado de pago
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">ID Pedido</th>
                    <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                    <th scope="col" className="px-3 py-2 font-medium">Proyecto</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Reserva 25%</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Saldo Pendiente</th>
                    <th scope="col" className="px-3 py-2 font-medium">OC</th>
                    <th scope="col" className="px-3 py-2 font-medium">Factura</th>
                    <th scope="col" className="px-3 py-2 font-medium">Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.length === 0 && (
                    <tr>
                      <td colSpan={9} className="p-8 text-center text-[var(--color-text-secondary)]">
                        {search ? 'Ningún documento coincide con la búsqueda.' : 'No hay cobros pendientes.'}
                      </td>
                    </tr>
                  )}
                  {pendingRows.map(row => (
                    <tr
                      key={row.id}
                      className={`border-b border-[var(--color-border-soft)] ${
                        row.overdue ? 'bg-[var(--color-crit-bg)]' : ''
                      }`}
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <a href={`/orders/${row.id}`} className="underline underline-offset-2">
                          {row.reference}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.client}</td>
                      <td className="max-w-[180px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.project}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">{formatCLP(row.total)}</td>
                      <td className="px-3 py-2 text-right font-mono text-[var(--color-text-secondary)]">
                        {formatCLP(row.reserve)}
                      </td>
                      <td className="px-3 py-2 text-right font-mono font-semibold">
                        {formatCLP(row.outstanding)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.purchaseOrder || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.invoiceNumber || '—'}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={`rounded-full px-2 py-0.5 text-[10px] ${
                            row.overdue
                              ? 'bg-[var(--color-crit-bg)] text-[var(--color-crit)]'
                              : row.reservePaid
                                ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]'
                                : 'bg-[var(--color-warn-bg)] text-[var(--color-warn)]'
                          }`}
                        >
                          {row.overdue ? 'Vencido' : row.reservePaid ? 'Reserva pagada' : 'Sin reserva'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'pagados' && (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi
              label="Cobrado Período"
              value={formatCLP(data.paid.cobradoPeriodo)}
              meta="Pagos completos"
              tone="text-[var(--color-ok)]"
            />
            <Kpi label="Pedidos Pagados" value={String(data.paid.pedidosPagados)} meta="Cerrados" />
            <Kpi label="Ticket Promedio" value={formatCLP(data.paid.ticketPromedio)} meta="Por pedido" />
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Facturas pagadas: cliente, fecha de pago, total y documentos asociados
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">ID Pedido</th>
                    <th scope="col" className="px-3 py-2 font-medium">Cliente</th>
                    <th scope="col" className="px-3 py-2 font-medium">Proyecto</th>
                    <th scope="col" className="px-3 py-2 font-medium">Fecha Pago</th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">Total</th>
                    <th scope="col" className="px-3 py-2 font-medium">OC</th>
                    <th scope="col" className="px-3 py-2 font-medium">Factura</th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.length === 0 && (
                    <tr>
                      <td colSpan={7} className="p-8 text-center text-[var(--color-text-secondary)]">
                        {search ? 'Ningún documento coincide con la búsqueda.' : 'Todavía no hay pagos registrados.'}
                      </td>
                    </tr>
                  )}
                  {paidRows.map(row => (
                    <tr key={row.id} className="border-b border-[var(--color-border-soft)]">
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <a href={`/orders/${row.id}`} className="underline underline-offset-2">
                          {row.reference}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.client}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.project}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">{formatDay(row.paidAt)}</td>
                      <td className="px-3 py-2 text-right font-mono">{formatCLP(row.total)}</td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.purchaseOrder || '—'}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.invoiceNumber || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {tab === 'finanzas' && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Ingresos Período"
              value={formatCLP(data.summary.ingresosPeriodo)}
              meta="Facturado, sin cancelados"
            />
            <Kpi
              label="Cobros Recibidos"
              value={formatCLP(data.summary.cobrosRecibidos)}
              meta="Reservas incluidas"
              tone="text-[var(--color-ok)]"
            />
            <Kpi
              label="Por Cobrar"
              value={formatCLP(data.summary.porCobrar)}
              meta="Diferencia"
              tone="text-[var(--color-warn)]"
            />
            <Kpi
              label="Tasa de Cobranza"
              value={`${data.summary.tasaCobranza}%`}
              meta="Cobrado sobre facturado"
            />
          </div>

          <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
            <h2 className="mb-3 text-sm font-semibold">Composición del período</h2>
            <div
              className="h-3 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
              role="img"
              aria-label={`Cobrado ${data.summary.tasaCobranza}% de lo facturado`}
            >
              <div
                className="h-full bg-[var(--color-ok)]"
                style={{ width: `${Math.min(100, Math.max(0, data.summary.tasaCobranza))}%` }}
              />
            </div>
            <p className="mt-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
              La reserva del 25% cuenta como cobro recibido en cuanto entra, porque es dinero en
              caja. El saldo restante sigue en Por Cobrar hasta que el pedido queda pagado
              completo — mezclar ambos haría desaparecer tres cuartas partes de la deuda.
            </p>
          </section>
        </div>
      )}
    </div>
  );
}
