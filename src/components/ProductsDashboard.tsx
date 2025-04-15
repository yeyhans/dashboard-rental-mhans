import { useState, useEffect } from 'react';
import { 
  Card, 
  CardContent, 
  CardDescription, 
  CardHeader, 
  CardTitle 
} from './ui/card';
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from './ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from './ui/dialog';
import { Label } from './ui/label';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Skeleton } from './ui/skeleton';
import { Badge } from './ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import type { Product, ProductCategory } from '../types/product';
import { ChevronRight, ExternalLink, RefreshCw, Search, Filter } from 'lucide-react';
import React from 'react';

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface ProductsDashboardProps {
  initialProducts: Product[];
  initialTotal: number;
  initialCategories?: ProductCategory[];
}

const stockStatusColors: Record<string, string> = {
  'instock': 'bg-green-100 text-green-800',
  'outofstock': 'bg-red-100 text-red-800',
  'onbackorder': 'bg-yellow-100 text-yellow-800',
};

const ProductsDashboard = ({ 
  initialProducts,
  initialTotal,
  initialCategories = []
}: ProductsDashboardProps) => {
  const [products, setProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [isInitialLoad, setIsInitialLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
  const [productCategories, setProductCategories] = useState<Set<string>>(new Set());
  const [isMobileView, setIsMobileView] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'ascending' | 'descending'} | null>(null);

  // Detect mobile view
  useEffect(() => {
    const checkIfMobile = () => {
      setIsMobileView(window.innerWidth < 768);
    };
    
    checkIfMobile();
    window.addEventListener('resize', checkIfMobile);
    
    return () => {
      window.removeEventListener('resize', checkIfMobile);
    };
  }, []);

  // Extract unique category names from products for the filter dropdown
  useEffect(() => {
    const categorySet = new Set<string>();
    products.forEach(product => {
      product.categories.forEach(category => {
        categorySet.add(category.name);
      });
    });
    setProductCategories(categorySet);
  }, [products]);

  // Función para cargar los datos con filtros
  const loadProducts = async (category: string = 'all') => {
    try {
      setIsInitialLoad(false);
      setLoading(true);
      const params = new URLSearchParams();

      if (category && category !== 'all') {
        // If we have full category data, find the category ID by name
        const categoryObj = categories.find(cat => cat.name === category);
        if (categoryObj) {
          params.append('category', categoryObj.id.toString());
        } else {
          params.append('category', category);
        }
      }

      if (searchTerm) {
        params.append('search', searchTerm);
      }

      const queryString = params.toString() ? `?${params.toString()}` : '';
      const response = await fetch(`/api/woo/get-products${queryString}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.data.products);
      } else {
        setError('Error al cargar los productos');
      }
    } catch (err) {
      setError('Error al cargar los productos');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  // Función para recargar los datos
  const refreshData = () => {
    loadProducts(categoryFilter);
  };

  // Filter products based on search term
  const filteredProducts = products.filter(product => {
    const searchMatch = 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.sku.toLowerCase().includes(searchTerm.toLowerCase()) ||
      product.short_description.toLowerCase().includes(searchTerm.toLowerCase());
    
    const categoryMatch = categoryFilter === 'all'
      ? true
      : product.categories.some(cat => cat.name === categoryFilter);
    
    return searchMatch && categoryMatch;
  });

  // Sort function for table columns
  const sortedProducts = React.useMemo(() => {
    let sortableProducts = [...filteredProducts];
    if (sortConfig !== null) {
      sortableProducts.sort((a, b) => {
        let aValue, bValue;
        
        switch(sortConfig.key) {
          case 'name':
            aValue = a.name.toLowerCase();
            bValue = b.name.toLowerCase();
            break;
          case 'sku':
            aValue = a.sku.toLowerCase();
            bValue = b.sku.toLowerCase();
            break;
          case 'price':
            aValue = parseFloat(a.price);
            bValue = parseFloat(b.price);
            break;
          case 'stock_status':
            aValue = a.stock_status;
            bValue = b.stock_status;
            break;
          case 'slug':
            aValue = a.slug?.toLowerCase() || '';
            bValue = b.slug?.toLowerCase() || '';
            break;
          default:
            return 0;
        }
        
        if (aValue < bValue) {
          return sortConfig.direction === 'ascending' ? -1 : 1;
        }
        if (aValue > bValue) {
          return sortConfig.direction === 'ascending' ? 1 : -1;
        }
        return 0;
      });
    }
    return sortableProducts;
  }, [filteredProducts, sortConfig]);

  // Request sort function
  const requestSort = (key: string) => {
    let direction: 'ascending' | 'descending' = 'ascending';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'ascending') {
      direction = 'descending';
    }
    setSortConfig({ key, direction });
  };

  // Sort indicator component
  const SortIndicator = ({ columnKey }: { columnKey: string }) => {
    if (sortConfig?.key !== columnKey) {
      return null;
    }
    return (
      <span className="ml-1">
        {sortConfig.direction === 'ascending' ? '↑' : '↓'}
      </span>
    );
  };

  const StockStatusBadge = ({ status }: { status: string }) => {
    const getStatusText = () => {
      switch(status) {
        case 'instock': return 'En stock';
        case 'outofstock': return 'Agotado';
        case 'onbackorder': return 'Pedido';
        default: return status;
      }
    };
    
    const getVariant = (): "default" | "secondary" | "destructive" | "outline" | null => {
      switch(status) {
        case 'instock': return 'default';
        case 'outofstock': return 'destructive';
        case 'onbackorder': return 'secondary';
        default: return 'outline';
      }
    };
    
    return (
      <Badge variant={getVariant()} className="text-xs font-medium py-0">
        {getStatusText()}
      </Badge>
    );
  };

  const ProductDetailsDialog = ({ product }: { product: Product }) => (
    <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-3 md:p-4">
      <DialogHeader className="pb-2">
        <DialogTitle className="text-foreground text-base md:text-lg">Detalles del Producto</DialogTitle>
        <DialogDescription className="text-xs">
          Información completa del producto seleccionado
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-4 py-2">
        {/* Información Principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            {product.images && product.images.length > 0 ? (
              <img 
                src={product.images[0]?.src} 
                alt={product.images[0]?.alt || product.name} 
                className="w-full h-48 object-contain bg-card rounded-md border"
              />
            ) : (
              <div className="w-full h-48 bg-card rounded-md border flex items-center justify-center">
                <span className="text-muted-foreground text-xs">No hay imagen disponible</span>
              </div>
            )}
          </div>
          
          <div className="space-y-3 bg-card p-3 rounded-md border">
            <div>
              <Label className="text-foreground text-xs">Nombre</Label>
              <div className="mt-0.5 text-foreground text-sm md:text-base font-medium">
                {product.name}
              </div>
            </div>
            
            <div>
              <Label className="text-foreground text-xs">SKU</Label>
              <div className="mt-0.5 text-foreground text-xs">{product.sku}</div>
            </div>
            
            <div>
              <Label className="text-foreground text-xs">Slug</Label>
              <div className="mt-0.5 text-foreground text-xs">{product.slug || '-'}</div>
            </div>
            
            <div>
              <Label className="text-foreground text-xs">Precio</Label>
              <div className="mt-0.5 text-foreground font-medium">${formatCurrency(product.price)}</div>
            </div>
            
            <div>
              <Label className="text-foreground text-xs">Estado</Label>
              <div className="mt-0.5">
                <StockStatusBadge status={product.stock_status} />
              </div>
            </div>

            <div>
              <Label className="text-foreground text-xs">Categorías</Label>
              <div className="mt-0.5 flex flex-wrap gap-1">
                {product.categories.map(category => (
                  <Badge key={category.id} variant="outline" className="text-2xs font-normal py-0 px-1.5">
                    {category.name}
                  </Badge>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {product.short_description && (
          <div className="bg-card p-3 rounded-md border">
            <Label className="text-foreground text-xs">Descripción</Label>
            <div 
              className="mt-0.5 text-foreground text-xs prose-sm max-w-none" 
              dangerouslySetInnerHTML={{ __html: product.short_description }}
            />
          </div>
        )}

        {/* Galería de imágenes adicionales */}
        {product.images && product.images.length > 1 && (
          <div>
            <Label className="text-foreground text-xs">Galería de imágenes</Label>
            <div className="grid grid-cols-4 gap-1 mt-0.5">
              {product.images.slice(1).map(image => (
                <img 
                  key={image.id}
                  src={image.src} 
                  alt={image.alt || product.name} 
                  className="w-full h-16 object-cover rounded-md border"
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </DialogContent>
  );

  // Render loading state
  if (loading && !isInitialLoad) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-foreground text-base">Productos</CardTitle>
            <CardDescription className="text-xs">Cargando productos...</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Skeleton className="h-8 w-full" />
            <Skeleton className="h-8 w-full" />
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-20 w-full" />
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-3 bg-destructive/10 text-destructive rounded-md text-sm">
        <p>{error}</p>
      </div>
    );
  }

  // Render the table rows or mobile cards for each product
  const renderProductItems = () => {
    if (filteredProducts.length === 0) {
      return (
        <div className="text-center py-6 text-muted-foreground text-sm">
          No se encontraron productos
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-2">
          {sortedProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden shadow-sm hover:shadow">
              <CardContent className="p-3">
                <div className="flex items-start gap-2 mb-2">
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]?.src} 
                      alt={product.name} 
                      className="w-12 h-12 object-cover rounded-sm border"
                    />
                  ) : (
                    <div className="w-12 h-12 bg-card rounded-sm border flex items-center justify-center">
                      <span className="text-muted-foreground text-2xs">N/A</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-foreground text-sm mb-0.5 truncate">
                      <a 
                        href={`/products/${product.id}`}
                        className="hover:text-primary hover:underline"
                      >
                        {product.name}
                      </a>
                    </h3>
                    <p className="text-2xs text-muted-foreground mb-0.5">SKU: {product.sku}</p>
                    <p className="text-2xs text-muted-foreground mb-1">Slug: {product.slug || '-'}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-2">
                  <div>
                    <p className="text-2xs text-muted-foreground mb-0.5">Precio</p>
                    <p className="text-sm font-bold text-foreground">${formatCurrency(product.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs text-muted-foreground mb-0.5">Estado</p>
                    <StockStatusBadge status={product.stock_status} />
                  </div>
                </div>
                
                <div className="mb-2">
                  <p className="text-2xs text-muted-foreground mb-0.5">Categorías</p>
                  <div className="flex flex-wrap gap-0.5">
                    {product.categories.map(category => (
                      <Badge key={category.id} variant="outline" className="text-2xs font-normal py-0 px-1.5">
                        {category.name}
                      </Badge>
                    ))}
                  </div>
                </div>
                
                <Dialog>
                  <DialogTrigger asChild>
                    <Button variant="outline" size="sm" className="w-full h-7 text-xs" onClick={() => setSelectedProduct(product)}>
                      Ver detalles <ChevronRight className="h-3 w-3 ml-1" />
                    </Button>
                  </DialogTrigger>
                  {selectedProduct && <ProductDetailsDialog product={selectedProduct} />}
                </Dialog>
              </CardContent>
            </Card>
          ))}
        </div>
      );
    }

    // Desktop view - Table layout
    return (
      <div className="rounded-md border overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead 
                className="text-foreground font-medium text-xs cursor-pointer"
                onClick={() => requestSort('name')}
              >
                Producto <SortIndicator columnKey="name" />
              </TableHead>
              <TableHead 
                className="text-foreground font-medium text-xs cursor-pointer"
                onClick={() => requestSort('sku')}
              >
                SKU <SortIndicator columnKey="sku" />
              </TableHead>
              <TableHead 
                className="text-foreground font-medium text-xs cursor-pointer"
                onClick={() => requestSort('slug')}
              >
                Slug <SortIndicator columnKey="slug" />
              </TableHead>
              <TableHead 
                className="text-foreground font-medium text-xs text-right cursor-pointer"
                onClick={() => requestSort('price')}
              >
                Precio <SortIndicator columnKey="price" />
              </TableHead>
              <TableHead 
                className="text-foreground font-medium text-xs cursor-pointer"
                onClick={() => requestSort('stock_status')}
              >
                Estado <SortIndicator columnKey="stock_status" />
              </TableHead>
              <TableHead className="text-foreground font-medium text-xs">Categorías</TableHead>
              <TableHead className="text-right text-foreground font-medium text-xs">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="text-foreground p-2">
                  <div className="flex items-center gap-2">
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]?.src} 
                        alt={product.name} 
                        className="w-8 h-8 object-cover rounded-sm border"
                      />
                    ) : (
                      <div className="w-8 h-8 bg-card rounded-sm border flex items-center justify-center">
                        <span className="text-muted-foreground text-2xs">N/A</span>
                      </div>
                    )}
                    <div className="font-medium text-sm">
                      <div className="flex gap-1 items-center">
                        <a 
                          href={`/products/${product.id}`}
                          className="text-foreground hover:text-primary hover:underline"
                        >
                          {product.name}
                        </a>
                        <a 
                          href={`/products/${product.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:text-primary/80 hover:underline inline-flex items-center"
                        >
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-foreground text-xs p-2">{product.sku}</TableCell>
                <TableCell className="text-foreground text-xs p-2">{product.slug || '-'}</TableCell>
                <TableCell className="text-foreground text-right font-bold text-sm p-2">${formatCurrency(product.price)}</TableCell>
                <TableCell className="p-2">
                  <StockStatusBadge status={product.stock_status} />
                </TableCell>
                <TableCell className="text-foreground p-2">
                  <div className="flex flex-wrap gap-0.5">
                    {product.categories.slice(0, 2).map(category => (
                      <Badge key={category.id} variant="outline" className="text-2xs font-normal py-0 px-1.5">
                        {category.name}
                      </Badge>
                    ))}
                    {product.categories.length > 2 && (
                      <Badge variant="outline" className="text-2xs font-normal py-0 px-1.5 bg-muted">
                        +{product.categories.length - 2}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right p-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="h-7 text-xs" onClick={() => setSelectedProduct(product)}>
                        Ver detalles
                      </Button>
                    </DialogTrigger>
                    {selectedProduct && <ProductDetailsDialog product={selectedProduct} />}
                  </Dialog>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {/* Filters */}
      <Card className="shadow-sm">
        <CardHeader className="pb-2 space-y-1">
          <CardTitle className="text-foreground text-base md:text-lg">Productos</CardTitle>
          <CardDescription className="text-xs">
            {initialTotal > 0 ? `${initialTotal} productos registrados` : 'Productos registrados'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 mb-4">
            <div className="relative">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-muted-foreground" />
              <Input 
                id="search" 
                placeholder="Buscar producto..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground text-sm pl-8 h-8"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-2">
              <div className="w-full sm:flex-1">
                <Select 
                  value={categoryFilter} 
                  onValueChange={(value) => {
                    setCategoryFilter(value);
                    if (!isInitialLoad) {
                      loadProducts(value);
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Todas las categorías" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs">Todas las categorías</SelectItem>
                    {categories.length > 0 ? (
                      categories.map(category => (
                        <SelectItem key={category.id} value={category.name} className="text-xs">
                          {category.name}
                        </SelectItem>
                      ))
                    ) : (
                      [...productCategories].map(category => (
                        <SelectItem key={category} value={category} className="text-xs">
                          {category}
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="w-full sm:w-auto">
                <Select
                  value={sortConfig ? `${sortConfig.key}-${sortConfig.direction}` : "default"}
                  onValueChange={(value) => {
                    if (value === "default") {
                      setSortConfig(null);
                    } else {
                      const [key, direction] = value.split('-') as [string, 'ascending' | 'descending'];
                      setSortConfig({ key, direction });
                    }
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Ordenar por" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="default" className="text-xs">Por defecto</SelectItem>
                    <SelectItem value="name-ascending" className="text-xs">Nombre (A-Z)</SelectItem>
                    <SelectItem value="name-descending" className="text-xs">Nombre (Z-A)</SelectItem>
                    <SelectItem value="price-ascending" className="text-xs">Precio (menor a mayor)</SelectItem>
                    <SelectItem value="price-descending" className="text-xs">Precio (mayor a menor)</SelectItem>
                    <SelectItem value="sku-ascending" className="text-xs">SKU (A-Z)</SelectItem>
                    <SelectItem value="sku-descending" className="text-xs">SKU (Z-A)</SelectItem>
                    <SelectItem value="slug-ascending" className="text-xs">Slug (A-Z)</SelectItem>
                    <SelectItem value="slug-descending" className="text-xs">Slug (Z-A)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <Button 
                variant="outline"
                className="h-8 text-xs sm:w-auto" 
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>

          {/* Products table or cards */}
          {renderProductItems()}
        </CardContent>
      </Card>
    </div>
  );
};

export default ProductsDashboard;
