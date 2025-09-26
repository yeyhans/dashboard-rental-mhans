import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card';
import { Badge } from './ui/badge';
import { Button } from './ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from './ui/tabs';
import { 
  DollarSign, 
  TrendingUp, 
  CreditCard,
  AlertCircle,
  Calendar,
  PieChart,
  BarChart3,
  Filter
} from 'lucide-react';

interface FinancialSummary {
  totalSales: number;
  totalPaid: number;
  totalPending: number;
  reservationPayments: number; // 25% payments
  finalPayments: number; // 75% payments
}

interface FinancialSummaryProps {
  financialSummary: FinancialSummary;
  isFiltered?: boolean;
  filterInfo?: string;
}

export default function FinancialSummary({ 
  financialSummary, 
  isFiltered = false, 
  filterInfo = '' 
}: FinancialSummaryProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('current');

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('es-CL', {
      style: 'currency',
      currency: 'CLP',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatPercentage = (value: number, total: number) => {
    if (total === 0) return '0%';
    return `${((value / total) * 100).toFixed(1)}%`;
  };

  // Calcular métricas adicionales
  const metrics = {
    collectionRate: financialSummary.totalSales > 0 
      ? (financialSummary.totalPaid / financialSummary.totalSales) * 100 
      : 0,
    pendingRate: financialSummary.totalSales > 0 
      ? (financialSummary.totalPending / financialSummary.totalSales) * 100 
      : 0,
    reservationRate: financialSummary.totalPaid > 0 
      ? (financialSummary.reservationPayments / financialSummary.totalPaid) * 100 
      : 0,
    finalPaymentRate: financialSummary.totalPaid > 0 
      ? (financialSummary.finalPayments / financialSummary.totalPaid) * 100 
      : 0
  };

  const summaryCards = [
    {
      title: 'Total Ventas',
      value: financialSummary.totalSales,
      description: 'Ingresos totales generados',
      icon: DollarSign,
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      borderColor: 'border-blue-200',
      trend: null
    },
    {
      title: 'Total Pagado',
      value: financialSummary.totalPaid,
      description: 'Dinero efectivamente cobrado',
      icon: CreditCard,
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      borderColor: 'border-green-200',
      trend: `${metrics.collectionRate.toFixed(1)}% del total`
    },
    {
      title: 'Total Pendiente',
      value: financialSummary.totalPending,
      description: 'Dinero por cobrar',
      icon: AlertCircle,
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      borderColor: 'border-orange-200',
      trend: `${metrics.pendingRate.toFixed(1)}% del total`
    }
  ];

  const paymentBreakdown = [
    {
      title: 'Pagos de Reserva',
      value: financialSummary.reservationPayments,
      description: '25% del total de órdenes',
      percentage: formatPercentage(financialSummary.reservationPayments, financialSummary.totalPaid),
      color: 'text-purple-600',
      bgColor: 'bg-purple-50'
    },
    {
      title: 'Pagos Finales',
      value: financialSummary.finalPayments,
      description: '75% del total de órdenes',
      percentage: formatPercentage(financialSummary.finalPayments, financialSummary.totalPaid),
      bgColor: 'bg-indigo-50'
    }
  ];

  return (
    <Card className="w-full">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            <CardTitle>Resumen Financiero</CardTitle>
            {isFiltered && (
              <Badge variant="secondary" className="ml-2">
                <Filter className="h-3 w-3 mr-1" />
                Filtrado por {filterInfo}
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={selectedPeriod}
            onChange={(e) => setSelectedPeriod(e.target.value)}
            className="px-3 py-2 border border-input bg-background rounded-md text-sm"
          >
            <option value="current">Período Actual</option>
            <option value="monthly">Mensual</option>
            <option value="weekly">Semanal</option>
          </select>
        </div>
      </CardHeader>
      
      <CardContent>

      {/* Tarjetas de resumen principal */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {summaryCards.map((card, index) => {
          const Icon = card.icon;
          return (
            <Card key={index} className="relative overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-full`}>
                  <Icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent>
                <div className={`text-2xl font-bold ${card.color} mb-1`}>
                  {formatCurrency(card.value)}
                </div>
                <p className="text-xs text-muted-foreground mb-2">
                  {card.description}
                </p>
                {card.trend && (
                  <Badge variant="secondary" className="text-xs">
                    {card.trend}
                  </Badge>
                )}
              </CardContent>
              {/* Decorative element */}
              <div className={`absolute top-0 right-0 w-20 h-20 ${card.color.replace('text-', 'bg-')} opacity-10 rounded-full -mr-10 -mt-10`}></div>
            </Card>
          );
        })}
      </div>

      <Tabs value="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="overview" className="flex items-center gap-2">
            <PieChart className="h-4 w-4" />
            Resumen
          </TabsTrigger>
          <TabsTrigger value="payments" className="flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            Tipos de Pago
          </TabsTrigger>
          <TabsTrigger value="trends" className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Tendencias
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="mt-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Estado de Cobranza */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <PieChart className="h-5 w-5" />
                  Estado de Cobranza
                </CardTitle>
                <CardDescription>
                  Distribución de pagos vs pendientes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-sm font-medium">Cobrado</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-green-600">
                        {formatCurrency(financialSummary.totalPaid)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metrics.collectionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                      <span className="text-sm font-medium">Pendiente</span>
                    </div>
                    <div className="text-right">
                      <div className="font-bold text-orange-600">
                        {formatCurrency(financialSummary.totalPending)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {metrics.pendingRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  {/* Barra de progreso visual */}
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${metrics.collectionRate}%` }}
                    ></div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Métricas Clave */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Métricas Clave
                </CardTitle>
                <CardDescription>
                  Indicadores financieros importantes
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium dark:text-black">Tasa de Cobranza</p>
                      <p className="text-xs text-muted-foreground">Dinero cobrado vs ventas</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-blue-600">
                        {metrics.collectionRate.toFixed(1)}%
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                    <div>
                      <p className="text-sm font-medium dark:text-black">Promedio por Venta</p>
                      <p className="text-xs text-muted-foreground">Valor promedio de órdenes</p>
                    </div>
                    <div className="text-right">
                      <div className="text-xl font-bold text-purple-600">
                        {formatCurrency(financialSummary.totalSales > 0 ? financialSummary.totalSales / 1 : 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="payments" className="mt-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {paymentBreakdown.map((payment, index) => (
              <Card key={index} className={`${payment.bgColor} border-opacity-50`}>
                <CardHeader>
                  <CardTitle className={`${payment.color}`}>
                    {payment.title}
                  </CardTitle>
                  <CardDescription>
                    {payment.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${payment.color} mb-2`}>
                    {formatCurrency(payment.value)}
                  </div>
                  <Badge variant="secondary">
                    {payment.percentage} del total pagado
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>

          <Card className="mt-4">
            <CardHeader>
              <CardTitle>Explicación del Sistema de Pagos</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div className="p-4 bg-purple-50 rounded-lg">
                  <h4 className="font-semibold text-purple-800 mb-2">Pagos de Reserva (25%)</h4>
                  <p className="text-purple-700">
                    Órdenes completadas donde el cliente ha pagado solo el 25% del total para reservar el equipo.
                    El 75% restante queda pendiente de pago.
                  </p>
                </div>
                <div className="p-4 bg-indigo-50 rounded-lg">
                  <h4 className="font-semibold text-indigo-800 mb-2">Pagos Finales (75%)</h4>
                  <p className="text-indigo-700">
                    Órdenes completadas donde el cliente ha pagado el 75% final, completando el 100% del valor total.
                    Estas órdenes están completamente pagadas.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trends" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-5 w-5" />
                Análisis de Tendencias
              </CardTitle>
              <CardDescription>
                Próximamente: Gráficos de tendencias financieras
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  Los gráficos de tendencias estarán disponibles próximamente
                </p>
                <Button variant="outline" className="mt-4">
                  <BarChart3 className="h-4 w-4 mr-2" />
                  Configurar Reportes
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
      </CardContent>
    </Card>
  );
}
