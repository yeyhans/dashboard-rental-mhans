import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
} from '../ui/chart';
import type { ChartConfig } from '../ui/chart';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
} from 'recharts';
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  Percent,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { FinancialAnalytics } from '../../services/advancedAnalyticsService';

interface FinancialAnalyticsCardProps {
  data: FinancialAnalytics;
}

const formatCurrency = (num: number) =>
  `$${num.toLocaleString('es-CL')}`;

const formatCompactCurrency = (v: number) =>
  v >= 1000000
    ? `$${(v / 1000000).toFixed(1)}M`
    : v >= 1000
      ? `$${Math.round(v / 1000)}K`
      : `$${v}`;

const formatMonthLabel = (m: string) => {
  const [year, month] = m.split('-');
  const date = new Date(parseInt(year), parseInt(month) - 1);
  return date.toLocaleDateString('es-CL', { month: 'short', year: '2-digit' });
};

const STATUS_COLORS: Record<string, string> = {
  completed: 'hsl(142, 71%, 45%)',
  paid: 'hsl(160, 60%, 45%)',
  processing: 'hsl(217, 91%, 60%)',
  'on-hold': 'hsl(45, 93%, 47%)',
  reviewing: 'hsl(280, 65%, 60%)',
  preparing: 'hsl(190, 80%, 42%)',
  delivering: 'hsl(30, 80%, 55%)',
  failed: 'hsl(0, 84%, 60%)',
  cancelled: 'hsl(0, 0%, 60%)',
};

const STATUS_LABELS: Record<string, string> = {
  completed: 'Completada',
  paid: 'Pagada',
  processing: 'En Proceso',
  'on-hold': 'En Espera',
  reviewing: 'En Revisión',
  preparing: 'Preparando',
  delivering: 'En Entrega',
  failed: 'Fallida',
  cancelled: 'Cancelada',
};

// Chart configs
const revenueChartConfig: ChartConfig = {
  revenue: { label: 'Ingresos', color: 'hsl(142, 71%, 45%)' },
};

const collectionChartConfig: ChartConfig = {
  collected: { label: 'Cobrado', color: 'hsl(142, 71%, 45%)' },
  pending: { label: 'Pendiente', color: 'hsl(25, 95%, 53%)' },
};

const reservesChartConfig: ChartConfig = {
  fullyPaid: { label: 'Pago Completo', color: 'hsl(142, 71%, 45%)' },
  reservesPaid: { label: 'Reserva (25%)', color: 'hsl(271, 91%, 65%)' },
  finalPaymentsPending: { label: 'Saldo Pendiente', color: 'hsl(25, 95%, 53%)' },
};

export default function FinancialAnalyticsCard({ data }: FinancialAnalyticsCardProps) {
  const latestGrowth = data.growthMetrics.length > 1
    ? data.growthMetrics[data.growthMetrics.length - 1]
    : null;

  const hasData = data.monthlyRevenue.length > 0;

  if (!hasData) {
    return (
      <div className="text-center py-12 text-muted-foreground">
        <DollarSign className="h-12 w-12 mx-auto mb-4 opacity-40" />
        <p>No hay datos financieros para el período seleccionado</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Ingresos Totales</CardTitle>
            <DollarSign className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {formatCurrency(data.kpis.totalRevenue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Órdenes completadas y pagadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Valor Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {formatCurrency(data.kpis.averageOrderValue)}
            </div>
            <p className="text-xs text-muted-foreground">
              Promedio por orden
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Cobro</CardTitle>
            <Percent className="h-4 w-4 text-purple-600" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${data.kpis.collectionRate >= 80 ? 'text-green-600' : data.kpis.collectionRate >= 50 ? 'text-yellow-600' : 'text-red-600'}`}>
              {data.kpis.collectionRate.toFixed(1)}%
            </div>
            <p className="text-xs text-muted-foreground">
              Del total facturado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Saldo Pendiente</CardTitle>
            <AlertCircle className="h-4 w-4 text-orange-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-orange-600">
              {formatCurrency(data.kpis.outstandingBalance)}
            </div>
            <p className="text-xs text-muted-foreground">
              Por cobrar
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Growth Metrics */}
      {latestGrowth && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Crecimiento de Ingresos</CardTitle>
              <CardDescription>vs mes anterior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-bold ${latestGrowth.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {latestGrowth.revenueGrowth >= 0 ? '+' : ''}{latestGrowth.revenueGrowth}%
                </span>
                {latestGrowth.revenueGrowth >= 0
                  ? <ArrowUpRight className="h-6 w-6 text-green-600" />
                  : <ArrowDownRight className="h-6 w-6 text-red-600" />
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Último mes: {formatMonthLabel(latestGrowth.month)}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium">Crecimiento de Órdenes</CardTitle>
              <CardDescription>vs mes anterior</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2">
                <span className={`text-3xl font-bold ${latestGrowth.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {latestGrowth.orderGrowth >= 0 ? '+' : ''}{latestGrowth.orderGrowth}%
                </span>
                {latestGrowth.orderGrowth >= 0
                  ? <ArrowUpRight className="h-6 w-6 text-green-600" />
                  : <ArrowDownRight className="h-6 w-6 text-red-600" />
                }
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Último mes: {formatMonthLabel(latestGrowth.month)}
              </p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Revenue Over Time - Area Chart */}
      <Card>
        <CardHeader>
          <CardTitle>Ingresos Mensuales</CardTitle>
          <CardDescription>Evolución de ingresos de órdenes completadas</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={revenueChartConfig} className="h-[300px] w-full">
            <AreaChart data={data.monthlyRevenue} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} fontSize={12} />
              <YAxis tickFormatter={formatCompactCurrency} fontSize={12} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                  />
                }
              />
              <Area
                type="monotone"
                dataKey="revenue"
                fill="var(--color-revenue)"
                stroke="var(--color-revenue)"
                fillOpacity={0.3}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Collection Trend - Stacked Area */}
      <Card>
        <CardHeader>
          <CardTitle>Cobrado vs Pendiente</CardTitle>
          <CardDescription>Evolución mensual del estado de cobros</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={collectionChartConfig} className="h-[300px] w-full">
            <AreaChart data={data.monthlyCollection} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} fontSize={12} />
              <YAxis tickFormatter={formatCompactCurrency} fontSize={12} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Area
                type="monotone"
                dataKey="collected"
                stackId="1"
                fill="var(--color-collected)"
                stroke="var(--color-collected)"
                fillOpacity={0.4}
              />
              <Area
                type="monotone"
                dataKey="pending"
                stackId="1"
                fill="var(--color-pending)"
                stroke="var(--color-pending)"
                fillOpacity={0.4}
              />
            </AreaChart>
          </ChartContainer>
        </CardContent>
      </Card>

      {/* Reserve Tracking - Grouped Bar */}
      <Card>
        <CardHeader>
          <CardTitle>Tracking de Reservas y Pagos</CardTitle>
          <CardDescription>Desglose mensual: pagos completos, reservas pagadas y saldos pendientes</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={reservesChartConfig} className="h-[300px] w-full">
            <BarChart data={data.monthlyReserves} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="month" tickFormatter={formatMonthLabel} fontSize={12} />
              <YAxis tickFormatter={formatCompactCurrency} fontSize={12} />
              <ChartTooltip
                content={
                  <ChartTooltipContent
                    formatter={(value) => formatCurrency(value as number)}
                  />
                }
              />
              <ChartLegend content={<ChartLegendContent />} />
              <Bar dataKey="fullyPaid" fill="var(--color-fullyPaid)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="reservesPaid" fill="var(--color-reservesPaid)" radius={[4, 4, 0, 0]} />
              <Bar dataKey="finalPaymentsPending" fill="var(--color-finalPaymentsPending)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ChartContainer>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Revenue by Status - Donut */}
        <Card>
          <CardHeader>
            <CardTitle>Ingresos por Estado</CardTitle>
            <CardDescription>Distribución del revenue por estado de orden</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ChartContainer
                config={Object.fromEntries(
                  data.revenueByStatus.map(item => [
                    item.status,
                    { label: STATUS_LABELS[item.status] || item.status, color: STATUS_COLORS[item.status] || 'hsl(0, 0%, 60%)' }
                  ])
                )}
                className="h-[280px] w-full"
              >
                <PieChart>
                  <ChartTooltip
                    content={
                      <ChartTooltipContent
                        formatter={(value) => formatCurrency(value as number)}
                        nameKey="status"
                      />
                    }
                  />
                  <Pie
                    data={data.revenueByStatus.map(item => ({
                      ...item,
                      status: STATUS_LABELS[item.status] || item.status,
                      fill: STATUS_COLORS[item.status] || 'hsl(0, 0%, 60%)',
                    }))}
                    dataKey="revenue"
                    nameKey="status"
                    cx="50%"
                    cy="50%"
                    innerRadius={60}
                    outerRadius={100}
                    paddingAngle={2}
                  >
                    {data.revenueByStatus.map((item, index) => (
                      <Cell
                        key={index}
                        fill={STATUS_COLORS[item.status] || 'hsl(0, 0%, 60%)'}
                      />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            </div>
            <div className="mt-4 space-y-2">
              {data.revenueByStatus.map((item, index) => (
                <div key={index} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div
                      className="h-3 w-3 rounded-full"
                      style={{ backgroundColor: STATUS_COLORS[item.status] || '#999' }}
                    />
                    <span>{STATUS_LABELS[item.status] || item.status}</span>
                    <Badge variant="secondary" className="text-xs">{item.orderCount}</Badge>
                  </div>
                  <span className="font-medium">{formatCurrency(item.revenue)}</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top Revenue Months - Bar */}
        <Card>
          <CardHeader>
            <CardTitle>Mejores Meses</CardTitle>
            <CardDescription>Top 6 meses por ingresos</CardDescription>
          </CardHeader>
          <CardContent>
            <ChartContainer config={revenueChartConfig} className="h-[280px] w-full">
              <BarChart
                data={data.topRevenueMonths.map(m => ({
                  ...m,
                  label: formatMonthLabel(m.month),
                }))}
                layout="vertical"
                margin={{ top: 5, right: 10, left: 60, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" tickFormatter={formatCompactCurrency} fontSize={12} />
                <YAxis type="category" dataKey="label" fontSize={12} width={55} />
                <ChartTooltip
                  content={
                    <ChartTooltipContent
                      formatter={(value) => formatCurrency(value as number)}
                    />
                  }
                />
                <Bar dataKey="revenue" fill="var(--color-revenue)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>

            <div className="mt-4 space-y-1">
              {data.topRevenueMonths.map((m, i) => (
                <div key={i} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">{formatMonthLabel(m.month)}</span>
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="text-xs">{m.orderCount} órdenes</Badge>
                    <span className="font-medium">{formatCurrency(m.revenue)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Monthly Growth Table */}
      {data.growthMetrics.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle>Crecimiento Mes a Mes</CardTitle>
            <CardDescription>Variación porcentual respecto al mes anterior</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Mes</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Ingresos</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Var. Ingresos</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Órdenes</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Var. Órdenes</th>
                  </tr>
                </thead>
                <tbody>
                  {data.growthMetrics.map((g, i) => {
                    const revenueData = data.monthlyRevenue.find(r => r.month === g.month);
                    return (
                      <tr key={i} className="border-b last:border-0 hover:bg-muted/50">
                        <td className="py-2 px-3 font-medium">{formatMonthLabel(g.month)}</td>
                        <td className="py-2 px-3 text-right">{formatCurrency(revenueData?.revenue || 0)}</td>
                        <td className="py-2 px-3 text-right">
                          {i === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={g.revenueGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {g.revenueGrowth >= 0 ? '+' : ''}{g.revenueGrowth}%
                            </span>
                          )}
                        </td>
                        <td className="py-2 px-3 text-right">{revenueData?.orderCount || 0}</td>
                        <td className="py-2 px-3 text-right">
                          {i === 0 ? (
                            <span className="text-muted-foreground">—</span>
                          ) : (
                            <span className={g.orderGrowth >= 0 ? 'text-green-600' : 'text-red-600'}>
                              {g.orderGrowth >= 0 ? '+' : ''}{g.orderGrowth}%
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
