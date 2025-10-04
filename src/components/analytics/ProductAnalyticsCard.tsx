import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Package, TrendingUp, Tag, BarChart3, DollarSign } from 'lucide-react';
import type { ProductAnalytics } from '../../services/advancedAnalyticsService';

interface ProductAnalyticsCardProps {
  data: ProductAnalytics;
}

export default function ProductAnalyticsCard({ data }: ProductAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;

  return (
    <div className="space-y-6">
      {/* Métricas principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Productos</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.totalProducts)}</div>
            <p className="text-xs text-muted-foreground">
              Productos en catálogo
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Productos Activos</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.activeProducts)}</div>
            <p className="text-xs text-muted-foreground">
              En stock disponible
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">En Stock</CardTitle>
            <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.stockStatus.inStock)}</div>
            <p className="text-xs text-muted-foreground">
              Disponibles para renta
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sin Stock</CardTitle>
            <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{formatNumber(data.stockStatus.outOfStock)}</div>
            <p className="text-xs text-muted-foreground">
              No disponibles
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Productos más rentados */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Productos Más Rentados
          </CardTitle>
          <CardDescription>
            Top 10 productos por cantidad de rentas
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data.mostRentedProducts.slice(0, 10).map((product, index) => (
              <div key={product.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                    {index + 1}
                  </Badge>
                  {product.image && (
                    <img 
                      src={product.image} 
                      alt={product.name}
                      className="w-10 h-10 object-cover rounded border"
                    />
                  )}
                  <div>
                    <div className="text-sm font-medium">{product.name}</div>
                    {product.sku && (
                      <div className="text-xs text-muted-foreground">SKU: {product.sku}</div>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold">{formatNumber(product.totalRentals)} rentas</div>
                  <div className="text-xs text-muted-foreground">{formatCurrency(product.revenue)}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Análisis por categorías y revenue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Categorías performance */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              Performance por Categorías
            </CardTitle>
            <CardDescription>
              Revenue y productos por categoría
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {data.categoriesPerformance.slice(0, 8).map((category, index) => (
                <div key={category.category} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {category.productCount}
                      </Badge>
                      <span className="text-sm font-medium">{category.category}</span>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-bold">{formatCurrency(category.totalRevenue)}</div>
                      <div className="text-xs text-muted-foreground">
                        Promedio: {formatCurrency(category.avgPrice)}
                      </div>
                    </div>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-primary h-2 rounded-full" 
                      style={{ 
                        width: `${Math.min(100, (category.totalRevenue / Math.max(...data.categoriesPerformance.map(c => c.totalRevenue))) * 100)}%` 
                      }}
                    ></div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Top revenue por producto */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <DollarSign className="h-5 w-5" />
              Top Revenue por Producto
            </CardTitle>
            <CardDescription>
              Productos que generan más ingresos
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {data.revenueByProduct.slice(0, 10).map((product, index) => (
                <div key={product.productId} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Badge variant="outline" className="w-6 h-6 p-0 flex items-center justify-center text-xs">
                      {index + 1}
                    </Badge>
                    <div>
                      <div className="text-sm font-medium truncate max-w-[200px]">
                        {product.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        ID: {product.productId}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold text-green-600">
                      {formatCurrency(product.revenue)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Estado del inventario */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Estado del Inventario
          </CardTitle>
          <CardDescription>
            Distribución del stock actual
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <div className="w-6 h-6 bg-green-500 rounded-full"></div>
              </div>
              <div className="text-2xl font-bold text-green-600">{formatNumber(data.stockStatus.inStock)}</div>
              <div className="text-sm text-muted-foreground">En Stock</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.totalProducts > 0 ? `${((data.stockStatus.inStock / data.totalProducts) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <div className="w-6 h-6 bg-red-500 rounded-full"></div>
              </div>
              <div className="text-2xl font-bold text-red-600">{formatNumber(data.stockStatus.outOfStock)}</div>
              <div className="text-sm text-muted-foreground">Sin Stock</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.totalProducts > 0 ? `${((data.stockStatus.outOfStock / data.totalProducts) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
            
            <div className="text-center p-4 border rounded-lg">
              <div className="w-12 h-12 bg-yellow-100 rounded-full flex items-center justify-center mx-auto mb-2">
                <div className="w-6 h-6 bg-yellow-500 rounded-full"></div>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{formatNumber(data.stockStatus.lowStock)}</div>
              <div className="text-sm text-muted-foreground">Stock Bajo</div>
              <div className="text-xs text-muted-foreground mt-1">
                {data.totalProducts > 0 ? `${((data.stockStatus.lowStock / data.totalProducts) * 100).toFixed(1)}%` : '0%'}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
