import React from 'react';
import { formatCLP } from '../../lib/delivery';
import type { ProfitabilityBoard as ProfitabilityBoardData } from '../../services/profitabilityService';

/**
 * Rentabilidad.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Rentabilidad_Canonical_RC2.1.2.html`: indicadores
 * económicos, evolución a doce meses, fila de métricas del período e "Inteligencia Económica".
 *
 * LA MITAD DEL MÓDULO NO TIENE DATOS DETRÁS. El canónico muestra Costos Directos, Gastos
 * Operacionales, Margen Bruto, Utilidad Operacional, ROI por activo y un formulario "Registrar
 * Gasto". El esquema `public` tiene doce tablas y ninguna registra un gasto ni el costo de
 * adquisición de un equipo — verificado por introspección, no supuesto. Esta vista calcula lo que
 * los datos sostienen y declara lo que falta, en vez de mostrar un cero que se lee como "no
 * gastamos nada".
 */
interface ProfitabilityBoardProps {
  data: ProfitabilityBoardData;
  periodLabel: string;
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return <span className="text-[11px] text-[var(--color-text-faint)]">sin referencia</span>;
  }
  const up = value >= 0;
  return (
    <span className={`text-[11px] ${up ? 'text-[var(--color-ok)]' : 'text-[var(--color-crit)]'}`}>
      {up ? '▲' : '▼'} {Math.abs(value)}% vs. mes anterior
    </span>
  );
}

function monthShort(key: string): string {
  const [, m] = key.split('-');
  return ['', 'Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'][
    Number(m)
  ] ?? key;
}

export default function ProfitabilityBoard({ data, periodLabel }: ProfitabilityBoardProps) {
  const peak = Math.max(1, ...data.series.map(m => m.ingresos));

  const metrics = [
    { label: 'Jornadas vendidas', value: String(data.current.jornadasVendidas), delta: data.deltas.jornadasVendidas },
    { label: 'Ticket promedio', value: formatCLP(data.current.ticketPromedio), delta: data.deltas.ticketPromedio },
    { label: 'Pedidos realizados', value: String(data.current.pedidosRealizados), delta: data.deltas.pedidosRealizados },
    { label: 'Equipos utilizados', value: String(data.current.equiposUtilizados), delta: data.deltas.equiposUtilizados },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Resumen Económico</h2>
        <span className="text-xs text-[var(--color-text-secondary)]">
          {periodLabel} · {data.diasPeriodo} días
        </span>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Ingresos del Período</div>
          <div className="mt-1 font-mono text-2xl font-semibold">{formatCLP(data.current.ingresos)}</div>
          <div className="mt-1">
            <Delta value={data.deltas.ingresos} />
          </div>
        </div>

        <div className="rounded-[10px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-soft)] p-4">
          <div className="text-xs font-medium text-[var(--color-text-secondary)]">
            Costos, márgenes y utilidad
          </div>
          <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            Costos Directos, Gastos Operacionales, Margen Bruto, Utilidad Operacional y ROI por
            activo no se calculan todavía: el esquema no registra gastos ni el costo de
            adquisición de los equipos. Requieren tablas nuevas —{' '}
            <code>expenses</code> y el costo por activo — que son una decisión de alcance, no algo
            que se pueda derivar de los pedidos.
          </p>
        </div>
      </div>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
        <h2 className="mb-4 text-sm font-semibold">Evolución de ingresos (12 meses)</h2>
        <div className="flex h-40 items-end gap-1.5" role="img" aria-label="Ingresos de los últimos doce meses">
          {data.series.map(month => (
            <div key={month.month} className="flex flex-1 flex-col items-center gap-1">
              <div
                className="w-full rounded-t-sm bg-[var(--color-text-primary)]"
                style={{ height: `${Math.round((month.ingresos / peak) * 100)}%`, minHeight: month.ingresos > 0 ? '2px' : '0' }}
                title={`${monthShort(month.month)}: ${formatCLP(month.ingresos)}`}
              />
              <span className="text-[9px] text-[var(--color-text-faint)]">{monthShort(month.month)}</span>
            </div>
          ))}
        </div>
        <table className="sr-only">
          <caption>Ingresos por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col">Ingresos</th>
              <th scope="col">Pedidos</th>
            </tr>
          </thead>
          <tbody>
            {data.series.map(month => (
              <tr key={month.month}>
                <td>{month.month}</td>
                <td>{formatCLP(month.ingresos)}</td>
                <td>{month.pedidos}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {metrics.map(metric => (
          <div
            key={metric.label}
            className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="text-xs text-[var(--color-text-secondary)]">{metric.label}</div>
            <div className="mt-1 font-mono text-xl font-semibold">{metric.value}</div>
            <div className="mt-1">
              <Delta value={metric.delta} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h2 className="border-b border-[var(--color-border)] p-4 text-sm font-semibold">
            Equipos que más facturaron
          </h2>
          {data.rotation.length === 0 ? (
            <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
              No hay arriendos registrados en el período.
            </p>
          ) : (
            <ol className="divide-y divide-[var(--color-border-soft)]">
              {data.rotation.slice(0, 10).map((asset, index) => (
                <li key={asset.productId} className="flex items-center gap-3 px-4 py-2">
                  <span className="w-5 font-mono text-[11px] text-[var(--color-text-faint)]">
                    {index + 1}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-xs">{asset.name}</span>
                  <span className="whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
                    {asset.rentals} {asset.rentals === 1 ? 'arriendo' : 'arriendos'}
                  </span>
                  <span className="whitespace-nowrap font-mono text-xs">{formatCLP(asset.revenue)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
          <h2 className="border-b border-[var(--color-border)] p-4 text-sm font-semibold">
            Atención: equipos sin uso en el período
          </h2>
          {data.idle.length === 0 ? (
            <p className="p-6 text-center text-xs text-[var(--color-ok)]">
              Todo el catálogo publicado facturó al menos una vez.
            </p>
          ) : (
            <>
              <p className="px-4 pt-3 text-[11px] text-[var(--color-text-secondary)]">
                {data.idle.length}{' '}
                {data.idle.length === 1 ? 'equipo publicado no facturó' : 'equipos publicados no facturaron'}{' '}
                nada este período. Es capital detenido.
              </p>
              <ul className="mt-2 max-h-64 divide-y divide-[var(--color-border-soft)] overflow-y-auto">
                {data.idle.map(asset => (
                  <li key={asset.id} className="px-4 py-2 text-xs">
                    {asset.name}
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
