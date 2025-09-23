import { useState, useCallback, useMemo, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Alert, AlertDescription } from '../ui/alert';
import { Skeleton } from '../ui/skeleton';
import { Badge } from '../ui/badge';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '../ui/command';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '../ui/tooltip';
import type { Database } from '../../types/database';

// Database types
type DatabaseProduct = Database['public']['Tables']['products']['Row'];

// Enhanced Product type with proper typing
export interface EnhancedProduct extends Omit<DatabaseProduct, 'images'> {
  images?: Array<{
    id: number;
    src: string;
    alt?: string;
  }> | null;
  categories?: Array<{
    id: number;
    name: string;
    slug: string;
  }>;
  stock_quantity?: number;
  manage_stock?: boolean;
  in_stock?: boolean;
}

// Enhanced LineItem type with proper typing
export interface EnhancedLineItem {
  id?: number;
  product_id: number;
  product_name: string;
  product_price: number;
  quantity: number;
  total: number;
  sku?: string;
  image?: string;
  meta_data?: Record<string, any>;
}

// SVG Icons
const PlusIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M5 12h14" />
    <path d="m12 5 7 7-7 7" />
  </svg>
);

const SaveIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17,21 17,13 7,13 7,21" />
    <polyline points="7,3 7,8 15,8" />
  </svg>
);

const XIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="m18 6-12 12" />
    <path d="m6 6 12 12" />
  </svg>
);

const EditIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="m18.5 2.5 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

const SearchIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.35-4.35" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4">
    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z" />
    <path d="M12 9v4" />
    <path d="m12 17 .01 0" />
  </svg>
);

// Helper functions
const formatCurrency = (value: string | number, currency: string = 'CLP') => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  
  return new Intl.NumberFormat('es-CL', {
    style: 'currency',
    currency: currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(numValue);
};

const formatNumber = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  if (isNaN(numValue)) return '0';
  
  return new Intl.NumberFormat('es-CL').format(numValue);
};

const validateQuantity = (quantity: number): boolean => {
  return Number.isInteger(quantity) && quantity > 0;
};

const validatePriceValue = (price: number): boolean => {
  return !isNaN(price) && price >= 0;
};

interface ProductSelectorProps {
  products: EnhancedProduct[];
  lineItems: EnhancedLineItem[];
  numDays?: number;
  onAddProduct: (product: EnhancedProduct, quantity: number) => void;
  onRemoveProduct: (index: number) => void;
  onUpdateProduct?: (itemId: number, updates: Partial<EnhancedLineItem>) => void;
  loading?: boolean;
  error?: string | null;
  mode: 'create' | 'edit' | 'view';
  showProductImages?: boolean;
  currency?: string;
  maxQuantityPerProduct?: number;
  onError?: (error: string) => void;
  onSuccess?: (message: string) => void;
  enableStockFilter?: boolean;
  validateStock?: boolean;
  validatePriceInput?: boolean;
}

export const ProductSelector = ({
  products,
  lineItems,
  numDays = 1,
  onAddProduct,
  onRemoveProduct,
  onUpdateProduct,
  loading = false,
  error = null,
  mode = 'create',
  showProductImages = true,
  currency = 'CLP',
  maxQuantityPerProduct = 999,
  onError,
  onSuccess,
  enableStockFilter = true,
  validateStock = true,
  validatePriceInput = true
}: ProductSelectorProps) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editedItems, setEditedItems] = useState<{ [key: string]: Partial<EnhancedLineItem> }>({});
  const [open, setOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<EnhancedProduct | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in_stock' | 'out_of_stock'>('all');
  const [localError, setLocalError] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<{ [key: string]: string }>({});

  const handleAddProduct = useCallback(() => {
    try {
      setLocalError(null);
      setValidationErrors({});
      
      const product = products.find(p => p.id.toString() === selectedProductId);
      if (!product) {
        const errorMsg = 'Producto no encontrado';
        setLocalError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      if (!validateQuantity(selectedQuantity)) {
        const errorMsg = 'La cantidad debe ser un número entero mayor a 0';
        setValidationErrors({ quantity: errorMsg });
        onError?.(errorMsg);
        return;
      }

      if (selectedQuantity > maxQuantityPerProduct) {
        const errorMsg = `La cantidad máxima permitida es ${maxQuantityPerProduct}`;
        setValidationErrors({ quantity: errorMsg });
        onError?.(errorMsg);
        return;
      }

      if (validateStock && product.stock_status === 'outofstock') {
        const errorMsg = 'Producto sin stock disponible';
        setLocalError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      if (validatePriceInput && (!product.price || !validatePriceValue(product.price))) {
        const errorMsg = 'Precio del producto no válido';
        setLocalError(errorMsg);
        onError?.(errorMsg);
        return;
      }

      const existingItemIndex = lineItems.findIndex(
        item => item.product_id.toString() === product.id.toString()
      );
      
      if (existingItemIndex !== -1 && lineItems[existingItemIndex]) {
        const currentQuantity = lineItems[existingItemIndex].quantity;
        const newQuantity = currentQuantity + selectedQuantity;
        
        if (newQuantity > maxQuantityPerProduct) {
          const errorMsg = `La cantidad total no puede exceder ${maxQuantityPerProduct}`;
          setValidationErrors({ quantity: errorMsg });
          onError?.(errorMsg);
          return;
        }
        
        onRemoveProduct(existingItemIndex);
        onAddProduct(product, newQuantity);
      } else {
        onAddProduct(product, selectedQuantity);
      }
      
      setSelectedProductId('');
      setSelectedQuantity(1);
      setSelectedProduct(null);
      
      onSuccess?.(`Producto "${product.name}" agregado correctamente`);
    } catch (err) {
      const errorMsg = 'Error al agregar el producto';
      setLocalError(errorMsg);
      onError?.(errorMsg);
      console.error('Error adding product:', err);
    }
  }, [products, selectedProductId, selectedQuantity, lineItems, maxQuantityPerProduct, validateStock, validatePriceInput, onAddProduct, onRemoveProduct, onError, onSuccess]);

  const handleSelectProduct = useCallback((product: EnhancedProduct) => {
    setSelectedProduct(product);
    setSelectedProductId(product.id.toString());
    setOpen(false);
    setLocalError(null);
    setValidationErrors({});
  }, []);

  const filteredProducts = useMemo(() => {
    let filtered = products;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        product.name?.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
      );
    }

    if (enableStockFilter && stockFilter !== 'all') {
      filtered = filtered.filter(product => {
        if (stockFilter === 'in_stock') {
          return product.stock_status === 'instock';
        } else if (stockFilter === 'out_of_stock') {
          return product.stock_status === 'outofstock';
        }
        return true;
      });
    }

    filtered = filtered.filter(product => product.status === 'publish');

    return filtered;
  }, [products, searchQuery, stockFilter, enableStockFilter]);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.total || 0), 0);
    const totalWithDays = subtotal * numDays;
    const itemCount = lineItems.reduce((sum, item) => sum + item.quantity, 0);
    
    return {
      subtotal: Math.round(subtotal * 100) / 100,
      totalWithDays: Math.round(totalWithDays * 100) / 100,
      itemCount
    };
  }, [lineItems, numDays]);

  useEffect(() => {
    if (mode === 'view') {
      setEditingItem(null);
      setEditedItems({});
      setValidationErrors({});
    }
  }, [mode]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="flex flex-col md:flex-row gap-2">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 w-24" />
          <Skeleton className="h-10 w-32" />
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="space-y-4">
        {(error || localError) && (
          <Alert variant="destructive">
            <AlertTriangleIcon />
            <AlertDescription>
              {error || localError}
            </AlertDescription>
          </Alert>
        )}

        {mode !== 'view' && (
          <div className="space-y-4">
            <div className="flex flex-col md:flex-row gap-2">
              <div className="flex-1">
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={open}
                  className={`w-full justify-between ${
                    validationErrors.quantity ? 'border-destructive' : ''
                  }`}
                  onClick={() => setOpen(true)}
                  disabled={loading}
                >
                  {selectedProduct ? (
                    <div className="flex items-center gap-2">
                      {showProductImages && selectedProduct.images?.[0] && (
                        <img 
                          src={selectedProduct.images[0].src} 
                          alt={selectedProduct.images[0].alt || selectedProduct.name || ''} 
                          className="w-6 h-6 object-cover rounded"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      )}
                      <span className="truncate">
                        {selectedProduct.name} - {formatCurrency(selectedProduct.price || 0, currency)}
                      </span>
                      {validateStock && selectedProduct.stock_status === 'outofstock' && (
                        <Badge variant="destructive" className="text-xs">Sin Stock</Badge>
                      )}
                    </div>
                  ) : (
                    <span className="text-muted-foreground">Seleccione un producto</span>
                  )}
                  <SearchIcon />
                </Button>
                
                <Dialog open={open} onOpenChange={setOpen}>
                  <DialogContent className="sm:max-w-[600px] max-h-[80vh]">
                    <DialogHeader>
                      <DialogTitle>Buscar Productos</DialogTitle>
                    </DialogHeader>
                    
                    {enableStockFilter && (
                      <div className="flex gap-2">
                        <Button
                          variant={stockFilter === 'all' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStockFilter('all')}
                        >
                          Todos
                        </Button>
                        <Button
                          variant={stockFilter === 'in_stock' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStockFilter('in_stock')}
                        >
                          En Stock
                        </Button>
                        <Button
                          variant={stockFilter === 'out_of_stock' ? 'default' : 'outline'}
                          size="sm"
                          onClick={() => setStockFilter('out_of_stock')}
                        >
                          Sin Stock
                        </Button>
                      </div>
                    )}
                    
                    <Command className="rounded-lg border shadow-md">
                      <CommandInput 
                        placeholder="Buscar producto por nombre, SKU o descripción..." 
                        value={searchQuery}
                        onValueChange={setSearchQuery}
                      />
                      <CommandList className="max-h-[400px]">
                        <CommandEmpty>
                          {filteredProducts.length === 0 && products.length > 0 
                            ? 'No se encontraron productos con los filtros aplicados.'
                            : 'No hay productos disponibles.'
                          }
                        </CommandEmpty>
                        <CommandGroup heading={`Productos (${filteredProducts.length})`}>
                          {filteredProducts.map((product) => (
                            <CommandItem
                              key={product.id}
                              value={product.name || ''}
                              onSelect={() => handleSelectProduct(product)}
                              className="cursor-pointer"
                            >
                              <div className="flex items-center gap-3 w-full">
                                {showProductImages && product.images?.[0] && (
                                  <img 
                                    src={product.images[0].src} 
                                    alt={product.images[0].alt || product.name || ''} 
                                    className="w-10 h-10 object-cover rounded flex-shrink-0"
                                    onError={(e) => {
                                      e.currentTarget.style.display = 'none';
                                    }}
                                  />
                                )}
                                <div className="flex flex-col flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium truncate">{product.name}</span>
                                    {product.sku && (
                                      <Badge variant="outline" className="text-xs">
                                        {product.sku}
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                    <span className="font-medium">
                                      {formatCurrency(product.price || 0, currency)}
                                    </span>
                                    {validateStock && (
                                      <Badge 
                                        variant={product.stock_status === 'instock' ? 'default' : 'destructive'}
                                        className="text-xs"
                                      >
                                        {product.stock_status === 'instock' ? 'En Stock' : 'Sin Stock'}
                                      </Badge>
                                    )}
                                  </div>
                                  {product.short_description && (
                                    <p className="text-xs text-muted-foreground truncate">
                                      {product.short_description}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </DialogContent>
                </Dialog>
              </div>
              
              <div className="w-full md:w-32 mt-2 md:mt-0">
                <Input
                  type="number"
                  min="1"
                  max={maxQuantityPerProduct}
                  value={selectedQuantity}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 1;
                    setSelectedQuantity(Math.max(1, Math.min(value, maxQuantityPerProduct)));
                    setValidationErrors(prev => ({ ...prev, quantity: '' }));
                  }}
                  className={`text-center ${
                    validationErrors.quantity ? 'border-destructive' : ''
                  }`}
                  placeholder="Cant."
                  disabled={loading}
                />
                {validationErrors.quantity && (
                  <p className="text-xs text-destructive mt-1">{validationErrors.quantity}</p>
                )}
              </div>
              
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button 
                    onClick={handleAddProduct}
                    disabled={!selectedProductId || loading || (validateStock && selectedProduct?.stock_status === 'outofstock')}
                    variant="default"
                    className="w-full md:w-auto mt-2 md:mt-0"
                  >
                    <PlusIcon />
                    <span className="ml-2">Agregar</span>
                  </Button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>
                    {!selectedProductId 
                      ? 'Seleccione un producto primero'
                      : validateStock && selectedProduct?.stock_status === 'outofstock'
                      ? 'Producto sin stock disponible'
                      : 'Agregar producto a la orden'
                    }
                  </p>
                </TooltipContent>
              </Tooltip>
            </div>
          </div>
        )}

        <div className="bg-card rounded-lg border overflow-hidden">
          {lineItems.length > 0 && (
            <div className="p-4 border-b bg-muted/50">
              <div className="flex justify-between items-center text-sm">
                <span className="font-medium">
                  {totals.itemCount} producto{totals.itemCount !== 1 ? 's' : ''} seleccionado{totals.itemCount !== 1 ? 's' : ''}
                </span>
                <div className="flex gap-4">
                  <span>Subtotal: {formatCurrency(totals.subtotal, currency)}</span>
                  {numDays > 1 && (
                    <span className="font-medium">
                      Total ({numDays} días): {formatCurrency(totals.totalWithDays, currency)}
                    </span>
                  )}
                </div>
              </div>
            </div>
          )}
          
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="font-semibold">Producto</TableHead>
                  <TableHead className="font-semibold hidden md:table-cell">SKU</TableHead>
                  <TableHead className="font-semibold text-center w-24">Cantidad</TableHead>
                  <TableHead className="font-semibold text-right">Precio Unit.</TableHead>
                  <TableHead className="font-semibold text-right">Total</TableHead>
                  {mode !== 'view' && <TableHead className="w-[120px]">Acciones</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {lineItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={mode === 'view' ? 5 : 6} className="text-center py-8 text-muted-foreground">
                      {mode === 'view' 
                        ? 'No hay productos en esta orden'
                        : 'No hay productos seleccionados. Agregue productos usando el selector de arriba.'
                      }
                    </TableCell>
                  </TableRow>
                ) : (
                  lineItems.map((item, index) => (
                    <TableRow key={`${item.product_id}-${index}`}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-3">
                          {showProductImages && item.image && (
                            <img 
                              src={item.image} 
                              alt={item.product_name} 
                              className="w-12 h-12 object-cover rounded border"
                              onError={(e) => {
                                e.currentTarget.style.display = 'none';
                              }}
                            />
                          )}
                          <div className="flex flex-col min-w-0">
                            <span className="font-medium truncate">{item.product_name}</span>
                            <span className="text-sm text-muted-foreground md:hidden">{item.sku}</span>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        {item.sku && (
                          <Badge variant="outline" className="text-xs">
                            {item.sku}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="font-medium">{formatNumber(item.quantity)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-medium">{formatCurrency(item.product_price, currency)}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end gap-1">
                          <span className="font-semibold">
                            {formatCurrency(item.total, currency)}
                          </span>
                          {numDays > 1 && (
                            <span className="text-xs text-muted-foreground">
                              × {numDays} días = {formatCurrency(item.total * numDays, currency)}
                            </span>
                          )}
                        </div>
                      </TableCell>
                      {mode !== 'view' && (
                        <TableCell>
                          <div className="flex justify-end gap-1">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => onRemoveProduct(index)}
                                  disabled={loading}
                                  className="h-8 w-8 p-0 text-red-600 hover:text-red-700"
                                >
                                  <XIcon />
                                </Button>
                              </TooltipTrigger>
                              <TooltipContent>
                                <p>Eliminar producto</p>
                              </TooltipContent>
                            </Tooltip>
                          </div>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
};
