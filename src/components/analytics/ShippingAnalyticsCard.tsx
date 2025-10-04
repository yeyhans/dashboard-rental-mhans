import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Truck, MapPin, TrendingUp, Calendar, Package } from 'lucide-react';
import type { ShippingAnalytics } from '../../services/advancedAnalyticsService';

interface ShippingAnalyticsCardProps {
  data: ShippingAnalytics;
}

export default function ShippingAnalyticsCard({ data }: ShippingAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;

  const totalOrders = data.pickupVsShipping.pickup + data.pickupVsShipping.shipping;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Revenue Shipping</CardTitle>
            <Truck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalShippingRevenue)}</div>
            <p className="text-xs text-muted-foreground">
              Ingresos por envíos
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Costo Promedio</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.avgShippingCost)}</div>
            <p className="text-xs text-muted-foreground">
              Por envío realizado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Envíos</CardTitle>
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.pickupVsShipping.shipping)}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes con envío
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Retiros</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.pickupVsShipping.pickup)}</div>
            <p className="text-xs text-muted-foreground">
              Retiros en tienda
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Pickup vs Shipping */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Retiro vs Envío
          </CardTitle>
          <CardDescription>
            Distribución de métodos de entrega
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="text-center p-6 border rounded-lg">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <MapPin className="h-8 w-8 text-green-600" />
              </div>
              <div className="text-3xl font-bold text-green-600 mb-2">
                {formatNumber(data.pickupVsShipping.pickup)}
              </div>
              <div className="text-sm font-medium mb-1">Retiro en Tienda</div>
              <div className="text-xs text-muted-foreground">
                {totalOrders > 0 ? `${((data.pickupVsShipping.pickup / totalOrders) * 100).toFixed(1)}%` : '0%'} del total
              </div>
              <Badge variant="secondary" className="mt-2">
                Gratis
              </Badge>
            </div>

            <div className="text-center p-6 border rounded-lg">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Truck className="h-8 w-8 text-blue-600" />
              </div>
              <div className="text-3xl font-bold text-blue-600 mb-2">
                {formatNumber(data.pickupVsShipping.shipping)}
              </div>
              <div className="text-sm font-medium mb-1">Envío a Domicilio</div>
              <div className="text-xs text-muted-foreground">
                {totalOrders > 0 ? `${((data.pickupVsShipping.shipping / totalOrders) * 100).toFixed(1)}%` : '0%'} del total
              </div>
              <Badge variant="outline" className="mt-2">
                {formatCurrency(data.avgShippingCost)} promedio
              </Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Métodos de envío */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Truck className="h-5 w-5" />
            Métodos de Envío
          </CardTitle>
          <CardDescription>
            Análisis de métodos de entrega utilizados
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.shippingMethods.map((method, index) => (
              <div key={method.method} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  <div className="flex items-center gap-2">
                    {method.method === 'Retiro en tienda' ? (
                      <MapPin className="h-4 w-4 text-green-600" />
                    ) : (
                      <Truck className="h-4 w-4 text-blue-600" />
                    )}
                    <span className="text-sm font-medium">{method.method}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(method.count)} órdenes</div>
                  <div className="text-xs text-muted-foreground">
                    {method.avgCost > 0 ? `${formatCurrency(method.avgCost)} promedio` : 'Gratis'}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Análisis por regiones y tendencias */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top regiones */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Top Regiones de Entrega
            </CardTitle>
            <CardDescription>
              Ciudades con más órdenes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.deliveryRegions.slice(0, 8).map((region, index) => (
                <div key={region.region} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <span className="text-sm font-medium">{region.region}</span>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold">{formatNumber(region.orderCount)} órdenes</div>
                    <div className="text-xs text-muted-foreground">
                      {formatCurrency(region.totalShippingCost)} en envíos
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
              <Calendar className="h-5 w-5" />
              Tendencias de Envío
            </CardTitle>
            <CardDescription>
              Evolución mensual de costos de envío
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.shippingTrends.length > 0 ? (
                data.shippingTrends.slice(-6).map((trend) => (
                  <div key={trend.month} className="flex items-center justify-between">
                    <div className="text-sm font-medium">
                      {new Date(trend.month + '-01').toLocaleDateString('es-CL', { 
                        month: 'long', 
                        year: 'numeric' 
                      })}
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-blue-600">
                        {formatCurrency(trend.totalShipping)}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(trend.orderCount)} órdenes
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Calendar className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No hay datos de tendencias disponibles</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Resumen de eficiencia */}
      <Card>
        <CardHeader>
          <CardTitle>Resumen de Eficiencia</CardTitle>
          <CardDescription>
            Métricas clave de la operación de envíos
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-primary">
                {totalOrders > 0 ? `${((data.pickupVsShipping.pickup / totalOrders) * 100).toFixed(1)}%` : '0%'}
              </div>
              <div className="text-sm text-muted-foreground">Tasa de retiro</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-blue-600">
                {totalOrders > 0 ? `${((data.pickupVsShipping.shipping / totalOrders) * 100).toFixed(1)}%` : '0%'}
              </div>
              <div className="text-sm text-muted-foreground">Tasa de envío</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {formatCurrency(data.avgShippingCost)}
              </div>
              <div className="text-sm text-muted-foreground">Costo promedio</div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {formatCurrency(data.totalShippingRevenue)}
              </div>
              <div className="text-sm text-muted-foreground">Revenue total</div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
