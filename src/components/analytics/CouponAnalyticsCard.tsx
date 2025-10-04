import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Percent, TrendingDown, Users, Calendar } from 'lucide-react';
import type { CouponAnalytics } from '../../services/advancedAnalyticsService';

interface CouponAnalyticsCardProps {
  data: CouponAnalytics;
}

export default function CouponAnalyticsCard({ data }: CouponAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cupones Usados</CardTitle>
            <Percent className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalCouponsUsed)}</div>
            <p className="text-xs text-muted-foreground">
              Órdenes con descuento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Descuentos</CardTitle>
            <TrendingDown className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.totalDiscountAmount)}</div>
            <p className="text-xs text-muted-foreground">
              Monto total descontado
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Descuento Promedio</CardTitle>
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatCurrency(data.avgDiscountPerOrder)}</div>
            <p className="text-xs text-muted-foreground">
              Por orden con descuento
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Tasa de Uso</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {data.discountImpact.ordersWithDiscount + data.discountImpact.ordersWithoutDiscount > 0 
                ? `${((data.discountImpact.ordersWithDiscount / (data.discountImpact.ordersWithDiscount + data.discountImpact.ordersWithoutDiscount)) * 100).toFixed(1)}%`
                : '0%'
              }
            </div>
            <p className="text-xs text-muted-foreground">
              Órdenes con cupones
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Cupones más usados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Percent className="h-5 w-5" />
            Cupones Más Utilizados
          </CardTitle>
          <CardDescription>
            Top cupones por frecuencia de uso
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.mostUsedCoupons.length > 0 ? (
              data.mostUsedCoupons.map((coupon, index) => (
                <div key={coupon.code} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <div>
                      <div className="text-sm font-medium font-mono">{coupon.code}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatNumber(coupon.usageCount)} usos
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-red-600">
                      -{formatCurrency(coupon.totalDiscount)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Promedio: {formatCurrency(coupon.totalDiscount / coupon.usageCount)}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <Percent className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No se han usado cupones en este período</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Impacto de descuentos */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <TrendingDown className="h-5 w-5" />
              Impacto en Órdenes
            </CardTitle>
            <CardDescription>
              Comparación de órdenes con y sin descuentos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium">Con Descuento</div>
                  <div className="text-xs text-muted-foreground">
                    Valor promedio: {formatCurrency(data.discountImpact.avgOrderValueWithDiscount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-green-600">
                    {formatNumber(data.discountImpact.ordersWithDiscount)}
                  </div>
                  <div className="text-xs text-muted-foreground">órdenes</div>
                </div>
              </div>

              <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                <div>
                  <div className="text-sm font-medium">Sin Descuento</div>
                  <div className="text-xs text-muted-foreground">
                    Valor promedio: {formatCurrency(data.discountImpact.avgOrderValueWithoutDiscount)}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-blue-600">
                    {formatNumber(data.discountImpact.ordersWithoutDiscount)}
                  </div>
                  <div className="text-xs text-muted-foreground">órdenes</div>
                </div>
              </div>

              {/* Diferencia en valor promedio */}
              <div className="pt-3 border-t">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-medium">Diferencia en valor promedio:</span>
                  <span className={`text-sm font-bold ${
                    data.discountImpact.avgOrderValueWithDiscount > data.discountImpact.avgOrderValueWithoutDiscount 
                      ? 'text-green-600' 
                      : 'text-red-600'
                  }`}>
                    {data.discountImpact.avgOrderValueWithDiscount > data.discountImpact.avgOrderValueWithoutDiscount ? '+' : ''}
                    {formatCurrency(data.discountImpact.avgOrderValueWithDiscount - data.discountImpact.avgOrderValueWithoutDiscount)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tendencias mensuales */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Tendencias Mensuales
            </CardTitle>
            <CardDescription>
              Evolución de descuentos por mes
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.discountTrends.length > 0 ? (
                data.discountTrends.slice(-6).map((trend) => (
                  <div key={trend.month} className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="text-sm font-medium">
                        {new Date(trend.month + '-01').toLocaleDateString('es-CL', { 
                          month: 'long', 
                          year: 'numeric' 
                        })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold text-red-600">
                        -{formatCurrency(trend.totalDiscount)}
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

      {/* Resumen de efectividad */}
      {data.totalCouponsUsed > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Resumen de Efectividad</CardTitle>
            <CardDescription>
              Análisis del impacto de los cupones de descuento
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-primary">
                  {((data.discountImpact.ordersWithDiscount / (data.discountImpact.ordersWithDiscount + data.discountImpact.ordersWithoutDiscount)) * 100).toFixed(1)}%
                </div>
                <div className="text-sm text-muted-foreground">Penetración de cupones</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-orange-600">
                  {formatCurrency(data.avgDiscountPerOrder)}
                </div>
                <div className="text-sm text-muted-foreground">Descuento promedio</div>
              </div>
              
              <div className="text-center p-4 border rounded-lg">
                <div className="text-2xl font-bold text-red-600">
                  -{formatCurrency(data.totalDiscountAmount)}
                </div>
                <div className="text-sm text-muted-foreground">Impacto total en revenue</div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
