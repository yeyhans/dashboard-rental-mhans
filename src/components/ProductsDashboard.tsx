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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "./ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "./ui/alert-dialog";
import type { Product, ProductCategory } from '../types/product';
import { ExternalLink, RefreshCw, Plus, Trash2 } from 'lucide-react';
import React from 'react';
import ProductForm from './products/ProductForm';

// Helper function to format currency with thousands separator
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface ProductsDashboardProps {
  initialProducts: Product[];
  initialTotal: number;
  initialCategories?: ProductCategory[];
  accessToken: string;
}

const ProductsDashboard = ({ 
  initialProducts,
  initialTotal,
  initialCategories = [],
  accessToken
}: ProductsDashboardProps) => {
  // All products loaded from server
  const [allProducts, setAllProducts] = useState<Product[]>(initialProducts);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [isCreating, setIsCreating] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState<number | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [categories] = useState<ProductCategory[]>(initialCategories);
  const [isMobileView, setIsMobileView] = useState(false);
  const [sortConfig, setSortConfig] = useState<{key: string, direction: 'ascending' | 'descending'} | null>(null);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

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
  const productCategories = React.useMemo(() => {
    const categorySet = new Set<string>();
    allProducts.forEach(product => {
      if (product.categories_name) {
        // Split categories_name by comma and add each category
        const categoryNames = product.categories_name.split(',').map(name => name.trim());
        categoryNames.forEach(name => {
          if (name) categorySet.add(name);
        });
      }
    });
    return categorySet;
  }, [allProducts]);

  // Filter products based on search and category
  const filteredProducts = React.useMemo(() => {
    return allProducts.filter(product => {
      // Filter by search term
      const matchesSearch = !searchTerm || 
        (product.name && product.name.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.sku && product.sku.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (product.slug && product.slug.toLowerCase().includes(searchTerm.toLowerCase()));
      
      // Filter by category
      const matchesCategory = categoryFilter === 'all' || 
        (product.categories_name && product.categories_name.includes(categoryFilter));
      
      return matchesSearch && matchesCategory;
    });
  }, [allProducts, searchTerm, categoryFilter]);

  // Calculate pagination
  const totalFilteredProducts = filteredProducts.length;
  const totalPages = Math.ceil(totalFilteredProducts / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentProducts = filteredProducts.slice(startIndex, endIndex);

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

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1);
  };

  // Reset page when search or category changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, categoryFilter]);

  // Refresh data - reload the page to get fresh server-side data
  const refreshData = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Handle product deletion
  const handleDeleteProduct = async (product: Product) => {
    if (!product.id) {
      console.error('❌ Dashboard: Product ID is missing');
      alert('Error: ID del producto no encontrado');
      return;
    }

    if (!accessToken) {
      console.error('❌ Dashboard: Access token not available');
      alert('Error: No se encontró token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setDeletingProductId(product.id);
    try {
      console.log('🗑️ Dashboard: Eliminando producto via API:', product.id);
      const response = await fetch(`/api/products/${product.id}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar el producto');
      }

      console.log('✅ Dashboard: Producto eliminado exitosamente:', product.id);
      
      // Remove product from the list
      setAllProducts(prev => prev.filter(p => p.id !== product.id));
      
      // Show success message
      console.log('🎉 Dashboard: Mostrando mensaje de éxito de eliminación');
      alert(`Producto "${product.name}" eliminado exitosamente`);
      
    } catch (error) {
      console.error('❌ Dashboard: Error deleting product:', error);
      alert(error instanceof Error ? error.message : 'Error al eliminar el producto');
    } finally {
      setDeletingProductId(null);
      setShowDeleteDialog(false);
      setProductToDelete(null);
    }
  };

  // Show delete confirmation dialog
  const confirmDeleteProduct = (product: Product) => {
    setProductToDelete(product);
    setShowDeleteDialog(true);
  };

  // Handle product creation
  const handleCreateProduct = async (productData: any) => {
    if (!accessToken) {
      console.error('❌ Dashboard: Access token not available');
      alert('Error: No se encontró token de autenticación. Por favor, inicia sesión nuevamente.');
      return;
    }

    setIsCreating(true);
    try {
      console.log('📎 Dashboard: Creando producto via API');
      const response = await fetch('/api/products/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(productData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || 'Error al crear el producto');
      }

      console.log('✅ Dashboard: Producto creado exitosamente:', result.data);
      
      // Add new product to the list
      setAllProducts(prev => [result.data, ...prev]);
      setShowCreateForm(false);
      
      // Show success message
      console.log('🎉 Dashboard: Mostrando mensaje de éxito');
      alert('Producto creado exitosamente');
      
      // Return the created product so ProductForm can handle images
      return result.data;
      
    } catch (error) {
      console.error('❌ Dashboard: Error creating product:', error);
      alert(error instanceof Error ? error.message : 'Error al crear el producto');
      throw error; // Re-throw so ProductForm can handle it
    } finally {
      setIsCreating(false);
    }
  };

  // Sort function for table columns
  const sortedProducts = React.useMemo(() => {
    let sortableProducts = [...currentProducts];
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
  }, [currentProducts, sortConfig]);

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

  // Loading skeleton component
  const LoadingSkeleton = () => (
    <div className="space-y-4">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="flex items-center space-x-4 p-4 border rounded-lg">
          <Skeleton className="h-12 w-12 rounded" />
          <div className="space-y-2 flex-1">
            <Skeleton className="h-4 w-[250px]" />
            <Skeleton className="h-4 w-[200px]" />
          </div>
          <Skeleton className="h-8 w-[100px]" />
        </div>
      ))}
    </div>
  );

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
    if (loading) {
      return <LoadingSkeleton />;
    }

    if (sortedProducts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <div className="text-sm">
            {searchTerm || categoryFilter !== 'all' 
              ? 'No se encontraron productos que coincidan con los filtros' 
              : 'No hay productos disponibles'}
          </div>
          {(searchTerm || categoryFilter !== 'all') && (
            <p className="text-xs mt-2">Intenta con otros términos de búsqueda o filtros</p>
          )}
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
                
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 h-7 text-xs" asChild>
                    <a href={`/products/${product.id}`}>
                      Ver detalles
                    </a>
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                    onClick={() => confirmDeleteProduct(product)}
                    disabled={deletingProductId === product.id}
                    title="Eliminar producto"
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
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
                  <div className="flex gap-1 justify-end">
                    <Button variant="outline" size="sm" className="h-7 text-xs" asChild>
                      <a href={`/products/${product.id}`}>
                        Ver detalles
                      </a>
                    </Button>
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="h-7 w-7 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                      onClick={() => confirmDeleteProduct(product)}
                      disabled={deletingProductId === product.id}
                      title="Eliminar producto"
                    >
                      {deletingProductId === product.id ? (
                        <RefreshCw className="h-3 w-3 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3" />
                      )}
                    </Button>
                  </div>
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
            {searchTerm && (
              <span className="block mt-1">
                Mostrando {totalFilteredProducts} resultados para "{searchTerm}"
              </span>
            )}
            {categoryFilter !== 'all' && (
              <span className="block mt-1">
                Filtrado por categoría: {categoryFilter}
              </span>
            )}
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
              
              <Dialog open={showCreateForm} onOpenChange={setShowCreateForm}>
                <DialogTrigger asChild>
                  <Button className="h-10 text-xs">
                    <Plus className="h-3 w-3 mr-1" />
                    Crear Producto
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                  <DialogHeader>
                    <DialogTitle>Crear Nuevo Producto</DialogTitle>
                    <DialogDescription>
                      Completa la información del producto. Los campos marcados con * son obligatorios.
                    </DialogDescription>
                  </DialogHeader>
                  <ProductForm
                    onSubmit={handleCreateProduct}
                    onCancel={() => setShowCreateForm(false)}
                    categories={categories}
                    loading={isCreating}
                  />
                </DialogContent>
              </Dialog>

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

          {/* Pagination and Controls */}
          <div className="mt-6 space-y-4">
            {/* Items per page selector */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Label className="text-sm text-muted-foreground">Mostrar:</Label>
                <select
                  value={itemsPerPage}
                  onChange={(e) => handleItemsPerPageChange(Number(e.target.value))}
                  className="px-3 py-1 border rounded-md text-sm bg-background"
                >
                  <option value={10}>10</option>
                  <option value={25}>25</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(endIndex, totalFilteredProducts)} de {totalFilteredProducts} productos
                {(searchTerm || categoryFilter !== 'all') && ` (filtrados de ${initialTotal} total)`}
              </div>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(1)}
                    disabled={currentPage === 1 || loading}
                  >
                    Primera
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.max(1, currentPage - 1))}
                    disabled={currentPage === 1 || loading}
                  >
                    Anterior
                  </Button>
                  
                  {/* Page numbers */}
                  <div className="flex items-center gap-1 mx-2">
                    {(() => {
                      const pages = [];
                      const maxVisiblePages = 5;
                      let startPage = Math.max(1, currentPage - Math.floor(maxVisiblePages / 2));
                      let endPage = Math.min(totalPages, startPage + maxVisiblePages - 1);
                      
                      // Adjust start if we're near the end
                      if (endPage - startPage + 1 < maxVisiblePages) {
                        startPage = Math.max(1, endPage - maxVisiblePages + 1);
                      }
                      
                      // Show first page and ellipsis if needed
                      if (startPage > 1) {
                        pages.push(
                          <Button
                            key={1}
                            variant={1 === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(1)}
                            className="w-9 h-9 p-0"
                          >
                            1
                          </Button>
                        );
                        if (startPage > 2) {
                          pages.push(
                            <span key="ellipsis1" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                      }
                      
                      // Show visible page range
                      for (let i = startPage; i <= endPage; i++) {
                        pages.push(
                          <Button
                            key={i}
                            variant={i === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(i)}
                            className="w-9 h-9 p-0"
                          >
                            {i}
                          </Button>
                        );
                      }
                      
                      // Show last page and ellipsis if needed
                      if (endPage < totalPages) {
                        if (endPage < totalPages - 1) {
                          pages.push(
                            <span key="ellipsis2" className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                        pages.push(
                          <Button
                            key={totalPages}
                            variant={totalPages === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(totalPages)}
                            className="w-9 h-9 p-0"
                          >
                            {totalPages}
                          </Button>
                        );
                      }
                      
                      return pages;
                    })()}
                  </div>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(Math.min(totalPages, currentPage + 1))}
                    disabled={currentPage === totalPages || loading}
                  >
                    Siguiente
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(totalPages)}
                    disabled={currentPage === totalPages || loading}
                  >
                    Última
                  </Button>
                </div>
              </div>
            )}
          </div>
          </CardContent>
        </Card>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>¿Eliminar producto?</AlertDialogTitle>
              <AlertDialogDescription>
                Esta acción no se puede deshacer. Se eliminará permanentemente el producto:
                <br />
                <strong className="text-foreground">"{productToDelete?.name}"</strong>
                <br />
                SKU: <strong className="text-foreground">{productToDelete?.sku || 'N/A'}</strong>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel 
                onClick={() => {
                  setShowDeleteDialog(false);
                  setProductToDelete(null);
                }}
                disabled={deletingProductId !== null}
              >
                Cancelar
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={() => productToDelete && handleDeleteProduct(productToDelete)}
                disabled={deletingProductId !== null}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                {deletingProductId !== null ? (
                  <>
                    <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                    Eliminando...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-3 w-3 mr-1" />
                    Eliminar
                  </>
                )}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
  );
};

export default ProductsDashboard;
