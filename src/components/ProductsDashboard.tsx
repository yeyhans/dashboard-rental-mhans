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
import type { Product, ProductCategory } from '../types/product';
import { ChevronRight, ExternalLink, RefreshCw, Search } from 'lucide-react';

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
  const [categoryFilter, setCategoryFilter] = useState<string>('');
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<ProductCategory[]>(initialCategories);
  const [productCategories, setProductCategories] = useState<Set<string>>(new Set());
  const [isMobileView, setIsMobileView] = useState(false);

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
  const loadProducts = async (category: string = '') => {
    try {
      setIsInitialLoad(false);
      setLoading(true);
      const params = new URLSearchParams();

      if (category) {
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
    
    const categoryMatch = categoryFilter 
      ? product.categories.some(cat => cat.name === categoryFilter)
      : true;
    
    return searchMatch && categoryMatch;
  });

  const ProductDetailsDialog = ({ product }: { product: Product }) => (
    <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto w-[95vw] md:w-auto p-4 md:p-6">
      <DialogHeader>
        <DialogTitle className="text-foreground text-xl">Detalles del Producto</DialogTitle>
        <DialogDescription>
          Información completa del producto seleccionado
        </DialogDescription>
      </DialogHeader>

      <div className="space-y-6 py-4">
        {/* Acciones rápidas */}
        <div className="flex justify-end">
          <a 
            href={`https://rental.mariohans.cl/wp-admin/post.php?post=${product.id}&action=edit`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <Button>
              <ExternalLink className="h-4 w-4 mr-2" />
              Editar en WordPress
            </Button>
          </a>
        </div>

        {/* Información Principal */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            {product.images && product.images.length > 0 ? (
              <img 
                src={product.images[0]?.src} 
                alt={product.images[0]?.alt || product.name} 
                className="w-full h-64 object-contain bg-card rounded-lg border"
              />
            ) : (
              <div className="w-full h-64 bg-card rounded-lg border flex items-center justify-center">
                <span className="text-muted-foreground">No hay imagen disponible</span>
              </div>
            )}
          </div>
          
          <div className="space-y-4 bg-card p-4 rounded-lg border">
            <div>
              <Label className="text-foreground font-medium">Nombre</Label>
              <div className="mt-1 text-foreground text-xl font-medium">
                <a 
                  href={`https://rental.mariohans.cl/wp-admin/post.php?post=${product.id}&action=edit`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80 hover:underline"
                >
                  {product.name}
                </a>
              </div>
            </div>
            
            <div>
              <Label className="text-foreground font-medium">SKU</Label>
              <div className="mt-1 text-foreground">{product.sku}</div>
            </div>
            
            <div>
              <Label className="text-foreground font-medium">Precio</Label>
              <div className="mt-1 text-foreground text-lg font-medium">${formatCurrency(product.price)}</div>
            </div>
            
            <div>
              <Label className="text-foreground font-medium">Estado</Label>
              <div className="mt-1">
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stockStatusColors[product.stock_status] || 'bg-gray-100 text-gray-800'}`}>
                  {product.stock_status === 'instock' ? 'En stock' : 
                   product.stock_status === 'outofstock' ? 'Agotado' : 
                   product.stock_status === 'onbackorder' ? 'Por pedido' : product.stock_status}
                </span>
              </div>
            </div>

            <div>
              <Label className="text-foreground font-medium">Categorías</Label>
              <div className="mt-1 flex flex-wrap gap-1">
                {product.categories.map(category => (
                  <span key={category.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                    {category.name}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Descripción */}
        {product.short_description && (
          <div className="bg-card p-4 rounded-lg border">
            <Label className="text-foreground font-medium">Descripción</Label>
            <div 
              className="mt-1 text-foreground" 
              dangerouslySetInnerHTML={{ __html: product.short_description }}
            />
          </div>
        )}

        {/* Galería de imágenes adicionales */}
        {product.images && product.images.length > 1 && (
          <div>
            <Label className="text-foreground font-medium">Galería de imágenes</Label>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
              {product.images.slice(1).map(image => (
                <img 
                  key={image.id}
                  src={image.src} 
                  alt={image.alt || product.name} 
                  className="w-full h-24 object-cover rounded-lg border"
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
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2 text-foreground">Cargando productos...</p>
        </div>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="p-4 bg-destructive/10 text-destructive rounded-md">
        <p>{error}</p>
      </div>
    );
  }

  // Render the table rows or mobile cards for each product
  const renderProductItems = () => {
    if (filteredProducts.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          No se encontraron productos
        </div>
      );
    }

    // Mobile view - Card layout
    if (isMobileView) {
      return (
        <div className="space-y-4">
          {filteredProducts.map((product) => (
            <Card key={product.id} className="overflow-hidden">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-3">
                  {product.images && product.images.length > 0 ? (
                    <img 
                      src={product.images[0]?.src} 
                      alt={product.name} 
                      className="w-16 h-16 object-cover rounded border"
                    />
                  ) : (
                    <div className="w-16 h-16 bg-card rounded border flex items-center justify-center">
                      <span className="text-muted-foreground text-xs">N/A</span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-foreground text-lg mb-1 truncate">{product.name}</h3>
                    <p className="text-sm text-muted-foreground mb-2">SKU: {product.sku}</p>
                  </div>
                </div>
                
                <div className="grid grid-cols-2 gap-2 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Precio</p>
                    <p className="text-lg font-bold text-foreground">${formatCurrency(product.price)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">Estado</p>
                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stockStatusColors[product.stock_status] || 'bg-gray-100 text-gray-800'}`}>
                      {product.stock_status === 'instock' ? 'En stock' : 
                       product.stock_status === 'outofstock' ? 'Agotado' : 
                       product.stock_status === 'onbackorder' ? 'Por pedido' : product.stock_status}
                    </span>
                  </div>
                </div>
                
                <div className="mb-3">
                  <p className="text-xs text-muted-foreground mb-1">Categorías</p>
                  <div className="flex flex-wrap gap-1">
                    {product.categories.map(category => (
                      <span key={category.id} className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {category.name}
                      </span>
                    ))}
                  </div>
                </div>
                
                <div className="flex flex-col gap-2">
                  <Dialog>
                    <DialogTrigger asChild>
                      <Button variant="outline" size="sm" className="w-full" onClick={() => setSelectedProduct(product)}>
                        Ver detalles <ChevronRight className="h-4 w-4 ml-2" />
                      </Button>
                    </DialogTrigger>
                    {selectedProduct && <ProductDetailsDialog product={selectedProduct} />}
                  </Dialog>
                  
                  <a 
                    href={`https://rental.mariohans.cl/wp-admin/post.php?post=${product.id}&action=edit`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full"
                  >
                    <Button variant="secondary" size="sm" className="w-full">
                      <ExternalLink className="h-4 w-4 mr-2" />
                      Editar
                    </Button>
                  </a>
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
              <TableHead className="text-foreground font-semibold">Producto</TableHead>
              <TableHead className="text-foreground font-semibold">SKU</TableHead>
              <TableHead className="text-foreground font-semibold text-right">Precio</TableHead>
              <TableHead className="text-foreground font-semibold">Estado</TableHead>
              <TableHead className="text-foreground font-semibold">Categorías</TableHead>
              <TableHead className="text-right text-foreground font-semibold">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredProducts.map((product) => (
              <TableRow key={product.id}>
                <TableCell className="text-foreground">
                  <div className="flex items-center gap-2">
                    {product.images && product.images.length > 0 ? (
                      <img 
                        src={product.images[0]?.src} 
                        alt={product.name} 
                        className="w-10 h-10 object-cover rounded border"
                      />
                    ) : (
                      <div className="w-10 h-10 bg-card rounded border flex items-center justify-center">
                        <span className="text-muted-foreground text-xs">N/A</span>
                      </div>
                    )}
                    <div className="font-medium">
                      <a 
                        href={`https://rental.mariohans.cl/wp-admin/post.php?post=${product.id}&action=edit`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 hover:underline"
                      >
                        {product.name}
                      </a>
                    </div>
                  </div>
                </TableCell>
                <TableCell className="text-foreground font-medium">{product.sku}</TableCell>
                <TableCell className="text-foreground text-right font-bold">${formatCurrency(product.price)}</TableCell>
                <TableCell>
                  <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium ${stockStatusColors[product.stock_status] || 'bg-gray-100 text-gray-800'}`}>
                    {product.stock_status === 'instock' ? 'En stock' : 
                     product.stock_status === 'outofstock' ? 'Agotado' : 
                     product.stock_status === 'onbackorder' ? 'Por pedido' : product.stock_status}
                  </span>
                </TableCell>
                <TableCell className="text-foreground">
                  <div className="flex flex-wrap gap-1">
                    {product.categories.slice(0, 2).map(category => (
                      <span key={category.id} className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                        {category.name}
                      </span>
                    ))}
                    {product.categories.length > 2 && (
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        +{product.categories.length - 2}
                      </span>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right">
                  <div className="flex justify-end gap-2">
                    <a 
                      href={`https://rental.mariohans.cl/wp-admin/post.php?post=${product.id}&action=edit`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button variant="outline" size="sm">
                        Editar
                      </Button>
                    </a>
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" size="sm" onClick={() => setSelectedProduct(product)}>
                          Ver detalles
                        </Button>
                      </DialogTrigger>
                      {selectedProduct && <ProductDetailsDialog product={selectedProduct} />}
                    </Dialog>
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
    <div className="space-y-6">
      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-foreground text-xl">Productos</CardTitle>
          <CardDescription>
            Gestiona y visualiza todos los productos registrados {initialTotal > 0 ? `(${initialTotal} en total)` : ''}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 mb-6">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input 
                id="search" 
                placeholder="Buscar por nombre, SKU, descripción..." 
                value={searchTerm} 
                onChange={(e) => setSearchTerm(e.target.value)}
                className="text-foreground pl-10"
              />
            </div>
            
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="w-full sm:flex-1">
                <select
                  id="category"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 text-foreground"
                  value={categoryFilter}
                  onChange={(e) => {
                    setCategoryFilter(e.target.value);
                    if (!isInitialLoad) {
                      loadProducts(e.target.value);
                    }
                  }}
                >
                  <option value="">Todas las categorías</option>
                  {categories.length > 0 ? (
                    // Use full category data if available
                    categories.map(category => (
                      <option key={category.id} value={category.name}>
                        {category.name}
                      </option>
                    ))
                  ) : (
                    // Fallback to product category names
                    [...productCategories].map(category => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))
                  )}
                </select>
              </div>
              
              <Button 
                className="w-full sm:w-auto" 
                onClick={refreshData}
                disabled={loading}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
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
