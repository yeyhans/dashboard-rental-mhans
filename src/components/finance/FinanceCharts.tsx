import React from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatCLP } from "../../lib/delivery";
import type {
  DueSoonRow,
  FinanceCharts as FinanceChartsData,
  IncomeSlice,
} from "../../lib/financeCharts";

/**
 * R-03b: the Finanzas tab charts of `Finanzas_Cobranza_Canonical_RC2.1.4`.
 *
 * Built from `FinanceService.getCharts` (12-month window, aggregated on the server) plus the
 * board's own pending rows for "Por Vencer". Color carries state only: collected is ok, owed is
 * warn, the cash-flow gap is crit; everything else stays in the neutral ramp.
 */
interface FinanceChartsProps {
  charts: FinanceChartsData | null;
  dueSoon: Array<DueSoonRow & { daysLeft: number }>;
}

const MONTHS = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/** `2026-10` → `Oct 26`. */
function monthLabel(key: string): string {
  const [year, month] = key.split("-");
  return `${MONTHS[Number(month) - 1] ?? month} ${String(year).slice(2)}`;
}

/** Axis ticks in millions/thousands so a 12-month scale stays legible. */
function compactCLP(value: number): string {
  if (Math.abs(value) >= 1_000_000) {
    return `$${(value / 1_000_000).toLocaleString("es-CL", { maximumFractionDigits: 1 })} M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `$${Math.round(value / 1_000).toLocaleString("es-CL")} mil`;
  }
  return formatCLP(value);
}

const SLICE_COLORS: Record<IncomeSlice["key"], string> = {
  empresa: "var(--color-text-primary)",
  natural: "var(--color-text-secondary)",
  "sin-tipo": "var(--color-border)",
};

function ChartCard({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {subtitle && (
        <p className="mt-0.5 text-[11px] text-[var(--color-text-secondary)]">
          {subtitle}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </section>
  );
}

function RatioCard({
  title,
  value,
  detail,
  share,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  /** 0-100, drawn as a bar; null draws none. */
  share: number | null;
  tone: string;
}) {
  return (
    <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
      <h2 className="text-[11px] font-medium text-[var(--color-text-secondary)]">
        {title}
      </h2>
      <p className="mt-1 text-xl font-semibold tracking-tight">{value}</p>
      {share !== null && (
        <div
          className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--color-surface-2)]"
          role="img"
          aria-label={`${title}: ${share}%`}
        >
          <div
            className={`h-full ${tone}`}
            style={{ width: `${Math.min(100, Math.max(0, share))}%` }}
          />
        </div>
      )}
      <p className="mt-2 text-[11px] text-[var(--color-text-secondary)]">
        {detail}
      </p>
    </section>
  );
}

const AXIS_TICK = { fontSize: 9 };
const GRID_STROKE = "var(--color-border-soft)";

export function FinanceCharts({ charts, dueSoon }: FinanceChartsProps) {
  if (!charts) {
    return (
      <div
        role="alert"
        className="rounded-[10px] border border-[var(--color-crit)] bg-[var(--color-crit-bg)] p-4 text-sm text-[var(--color-crit)]"
      >
        No se pudieron cargar los gráficos de finanzas. Recarga la página o
        inténtalo en unos minutos.
      </div>
    );
  }

  const { months, composition, reserves, invoices } = charts;
  const reserveTotal = reserves.cobradas + reserves.pendientes;
  const invoiceTotal = invoices.emitidas + invoices.pendientes;
  const windowCaption = `Últimos 12 meses, desde ${monthLabel(charts.windowStart)}, por fecha de creación del pedido`;

  return (
    <div className="space-y-4">
      <p className="text-[11px] text-[var(--color-text-secondary)]">
        Los gráficos cubren los últimos 12 meses y no siguen el Período ni los
        filtros de arriba.
      </p>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Ingresos Últimos 12 Meses" subtitle={windowCaption}>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={months}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={AXIS_TICK}
              />
              <YAxis tick={AXIS_TICK} width={64} tickFormatter={compactCLP} />
              <Tooltip
                formatter={(value: number) => formatCLP(value)}
                labelFormatter={monthLabel}
              />
              <Bar
                dataKey="ingresos"
                name="Ingresos"
                fill="var(--color-text-primary)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Cobrado vs. Pendiente"
          subtitle="Lo que ya entró y lo que falta, por mes del pedido"
        >
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={months}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={AXIS_TICK}
              />
              <YAxis tick={AXIS_TICK} width={64} tickFormatter={compactCLP} />
              <Tooltip
                formatter={(value: number) => formatCLP(value)}
                labelFormatter={monthLabel}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="cobrado"
                name="Cobrado"
                stackId="money"
                fill="var(--color-ok)"
              />
              <Bar
                dataKey="pendiente"
                name="Pendiente"
                stackId="money"
                fill="var(--color-warn)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Pedidos Realizados" subtitle="Sin cancelados">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart
              data={months}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={AXIS_TICK}
              />
              <YAxis tick={AXIS_TICK} width={32} allowDecimals={false} />
              <Tooltip labelFormatter={monthLabel} />
              <Bar
                dataKey="pedidos"
                name="Pedidos"
                fill="var(--color-text-secondary)"
                radius={[3, 3, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard
          title="Flujo de Caja — Ingresos vs. Cobros"
          subtitle="La brecha es lo facturado que todavía no entra"
        >
          <ResponsiveContainer width="100%" height={200}>
            <ComposedChart
              data={months}
              margin={{ top: 4, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid stroke={GRID_STROKE} vertical={false} />
              <XAxis
                dataKey="month"
                tickFormatter={monthLabel}
                tick={AXIS_TICK}
              />
              <YAxis tick={AXIS_TICK} width={64} tickFormatter={compactCLP} />
              <Tooltip
                formatter={(value: number) => formatCLP(value)}
                labelFormatter={monthLabel}
              />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Bar
                dataKey="brecha"
                name="Brecha"
                fill="var(--color-crit-bg)"
                stroke="var(--color-crit)"
              />
              <Line
                type="monotone"
                dataKey="ingresos"
                name="Ingresos"
                stroke="var(--color-text-primary)"
                dot={false}
                strokeWidth={2}
              />
              <Line
                type="monotone"
                dataKey="cobrado"
                name="Cobros"
                stroke="var(--color-ok)"
                dot={false}
                strokeWidth={2}
              />
            </ComposedChart>
          </ResponsiveContainer>
          <p className="mt-2 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            Los cobros se ubican en el mes del pedido: los pedidos antiguos no
            tienen fecha de pago registrada. La reserva cuenta como cobro en
            cuanto entra.
          </p>
        </ChartCard>

        <ChartCard
          title="Composición del Ingreso"
          subtitle="Por tipo de cliente"
        >
          {composition.length === 0 ? (
            <p className="py-8 text-center text-xs text-[var(--color-text-secondary)]">
              Sin ingresos en los últimos 12 meses.
            </p>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="h-[160px] w-[160px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={composition}
                      dataKey="value"
                      nameKey="label"
                      innerRadius={48}
                      outerRadius={72}
                      stroke="var(--color-surface)"
                    >
                      {composition.map((slice) => (
                        <Cell key={slice.key} fill={SLICE_COLORS[slice.key]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value: number) => formatCLP(value)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <ul className="space-y-1.5 text-xs">
                {composition.map((slice) => (
                  <li key={slice.key} className="flex items-center gap-2">
                    <span
                      aria-hidden="true"
                      className="inline-block h-2.5 w-2.5 rounded-sm"
                      style={{ background: SLICE_COLORS[slice.key] }}
                    />
                    <span>{slice.label}</span>
                    <span className="font-mono text-[var(--color-text-secondary)]">
                      {formatCLP(slice.value)} · {slice.share}%
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </ChartCard>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <RatioCard
          title="DSO — Días para cobrar"
          value={charts.dso === null ? "—" : `${charts.dso} días`}
          detail="Saldo por cobrar sobre lo facturado, por los días del período"
          share={null}
          tone=""
        />
        <RatioCard
          title="Tasa de cobranza"
          value={
            charts.collectionRate === null ? "—" : `${charts.collectionRate}%`
          }
          detail="Cobrado sobre facturado, últimos 12 meses"
          share={charts.collectionRate}
          tone="bg-[var(--color-ok)]"
        />
        <RatioCard
          title="Facturas emitidas vs. pendientes"
          value={`${invoices.emitidas} de ${invoiceTotal}`}
          detail={`${invoices.pendientes} pedidos sin número de factura`}
          share={
            invoiceTotal > 0
              ? Math.round((invoices.emitidas / invoiceTotal) * 100)
              : null
          }
          tone="bg-[var(--color-text-primary)]"
        />
        <RatioCard
          title="Reservas cobradas vs. pendientes"
          value={`${reserves.cobradas} de ${reserveTotal}`}
          detail={`${reserves.pendientes} pedidos sin reserva pagada`}
          share={
            reserveTotal > 0
              ? Math.round((reserves.cobradas / reserveTotal) * 100)
              : null
          }
          tone="bg-[var(--color-ok)]"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
        <ChartCard title="Top Clientes del Período" subtitle="Últimos 12 meses">
          {charts.topClients.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
              Sin clientes con pedidos en los últimos 12 meses.
            </p>
          ) : (
            <table className="w-full text-xs">
              <caption className="sr-only">
                Clientes con más facturación: tipo, monto y tasa de cobranza
              </caption>
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th scope="col" className="py-2 pr-2 font-medium">
                    #
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Cliente
                  </th>
                  <th scope="col" className="py-2 pr-2 font-medium">
                    Tipo
                  </th>
                  <th scope="col" className="py-2 pr-2 text-right font-medium">
                    Monto
                  </th>
                  <th scope="col" className="py-2 text-center font-medium">
                    Cobranza
                  </th>
                </tr>
              </thead>
              <tbody>
                {charts.topClients.map((client, index) => (
                  <tr
                    key={client.client}
                    className="border-b border-[var(--color-border-soft)] last:border-b-0"
                  >
                    <td className="py-2 pr-2 text-[var(--color-text-faint)]">
                      {index + 1}
                    </td>
                    <td className="py-2 pr-2 font-medium">{client.client}</td>
                    <td className="py-2 pr-2 text-[var(--color-text-secondary)]">
                      {client.clientType === "empresa"
                        ? "Empresa"
                        : client.clientType === "natural"
                          ? "Persona natural"
                          : "—"}
                    </td>
                    <td className="py-2 pr-2 text-right font-mono">
                      {formatCLP(client.total)}
                    </td>
                    <td className="py-2 text-center font-mono">
                      {client.cobranza}%
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </ChartCard>

        <ChartCard
          title="Por Vencer — Próximos 7 Días"
          subtitle="Saldos que vencen con la devolución del equipo"
        >
          {dueSoon.length === 0 ? (
            <p className="py-6 text-center text-xs text-[var(--color-text-secondary)]">
              Nada vence en los próximos 7 días.
            </p>
          ) : (
            <ul className="divide-y divide-[var(--color-border-soft)]">
              {dueSoon.map((row) => (
                <li key={row.id} className="flex items-center gap-3 py-2.5">
                  <span
                    className={`flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-[8px] text-[10px] leading-tight ${
                      row.daysLeft <= 2
                        ? "bg-[var(--color-warn-bg)] text-[var(--color-warn)]"
                        : "bg-[var(--color-surface-2)] text-[var(--color-text-secondary)]"
                    }`}
                  >
                    <strong className="text-sm">{row.daysLeft}</strong>
                    {row.daysLeft === 1 ? "día" : "días"}
                  </span>
                  <div className="min-w-0 flex-1">
                    <a
                      href={`/orders/${row.id}`}
                      className="font-mono text-[11px] underline underline-offset-2"
                    >
                      {row.reference}
                    </a>
                    <p className="truncate text-xs">{row.client}</p>
                  </div>
                  <span className="font-mono text-xs font-semibold">
                    {formatCLP(row.outstanding)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </ChartCard>
      </div>
    </div>
  );
}
