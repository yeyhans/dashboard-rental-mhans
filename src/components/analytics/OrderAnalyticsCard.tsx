import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { ShoppingCart, TrendingUp, Clock, CreditCard, Users, BarChart3, Calendar, CheckCircle, XCircle } from 'lucide-react';
import type { OrderAnalytics } from '../../services/advancedAnalyticsService';

interface OrderAnalyticsCardProps {
  data: OrderAnalytics;
}

export default function OrderAnalyticsCard({ data }: OrderAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'bg-green-100 text-green-800';
      case 'processing': return 'bg-blue-100 text-blue-800';
      case 'on-hold': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': 
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed': return 'Completadas';
      case 'processing': return 'En Proceso';
      case 'on-hold': return 'En Espera';
      case 'cancelled': return 'Canceladas';
      case 'failed': return 'Fallidas';
      case 'pending': return 'Pendientes';
      default: return status.charAt(0).toUpperCase() + status.slice(1);
    }
  };

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Órdenes</CardTitle>
            <ShoppingCart className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalOrders)}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes en el período
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Completación</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{formatPercentage(data.completionRate)}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes completadas
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tiempo Procesamiento</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data.averageOrderProcessingTime} días</div>
            <p className="text-xs text-muted-foreground">
              Promedio de procesamiento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa Cancelación</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">{formatPercentage(data.cancelationRate)}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes canceladas
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Órdenes por estado */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Órdenes por Estado
          </CardTitle>
          <CardDescription>
            Distribución de órdenes según su estado actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.ordersByStatus.map((statusData, index) => (
              <div key={statusData.status} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <Badge className={getStatusColor(statusData.status)}>
                    {getStatusLabel(statusData.status)}
                  </Badge>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(statusData.count)} órdenes</div>
                  <div className="text-xs text-muted-foreground">
                    {formatPercentage(statusData.percentage)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Análisis de valor y métodos de pago */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Distribución de valor */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5" />
              Distribución de Valor
            </CardTitle>
            <CardDescription>
              Rangos de valor de las órdenes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-3 bg-blue-50 rounded-lg">
                  <div className="text-lg font-bold text-blue-600">
                    {formatCurrency(data.orderValueDistribution.averageOrderValue)}
                  </div>
                  <div className="text-xs text-muted-foreground">Valor Promedio</div>
                </div>
                <div className="text-center p-3 bg-green-50 rounded-lg">
                  <div className="text-lg font-bold text-green-600">
                    {formatCurrency(data.orderValueDistribution.medianOrderValue)}
                  </div>
                  <div className="text-xs text-muted-foreground">Valor Mediano</div>
                </div>
              </div>
              
              {data.orderValueDistribution.ranges.map((range) => (
                <div key={range.range} className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="font-medium">{range.range}</span>
                    <span>{formatNumber(range.count)} órdenes ({formatPercentage(range.percentage)})</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-blue-500 h-2 rounded-full" 
                      style={{ width: `${Math.min(100, range.percentage)}%` }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Métodos de pago */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5" />
              Métodos de Pago
            </CardTitle>
            <CardDescription>
              Análisis de métodos de pago utilizados
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.ordersByPaymentMethod.slice(0, 8).map((method, index) => (
                <div key={method.method} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{method.method}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatNumber(method.count)} órdenes</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(method.totalAmount)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top clientes */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Top Clientes
          </CardTitle>
          <CardDescription>
            Clientes con mayor volumen de órdenes y gasto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.topCustomers.map((customer, index) => (
              <div key={customer.customerId} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium">{customer.customerName}</div>
                    <div className="text-xs text-muted-foreground">ID: {customer.customerId}</div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    {formatCurrency(customer.totalSpent)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(customer.orderCount)} órdenes
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Análisis de proyectos */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Top Proyectos
          </CardTitle>
          <CardDescription>
            Proyectos con mayor actividad y revenue
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.projectAnalysis.map((project, index) => (
              <div key={project.projectName} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <div>
                    <div className="text-sm font-medium">{project.projectName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatNumber(project.orderCount)} órdenes
                      {project.avgDuration > 0 && ` • ${project.avgDuration.toFixed(1)} días promedio`}
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold text-green-600">
                    {formatCurrency(project.totalRevenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Tendencias mensuales */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Tendencias Mensuales
          </CardTitle>
          <CardDescription>
            Evolución de órdenes y revenue por mes
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.monthlyOrderTrends.slice(-6).map((trend) => (
              <div key={trend.month} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="text-sm font-medium">
                    {new Date(trend.month + '-01').toLocaleDateString('es-CL', { 
                      month: 'long', 
                      year: 'numeric' 
                    })}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">
                    {formatNumber(trend.totalOrders)} órdenes
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {formatNumber(trend.completedOrders)} completadas • {formatCurrency(trend.revenue)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
