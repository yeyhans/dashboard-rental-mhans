import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '../ui/accordion';
import { Package, TrendingUp, Tag, BarChart3, DollarSign, Loader2, Calendar, User, ShoppingCart, Search, ChevronLeft, ChevronRight } from 'lucide-react';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import type { ProductAnalytics, ProductRental } from '../../services/advancedAnalyticsService';

interface ProductAnalyticsCardProps {
  data: ProductAnalytics;
}

export default function ProductAnalyticsCard({ data }: ProductAnalyticsCardProps) {
  const formatNumber = (num: number) => num.toLocaleString('es-CL');
  const formatCurrency = (num: number) => `$${num.toLocaleString('es-CL')}`;
  const formatDate = (dateString: string) => {
    if (!dateString) return 'No disponible';
    try {
      const date = new Date(dateString);
      const day = String(date.getDate()).padStart(2, '0');
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const year = date.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return dateString;
    }
  };

  // Estado para manejar datos cargados por producto
  const [rentalsData, setRentalsData] = useState<Record<number, { data: ProductRental[]; loading: boolean; error: string | null }>>({});
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 8; // Muestra 8 elementos por página para no saturar

  // Filtrado y paginación
  const filteredProducts = data.mostRentedProducts.filter(product => {
    const term = searchTerm.toLowerCase();
    return (
      product.name.toLowerCase().includes(term) ||
      (product.sku && product.sku.toLowerCase().includes(term))
    );
  });

  const totalPages = Math.ceil(filteredProducts.length / itemsPerPage);
  const paginatedProducts = filteredProducts.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  // Resetear página cuando cambia la búsqueda
  React.useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  const loadProductRentals = async (productId: number) => {
    // Si ya tenemos los datos, no cargar de nuevo
    if (rentalsData[productId]?.data && rentalsData[productId].data.length > 0) {
      return;
    }

    // Si ya está cargando, no hacer nada
    if (rentalsData[productId]?.loading) {
      return;
    }

    // Marcar como cargando
    setRentalsData(prev => ({
      ...prev,
      [productId]: { data: [], loading: true, error: null }
    }));

    try {
      const response = await fetch(`/api/analytics/product-rentals/${productId}`);
      const result = await response.json();

      if (result.success) {
        setRentalsData(prev => ({
          ...prev,
          [productId]: { data: result.data, loading: false, error: null }
        }));
      } else {
        setRentalsData(prev => ({
          ...prev,
          [productId]: { data: [], loading: false, error: result.error || 'Error al cargar las rentas' }
        }));
      }
    } catch (error) {
      console.error('Error fetching product rentals:', error);
      setRentalsData(prev => ({
        ...prev,
        [productId]: { data: [], loading: false, error: 'Error al cargar las rentas' }
      }));
    }
  };

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

      {/* Productos más rentados y Buscador */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-muted/30">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Search className="h-5 w-5" />
                Explorador de Productos
              </CardTitle>
              <CardDescription>
                Gestión y análisis detallado de todo el catálogo ({data.totalProducts} productos)
              </CardDescription>
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Buscar por nombre o SKU..."
                className="pl-9 bg-background"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          <div className="p-6">
            <Accordion
              type="single"
              collapsible
              className="w-full"
              onValueChange={(value) => {
                if (value) {
                  const productId = parseInt(value.replace('product-', ''));
                  if (!isNaN(productId)) {
                    loadProductRentals(productId);
                  }
                }
              }}
            >
              {paginatedProducts.length > 0 ? (
                paginatedProducts.map((product, index) => {
                  const productRentals = rentalsData[product.id];
                  // Índice global para el ranking
                  const globalIndex = (currentPage - 1) * itemsPerPage + index;

                  return (
                    <AccordionItem key={product.id} value={`product-${product.id}`} className="border-b last:border-0">
                      <AccordionTrigger className="hover:no-underline py-4 px-2 hover:bg-muted/50 rounded-lg transition-colors">
                        <div className="flex items-center justify-between w-full pr-4 gap-4">
                          <div className="flex items-center gap-4 flex-1 min-w-0">
                            <Badge variant={globalIndex < 3 ? "default" : "outline"} className={`w-8 h-8 p-0 flex items-center justify-center text-sm rounded-full ${globalIndex < 3 ? 'bg-primary text-primary-foreground' : ''}`}>
                              {globalIndex + 1}
                            </Badge>
                            {product.image ? (
                              <img
                                src={product.image}
                                alt={product.name}
                                className="w-12 h-12 object-cover rounded-md border shadow-sm"
                              />
                            ) : (
                              <div className="w-12 h-12 bg-muted rounded-md flex items-center justify-center border">
                                <Package className="h-6 w-6 text-muted-foreground/50" />
                              </div>
                            )}
                            <div className="text-left min-w-0">
                              <div className="font-semibold text-sm md:text-base truncate" title={product.name}>{product.name}</div>
                              {product.sku && (
                                <div className="flex items-center gap-2 mt-1">
                                  <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-normal">
                                    SKU: {product.sku}
                                  </Badge>
                                </div>
                              )}
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <div className="text-sm font-bold">{formatNumber(product.totalRentals)} rentas</div>
                            <div className="text-xs font-medium text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-full inline-block mt-1">
                              {formatCurrency(product.revenue)}
                            </div>
                          </div>
                        </div>
                      </AccordionTrigger>
                      <AccordionContent className="px-2">
                        <div className="pt-2 pb-6 space-y-4">
                          {productRentals?.loading && (
                            <div className="flex flex-col items-center justify-center py-8 bg-muted/20 rounded-lg">
                              <Loader2 className="h-8 w-8 animate-spin text-primary mb-2" />
                              <span className="text-sm text-muted-foreground">Cargando historial de rentas...</span>
                            </div>
                          )}

                          {productRentals?.error && (
                            <div className="flex items-center justify-center p-6 text-sm text-red-500 bg-red-50 dark:bg-red-900/10 rounded-lg border border-red-100 dark:border-red-900/20">
                              <span className="font-medium">{productRentals.error}</span>
                            </div>
                          )}

                          {productRentals?.data && !productRentals.loading && !productRentals.error && (
                            <>
                              {productRentals.data.length === 0 ? (
                                <div className="text-center py-12 bg-muted/20 rounded-lg border border-dashed">
                                  <ShoppingCart className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
                                  <p className="text-sm font-medium text-muted-foreground">No se han registrado rentas para este producto aún.</p>
                                </div>
                              ) : (
                                <div className="grid gap-3">
                                  <div className="flex items-center justify-between text-xs text-muted-foreground px-1 mb-1">
                                    <span>Historial reciente</span>
                                    <span>{productRentals.data.length} registros encontrados</span>
                                  </div>
                                  {productRentals.data.map((rental) => (
                                    <div key={rental.orderId} className="group p-4 border rounded-xl bg-card hover:bg-muted/40 hover:border-primary/20 transition-all duration-200 shadow-sm custom-hover-effect">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div className="space-y-3">
                                          <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs">
                                              #{rental.orderId}
                                            </div>
                                            <Badge
                                              variant={rental.orderStatus === 'completed' ? 'default' : 'secondary'}
                                              className="capitalize shadow-none"
                                            >
                                              {rental.orderStatus}
                                            </Badge>
                                          </div>

                                          <div className="flex items-start gap-3 pl-1">
                                            <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 mt-0.5">
                                              <User className="h-4 w-4 text-muted-foreground" />
                                            </div>
                                            <div>
                                              <div className="text-sm font-medium">{rental.cliente}</div>
                                              {rental.clienteEmail && (
                                                <div className="text-xs text-muted-foreground">
                                                  {rental.clienteEmail}
                                                </div>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        <div className="space-y-3 pl-0 md:pl-4 border-l-0 md:border-l border-dashed">
                                          <div className="flex items-start gap-3">
                                            <div className="w-8 h-8 rounded-full bg-orange-50 dark:bg-orange-900/20 flex items-center justify-center shrink-0 mt-0.5">
                                              <Calendar className="h-4 w-4 text-orange-500" />
                                            </div>
                                            <div className="space-y-1 w-full">
                                              <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Desde:</span>
                                                <span className="font-medium">{formatDate(rental.fechaInicio)}</span>
                                              </div>
                                              <div className="flex justify-between text-xs">
                                                <span className="text-muted-foreground">Hasta:</span>
                                                <span className="font-medium">{formatDate(rental.fechaTermino)}</span>
                                              </div>
                                            </div>
                                          </div>

                                          <div className="flex items-center justify-between pt-2 border-t border-dashed mt-2">
                                            <div className="text-xs px-2 py-1 bg-muted rounded-md font-medium">
                                              Cant: {formatNumber(rental.cantidad)}
                                            </div>
                                            <div className="text-sm font-bold text-green-600 bg-green-50 dark:bg-green-900/20 px-2 py-1 rounded-md">
                                              {formatCurrency(rental.precio)}
                                            </div>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </>
                          )}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })
              ) : (
                <div className="flex flex-col items-center justify-center py-16 text-center">
                  <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-4">
                    <Search className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <h3 className="text-lg font-medium text-foreground">No se encontraron productos</h3>
                  <p className="text-sm text-muted-foreground max-w-xs mt-1">
                    No hay productos que coincidan con "{searchTerm}". Intenta con otro término.
                  </p>
                  <Button variant="link" onClick={() => setSearchTerm('')} className="mt-4">
                    Limpiar búsqueda
                  </Button>
                </div>
              )}
            </Accordion>

            {/* Paginación */}
            {totalPages > 1 && (
              <div className="flex items-center justify-between border-t pt-4 mt-4">
                <div className="text-sm text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, filteredProducts.length)} de {filteredProducts.length} productos
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                  >
                    <ChevronLeft className="h-4 w-4 mr-1" />
                    Anterior
                  </Button>
                  <div className="text-sm font-medium px-2">
                    Página {currentPage} de {totalPages}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                  >
                    Siguiente
                    <ChevronRight className="h-4 w-4 ml-1" />
                  </Button>
                </div>
              </div>
            )}
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
              {data.categoriesPerformance.slice(0, 8).map((category) => (
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
