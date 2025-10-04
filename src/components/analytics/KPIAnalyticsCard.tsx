import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';
import { TrendingUp, DollarSign, Users, Target, Repeat, UserMinus, HelpCircle } from 'lucide-react';
import type { KPIAnalytics } from '../../services/advancedAnalyticsService';

interface KPIAnalyticsCardProps {
  data: KPIAnalytics;
}

export default function KPIAnalyticsCard({ data }: KPIAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;
  const formatPercentage = (num: number) => `${num.toFixed(1)}%`;

  return (
    <TooltipProvider>
      <div className="space-y-6">
        {/* KPIs principales */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Customer LTV</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Valor de Vida del Cliente:</strong> Representa cuánto dinero genera un cliente promedio durante toda su relación con la empresa. Se calcula multiplicando el valor promedio de orden por la frecuencia de compra y el tiempo de vida del cliente.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <DollarSign className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.customerLifetimeValue)}</div>
              <p className="text-xs text-muted-foreground">
                Valor de vida del cliente
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">AOV</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Valor Promedio de Orden:</strong> Es el monto promedio que gasta un cliente en cada compra. Se calcula dividiendo los ingresos totales entre el número total de órdenes. Un AOV alto indica que los clientes compran más productos o productos de mayor valor.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.averageOrderValue)}</div>
              <p className="text-xs text-muted-foreground">
                Valor promedio de orden
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">MRR</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Revenue Recurrente Mensual:</strong> Ingresos predecibles que se generan cada mes por clientes que realizan compras regulares. Es clave para proyectar el crecimiento del negocio y planificar inversiones futuras.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Repeat className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.monthlyRecurringRevenue)}</div>
              <p className="text-xs text-muted-foreground">
                Revenue recurrente mensual
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Retention Rate</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Tasa de Retención:</strong> Porcentaje de clientes que regresan a hacer compras después de su primera orden. Una alta retención indica satisfacción del cliente y lealtad a la marca. Se calcula como (clientes que regresan / total de clientes) × 100.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Users className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">{formatPercentage(data.customerRetentionRate)}</div>
              <p className="text-xs text-muted-foreground">
                Tasa de retención
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">Churn Rate</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Tasa de Abandono:</strong> Porcentaje de clientes que dejan de comprar en un período determinado. Es lo opuesto a la retención. Una alta tasa de churn indica problemas en la experiencia del cliente o competencia fuerte. Se calcula como (clientes perdidos / total de clientes) × 100.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <UserMinus className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">{formatPercentage(data.churnRate)}</div>
              <p className="text-xs text-muted-foreground">
                Tasa de abandono
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <div className="flex items-center gap-2">
                <CardTitle className="text-sm font-medium">CAC</CardTitle>
                <Tooltip>
                  <TooltipTrigger>
                    <HelpCircle className="h-3 w-3 text-muted-foreground hover:text-foreground transition-colors" />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs">
                    <p className="text-xs">
                      <strong>Costo de Adquisición de Cliente:</strong> Cuánto cuesta en promedio conseguir un nuevo cliente. Incluye gastos de marketing, publicidad, ventas y promociones. Se calcula dividiendo el gasto total en adquisición entre el número de nuevos clientes obtenidos.
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <Target className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(data.customerAcquisitionCost)}</div>
              <p className="text-xs text-muted-foreground">
                Costo de adquisición
              </p>
            </CardContent>
          </Card>
        </div>

      {/* Funnel de conversión */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Funnel de Conversión
          </CardTitle>
          <CardDescription>
            Análisis del proceso de conversión de usuarios
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {/* Visitantes totales */}
            <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-blue-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">Visitantes Totales</div>
                  <div className="text-xs text-muted-foreground">Base de usuarios potenciales</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-blue-600">
                  {formatNumber(data.conversionFunnel.totalVisitors)}
                </div>
                <div className="text-xs text-muted-foreground">100%</div>
              </div>
            </div>

            {/* Usuarios registrados */}
            <div className="flex items-center justify-between p-4 bg-green-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-green-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">Usuarios Registrados</div>
                  <div className="text-xs text-muted-foreground">Completaron registro</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-600">
                  {formatNumber(data.conversionFunnel.registeredUsers)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.conversionFunnel.totalVisitors > 0 
                    ? formatPercentage((data.conversionFunnel.registeredUsers / data.conversionFunnel.totalVisitors) * 100)
                    : '0%'
                  }
                </div>
              </div>
            </div>

            {/* Usuarios con órdenes */}
            <div className="flex items-center justify-between p-4 bg-orange-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-orange-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">Usuarios con Órdenes</div>
                  <div className="text-xs text-muted-foreground">Realizaron al menos una orden</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-orange-600">
                  {formatNumber(data.conversionFunnel.usersWithOrders)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.conversionFunnel.registeredUsers > 0 
                    ? formatPercentage((data.conversionFunnel.usersWithOrders / data.conversionFunnel.registeredUsers) * 100)
                    : '0%'
                  }
                </div>
              </div>
            </div>

            {/* Órdenes completadas */}
            <div className="flex items-center justify-between p-4 bg-purple-50 rounded-lg">
              <div className="flex items-center gap-3">
                <div className="w-4 h-4 bg-purple-500 rounded-full"></div>
                <div>
                  <div className="text-sm font-medium">Órdenes Completadas</div>
                  <div className="text-xs text-muted-foreground">Finalizaron el proceso</div>
                </div>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-purple-600">
                  {formatNumber(data.conversionFunnel.completedOrders)}
                </div>
                <div className="text-xs text-muted-foreground">
                  {data.conversionFunnel.usersWithOrders > 0 
                    ? formatPercentage((data.conversionFunnel.completedOrders / data.conversionFunnel.usersWithOrders) * 100)
                    : '0%'
                  }
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Análisis de rentabilidad */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Análisis de Rentabilidad
            </CardTitle>
            <CardDescription>
              Relación entre LTV y CAC
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">LTV / CAC Ratio</div>
                  <div className="text-xs text-muted-foreground">
                    Relación valor de vida vs costo adquisición
                  </div>
                </div>
                <div className="text-right">
                  <div className={`text-lg font-bold ${
                    data.customerAcquisitionCost > 0 
                      ? (data.customerLifetimeValue / data.customerAcquisitionCost) >= 3 
                        ? 'text-green-600' 
                        : 'text-orange-600'
                      : 'text-gray-600'
                  }`}>
                    {data.customerAcquisitionCost > 0 
                      ? `${(data.customerLifetimeValue / data.customerAcquisitionCost).toFixed(1)}:1`
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {data.customerAcquisitionCost > 0 && (data.customerLifetimeValue / data.customerAcquisitionCost) >= 3 
                      ? 'Excelente' 
                      : 'Mejorable'
                    }
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 border rounded-lg">
                <div>
                  <div className="text-sm font-medium">Payback Period</div>
                  <div className="text-xs text-muted-foreground">
                    Tiempo estimado para recuperar CAC
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {data.averageOrderValue > 0 && data.customerAcquisitionCost > 0
                      ? `${Math.ceil(data.customerAcquisitionCost / data.averageOrderValue)} órdenes`
                      : 'N/A'
                    }
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Para recuperar inversión
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Métricas de Retención
            </CardTitle>
            <CardDescription>
              Análisis de comportamiento de clientes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-3xl font-bold text-green-600 mb-2">
                  {formatPercentage(data.customerRetentionRate)}
                </div>
                <div className="text-sm font-medium mb-1">Tasa de Retención</div>
                <div className="text-xs text-muted-foreground">
                  Clientes que regresan
                </div>
              </div>

              <div className="text-center p-4 border rounded-lg">
                <div className="text-3xl font-bold text-red-600 mb-2">
                  {formatPercentage(data.churnRate)}
                </div>
                <div className="text-sm font-medium mb-1">Tasa de Churn</div>
                <div className="text-xs text-muted-foreground">
                  Clientes que no regresan
                </div>
              </div>

              {/* Interpretación */}
              <div className="pt-3 border-t">
                <div className="text-xs text-muted-foreground text-center">
                  {data.customerRetentionRate >= 80 
                    ? '🟢 Excelente retención de clientes'
                    : data.customerRetentionRate >= 60
                    ? '🟡 Retención moderada, hay oportunidades'
                    : '🔴 Retención baja, requiere atención'
                  }
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen ejecutivo */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen Ejecutivo</CardTitle>
          <CardDescription>
            Indicadores clave de rendimiento del negocio
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary mb-2">
                {formatCurrency(data.customerLifetimeValue)}
              </div>
              <div className="text-sm font-medium mb-1">LTV</div>
              <Badge variant={data.customerLifetimeValue > data.averageOrderValue * 3 ? "default" : "secondary"}>
                {data.customerLifetimeValue > data.averageOrderValue * 3 ? "Saludable" : "Mejorable"}
              </Badge>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600 mb-2">
                {formatCurrency(data.averageOrderValue)}
              </div>
              <div className="text-sm font-medium mb-1">AOV</div>
              <Badge variant="outline">
                Por orden
              </Badge>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600 mb-2">
                {formatPercentage(data.customerRetentionRate)}
              </div>
              <div className="text-sm font-medium mb-1">Retención</div>
              <Badge variant={data.customerRetentionRate >= 70 ? "default" : "destructive"}>
                {data.customerRetentionRate >= 70 ? "Buena" : "Baja"}
              </Badge>
            </div>

            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600 mb-2">
                {formatCurrency(data.customerAcquisitionCost)}
              </div>
              <div className="text-sm font-medium mb-1">CAC</div>
              <Badge variant="secondary">
                Por cliente
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </TooltipProvider>
  );
}
