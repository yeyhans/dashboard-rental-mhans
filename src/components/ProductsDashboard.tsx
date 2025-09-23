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
import { ExternalLink, RefreshCw } from 'lucide-react';
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
  const [categories] = useState<ProductCategory[]>(initialCategories);
  const [productCategories, setProductCategories] = useState<Set<string>>(new Set());
  const [isMobileView, setIsMobileView] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'ascending' | 'descending'} | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [totalProducts, setTotalProducts] = useState(initialTotal);
  const [totalPages, setTotalPages] = useState(Math.ceil(initialTotal / 50));
  const [itemsPerPage] = useState(50);

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
      if (product.categories_name) {
        // Split categories_name by comma and add each category
        const categoryNames = product.categories_name.split(',').map(name => name.trim());
        categoryNames.forEach(name => {
          if (name) categorySet.add(name);
        });
      }
    });
    setProductCategories(categorySet);
  }, [products]);

  // Function to load data with filters and pagination
  const loadProducts = async (category: string = 'all', page: number = 1, search: string = '') => {
    try {
      setIsInitialLoad(false);
      setLoading(true);
      setError(null);
      
      const params = new URLSearchParams();
      params.append('page', page.toString());
      params.append('limit', itemsPerPage.toString());

      const searchTerm = search.trim();
      if (searchTerm) {
        params.append('search', searchTerm);
      }

      if (category && category !== 'all') {
        // Use the category ID directly if it's a number, otherwise find by name
        const categoryId = parseInt(category, 10);
        if (!isNaN(categoryId)) {
          params.append('categoryId', categoryId.toString());
        } else {
          const categoryObj = categories.find(cat => cat.name === category);
          if (categoryObj) {
            params.append('categoryId', categoryObj.id.toString());
          }
        }
      }

      const response = await fetch(`/api/products/search?${params.toString()}`);
      const data = await response.json();
      
      if (data.success) {
        setProducts(data.data.products);
        setTotalProducts(data.data.total);
        setTotalPages(data.data.totalPages);
        setCurrentPage(data.data.page);
      } else {
        setError(data.message || 'Error al cargar los productos');
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
    loadProducts(categoryFilter, currentPage, searchTerm);
  };

  // Add debounce for search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!isInitialLoad) {
        loadProducts(categoryFilter, currentPage, searchTerm);
      }
    }, 500); // 500ms debounce delay
    
    return () => clearTimeout(timer);
  }, [searchTerm, categoryFilter, currentPage]);

  // Handle search input change
  const handleSearch = (term: string) => {
    setSearchTerm(term);
    setCurrentPage(1);
  };

  // Handle category change
  const handleCategoryChange = (category: string) => {
    setCategoryFilter(category);
    setCurrentPage(1);
  };

  // Handle page change
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Filter products based on search and category
  const filteredProducts = React.useMemo(() => {
    return products.filter(product => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filter by category
      const matchesCategory = categoryFilter === 'all' || 
        (product.categories_name && product.categories_name.includes(categoryFilter));
      
      return matchesSearch && matchesCategory;
    });
  }, [products, searchTerm, categoryFilter]);

  // Sort function for table columns
  const sortedProducts = React.useMemo(() => {
    let sortableProducts = [...filteredProducts];
    if (sortConfig !== null) {
      sortableProducts.sort((a, b) => {
        let aValue, bValue;
        
        switch(sortConfig.key) {
          case 'name':
            aValue = (a.name || '').toLowerCase();
            bValue = (b.name || '').toLowerCase();
            break;
          case 'sku':
            aValue = (a.sku || '').toLowerCase();
            bValue = (b.sku || '').toLowerCase();
            break;
          case 'price':
            aValue = a.price || 0;
            bValue = b.price || 0;
            break;
          case 'stock_status':
            aValue = a.stock_status || '';
            bValue = b.stock_status || '';
            break;
          case 'slug':
            aValue = (a.slug || '').toLowerCase();
            bValue = (b.slug || '').toLowerCase();
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
                  {product.images && Array.isArray(product.images) && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]} 
                      alt={product.name || 'Product'} 
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
                    <p className="text-sm font-bold text-foreground">${formatCurrency(product.price || 0)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-2xs text-muted-foreground mb-0.5">Estado</p>
                    <StockStatusBadge status={product.stock_status || 'outofstock'} />
                  </div>
                </div>
                
                <div className="mb-2">
                  <p className="text-2xs text-muted-foreground mb-0.5">Categorías</p>
                  <div className="flex flex-wrap gap-0.5">
                    {product.categories_name ? (
                      <Badge variant="outline" className="text-2xs font-normal py-0 px-1.5">
                        {product.categories_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-2xs">Sin categoría</span>
                    )}
                  </div>
                </div>
                
                <Button variant="outline" size="sm" className="w-full h-7 text-xs" asChild>
                  <a href={`/products/${product.id}`}>
                    Ver detalles
                  </a>
                </Button>
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
                    {product.images && Array.isArray(product.images) && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]} 
                        alt={product.name || 'Product'} 
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
                <TableCell className="text-foreground text-right font-bold text-sm p-2">${formatCurrency(product.price || 0)}</TableCell>
                <TableCell className="p-2">
                  <StockStatusBadge status={product.stock_status || 'outofstock'} />
                </TableCell>
                <TableCell className="text-foreground p-2">
                  <div className="flex flex-wrap gap-0.5">
                    {product.categories_name ? (
                      <Badge variant="outline" className="text-2xs font-normal py-0 px-1.5">
                        {product.categories_name}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground text-2xs">Sin categoría</span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right p-2">
                  <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                    <a href={`/products/${product.id}`}>
                      Ver detalles
                    </a>
                  </Button>
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
            {totalProducts > 0 ? `${totalProducts} productos registrados` : 'Productos registrados'}
            {totalPages > 1 && ` - Página ${currentPage} de ${totalPages}`}
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-2">
          <div className="flex flex-col sm:flex-row gap-4 mb-4">
            <div className="flex-1">
              <Input
                placeholder="Buscar productos..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="w-full"
              />
            </div>
            <div className="flex gap-2">
              <Select
                value={categoryFilter} 
                onValueChange={handleCategoryChange}
              >
                <SelectTrigger className="h-10 text-xs min-w-[180px]">
                  <SelectValue placeholder="Todas las categorías" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">
                    Todas las categorías
                  </SelectItem>
                  {categories.length > 0 ? (
                    categories.map(category => (
                      <SelectItem key={category.id} value={category.id.toString()} className="text-xs">
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
                <SelectTrigger className="h-10 text-xs min-w-[180px]">
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
              
              <Button 
                variant="outline"
                className="h-10 text-xs" 
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className={`h-3 w-3 mr-1 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Actualizando...' : 'Actualizar'}
              </Button>
            </div>
          </div>
          
          {/* Products table or cards */}
          <div className="mt-4">
            {renderProductItems()}
          </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-between pt-4 mt-4 border-t gap-4">
                <div className="text-xs text-muted-foreground">
                  Mostrando {((currentPage - 1) * itemsPerPage) + 1} a {Math.min(currentPage * itemsPerPage, totalProducts)} de {totalProducts} productos
                </div>
                <div className="flex flex-col sm:flex-row items-center gap-2">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage - 1)}
                      disabled={currentPage <= 1 || loading}
                      className="h-8 text-xs"
                    >
                      Anterior
                    </Button>
                    
                    <div className="flex items-center gap-1">
                      {/* Show page numbers */}
                      {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                        let pageNum;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(pageNum)}
                            disabled={loading}
                            className="h-8 w-8 text-xs p-0"
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handlePageChange(currentPage + 1)}
                      disabled={currentPage >= totalPages || loading}
                      className="h-8 text-xs"
                    >
                      Siguiente
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
  );
};

export default ProductsDashboard;
