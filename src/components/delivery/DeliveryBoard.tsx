import React, { useMemo, useState } from 'react';
import { Search, Truck } from 'lucide-react';
import { SHIPMENT_STATUSES, formatCLP, shipmentLabel } from '../../lib/delivery';
import type { DeliveryBoard as DeliveryBoardData, ShipmentRow } from '../../services/deliveryService';

/**
 * Delivery.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Delivery_Canonical_RC2.1.3.html`: fila de
 * indicadores, tabla de delivery activos, tabla de tipos de envío, e historial con filtros y una
 * fila de totales.
 *
 * Dos columnas del canónico no se muestran: **Conductor** y **Pago Delivery**. `shipping_usage`
 * tiene doce columnas y ninguna de las dos existe; solo hay un `metadata` jsonb sin forma
 * acordada. Una columna inventada se vería vacía para siempre y se leería como datos faltantes en
 * vez de una función faltante, así que se omiten y queda constancia.
 */
interface DeliveryBoardProps {
  data: DeliveryBoardData;
}

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
  processing: 'bg-[var(--color-warn-bg)] text-[var(--color-warn)]',
  shipped: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  delivered: 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]',
  cancelled: 'bg-[var(--color-neutral-bg)] text-[var(--color-muted)]',
};

function statusPill(status: string): string {
  return STATUS_TONES[status] ?? 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]';
}

function formatDay(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

export default function DeliveryBoard({ data }: DeliveryBoardProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');

  const history = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.history.filter(row => {
      if (statusFilter !== 'todos' && row.status !== statusFilter) return false;
      if (typeFilter !== 'todos' && row.methodName !== typeFilter) return false;
      if (!needle) return true;
      return (
        row.orderReference.toLowerCase().includes(needle) ||
        row.client.toLowerCase().includes(needle) ||
        (row.trackingNumber ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data.history, search, statusFilter, typeFilter]);

  const variacion =
    data.kpis.variacionDiaria === null
      ? 'sin referencia'
      : `${data.kpis.variacionDiaria >= 0 ? '↑' : '↓'} ${Math.abs(data.kpis.variacionDiaria)}% vs ayer`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Envíos Hoy</div>
          <div className="font-mono text-2xl font-semibold">{data.kpis.enviosHoy}</div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">{variacion}</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Por Despachar</div>
          <div className="font-mono text-2xl font-semibold text-[var(--color-warn)]">
            {data.kpis.porDespachar}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">Pendientes de salida</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Entregados Hoy</div>
          <div className="font-mono text-2xl font-semibold text-[var(--color-ok)]">
            {data.kpis.entregadosHoy}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">Confirmados</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-1.5 text-xs text-[var(--color-text-secondary)]">Costo Delivery</div>
          <dl className="space-y-0.5 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Hoy</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoHoy)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Semana</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoSemana)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Mes</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoMes)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-baseline justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">Delivery activos</h2>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
            {data.active.length} {data.active.length === 1 ? 'activo' : 'activos'}
          </span>
        </div>
        {data.active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <Truck className="h-7 w-7 text-[var(--color-text-faint)]" aria-hidden="true" />
            <p className="text-xs text-[var(--color-text-secondary)]">
              No hay envíos en curso ahora mismo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th scope="col" className="px-4 py-2 font-medium">Pedido</th>
                  <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                  <th scope="col" className="px-4 py-2 font-medium">Proyecto</th>
                  <th scope="col" className="px-4 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.active.map(row => (
                  <ShipmentTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-baseline justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">Tipos de Envío</h2>
          <a href="/orders/shipping" className="text-xs underline underline-offset-2">
            Gestionar →
          </a>
        </div>
        {data.types.length === 0 ? (
          <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
            No hay métodos de envío configurados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th scope="col" className="px-4 py-2 font-medium">Tipo de Envío</th>
                  <th scope="col" className="px-4 py-2 font-medium">Descripción</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                </tr>
              </thead>
              <tbody>
                {data.types.map(type => (
                  <tr key={type.id} className="border-b border-[var(--color-border-soft)]">
                    <td className="px-4 py-2 font-medium">{type.name}</td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                      {type.description || '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatCLP(type.cost)}</td>
                    <td className="px-4 py-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${
                          type.enabled
                            ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]'
                            : 'bg-[var(--color-neutral-bg)] text-[var(--color-muted)]'
                        }`}
                      >
                        {type.enabled ? 'Activo' : 'Inactivo'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Historial de Envíos</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar envío, cliente o pedido"
                aria-label="Buscar envío, cliente o pedido"
                className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              aria-label="Filtrar por tipo de envío"
              className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
            >
              <option value="todos">Todos los tipos</option>
              {data.types.map(type => (
                <option key={type.id} value={type.name}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado del envío"
              className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
            >
              <option value="todos">Todos los estados</option>
              {SHIPMENT_STATUSES.map(status => (
                <option key={status} value={status}>
                  {shipmentLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-2 font-medium">Pedido</th>
                <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                <th scope="col" className="px-4 py-2 font-medium">Tipo de Envío</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                <th scope="col" className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--color-text-secondary)]">
                    No se encontraron envíos con los filtros aplicados.
                  </td>
                </tr>
              )}
              {history.map(row => (
                <tr key={row.id} className="border-b border-[var(--color-border-soft)]">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px]">
                    {formatDay(row.createdAt)}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px]">
                    <a href={`/orders/${row.orderId}`} className="underline underline-offset-2">
                      {row.orderReference}
                    </a>
                  </td>
                  <td className="px-4 py-2">{row.client}</td>
                  <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.methodName}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCLP(row.cost)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusPill(row.status)}`}>
                      {shipmentLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-[var(--color-border)] p-4">
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Total Envíos</div>
            <div className="font-mono text-base font-semibold">{data.totals.totalEnvios}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Costo Total</div>
            <div className="font-mono text-base font-semibold">{formatCLP(data.totals.costoTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Promedio por Envío</div>
            <div className="font-mono text-base font-semibold">
              {formatCLP(data.totals.promedioPorEnvio)}
            </div>
          </div>
        </div>

        <p className="border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          El canónico incluye además las columnas <strong>Conductor</strong> y{' '}
          <strong>Pago Delivery</strong>. <code>shipping_usage</code> no tiene ninguna de las dos:
          solo un <code>metadata</code> jsonb sin forma acordada. Se omiten hasta que el esquema
          las respalde — una columna vacía se lee como datos faltantes, no como una función que
          todavía no existe.
        </p>
      </section>
    </div>
  );
}

function ShipmentTableRow({ row }: { row: ShipmentRow }) {
  return (
    <tr className="border-b border-[var(--color-border-soft)]">
      <td className="px-4 py-2 font-mono text-[11px]">
        <a href={`/orders/${row.orderId}`} className="underline underline-offset-2">
          {row.orderReference}
        </a>
      </td>
      <td className="px-4 py-2">{row.client}</td>
      <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.project}</td>
      <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.methodName}</td>
      <td className="px-4 py-2 text-right font-mono">{formatCLP(row.cost)}</td>
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusPill(row.status)}`}>
          {shipmentLabel(row.status)}
        </span>
      </td>
    </tr>
  );
}
