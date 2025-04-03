import { useState } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Plus, Save, X, Edit2 } from 'lucide-react';
import type { Product } from '../../types/product';
import type { LineItem } from '../../types/order';

// Helper function to format currency
const formatCurrency = (value: string | number) => {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;
  return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

interface ProductSelectorProps {
  products: Product[];
  lineItems: LineItem[];
  numDays?: number;
  onAddProduct: (product: Product, quantity: number) => void;
  onRemoveProduct: (index: number) => void;
  onUpdateProduct?: (itemId: number, updates: Partial<LineItem>) => void;
  loading?: boolean;
  mode: 'create' | 'edit';
}

export const ProductSelector = ({
  products,
  lineItems,
  numDays,
  onAddProduct,
  onRemoveProduct,
  onUpdateProduct,
  loading = false,
  mode = 'create'
}: ProductSelectorProps) => {
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [editingItem, setEditingItem] = useState<number | null>(null);
  const [editedItems, setEditedItems] = useState<{ [key: string]: Partial<LineItem> }>({});

  const handleAddProduct = () => {
    const product = products.find(p => p.id.toString() === selectedProductId);
    if (product) {
      // Check if the product already exists in lineItems
      const existingItemIndex = lineItems.findIndex(
        item => item.product_id.toString() === product.id.toString()
      );
      
      if (existingItemIndex !== -1 && lineItems[existingItemIndex]) {
        // If product exists, update its quantity
        const updatedQuantity = lineItems[existingItemIndex].quantity + selectedQuantity;
        onRemoveProduct(existingItemIndex);
        onAddProduct(product, updatedQuantity);
      } else {
        // If product doesn't exist, add it as new
        onAddProduct(product, selectedQuantity);
      }
      
      setSelectedProductId('');
      setSelectedQuantity(1);
    }
  };

  const handleEditItem = (item: LineItem) => {
    if (item.id) {
      setEditingItem(item.id);
      setEditedItems({
        ...editedItems,
        [item.id.toString()]: {
          quantity: item.quantity,
          price: item.price
        }
      });
    }
  };

  const handleSaveItem = (itemId: number) => {
    const editedItem = editedItems[itemId.toString()];
    if (editedItem && onUpdateProduct) {
      // Ensure we have valid values before updating
      const updates: Partial<LineItem> = {
        ...editedItem,
        quantity: Math.max(1, parseInt(editedItem.quantity?.toString() || '1')),
        price: editedItem.price || '0'
      };
      
      onUpdateProduct(itemId, updates);
      setEditingItem(null);
      setEditedItems(prev => {
        const newItems = { ...prev };
        delete newItems[itemId.toString()];
        return newItems;
      });
    }
  };

  const handleCancelEdit = (itemId: number) => {
    setEditingItem(null);
    setEditedItems(prev => {
      const newItems = { ...prev };
      delete newItems[itemId.toString()];
      return newItems;
    });
  };

  const handleItemChange = (itemId: number, field: keyof LineItem, value: string | number) => {
    setEditedItems(prev => {
      const currentItem = prev[itemId.toString()] || {};
      // Ensure quantity is at least 1
      if (field === 'quantity') {
        const numValue = typeof value === 'string' ? parseInt(value) : value;
        value = Math.max(1, numValue);
      }
      return {
        ...prev,
        [itemId.toString()]: {
          ...currentItem,
          [field]: value
        }
      };
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <div className="flex-1">
          <Select value={selectedProductId} onValueChange={setSelectedProductId}>
            <SelectTrigger>
              <SelectValue placeholder="Seleccione un producto" />
            </SelectTrigger>
            <SelectContent>
              {products.map(product => (
                <SelectItem key={product.id} value={product.id.toString()}>
                  {product.name} - ${formatCurrency(product.price)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="w-24">
          <Input
            type="number"
            min="1"
            value={selectedQuantity}
            onChange={(e) => setSelectedQuantity(parseInt(e.target.value) || 1)}
          />
        </div>
        <Button 
          onClick={handleAddProduct}
          disabled={!selectedProductId || loading}
          variant="secondary"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="bg-card p-4 rounded-lg border overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="font-semibold">Producto</TableHead>
              <TableHead className="font-semibold">SKU</TableHead>
              <TableHead className="font-semibold text-center">Cant.</TableHead>
              <TableHead className="font-semibold text-right">Precio</TableHead>
              <TableHead className="font-semibold text-right">Total</TableHead>
              <TableHead className="w-[100px]"></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item, index) => {
              const isEditing = editingItem === item.id;
              const editedItem = item.id ? editedItems[item.id.toString()] : null;
              const currentQuantity = isEditing && editedItem?.quantity !== undefined ? editedItem.quantity : item.quantity;
              const currentPrice = isEditing && editedItem?.price !== undefined ? editedItem.price : item.price;
              const itemTotal = parseFloat(currentPrice.toString()) * (currentQuantity || 0);

              return (
                <TableRow key={`${item.product_id}-${index}`}>
                  <TableCell className="font-medium">
                    <div className="flex items-center gap-2">
                      {item.image && (
                        <img src={item.image} alt={item.name} className="w-10 h-10 object-cover rounded" />
                      )}
                      <span>{item.name}</span>
                    </div>
                  </TableCell>
                  <TableCell>{item.sku}</TableCell>
                  <TableCell className="text-center">
                    {isEditing ? (
                      <Input
                        type="number"
                        value={currentQuantity}
                        onChange={(e) => handleItemChange(item.id!, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 text-center"
                        min="1"
                      />
                    ) : (
                      currentQuantity
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    {isEditing ? (
                      <Input
                        type="text"
                        value={currentPrice}
                        onChange={(e) => handleItemChange(item.id!, 'price', e.target.value)}
                        className="w-32 text-right"
                      />
                    ) : (
                      `$${formatCurrency(currentPrice)}`
                    )}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      <span className="font-medium">
                        ${formatCurrency(itemTotal)}
                        {numDays && numDays > 0 && (
                          <span className="ml-1 text-sm text-muted-foreground">
                            × {numDays} días = ${formatCurrency(itemTotal * numDays)}
                          </span>
                        )}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end gap-2">
                      {mode === 'edit' && onUpdateProduct && isEditing ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleSaveItem(item.id!)}
                            disabled={loading}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCancelEdit(item.id!)}
                            disabled={loading}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </>
                      ) : mode === 'edit' && onUpdateProduct ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditItem(item)}
                            disabled={loading || editingItem !== null}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onRemoveProduct(index)}
                            disabled={loading}
                          >
                            <X className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      ) : mode === 'create' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => onRemoveProduct(index)}
                          disabled={loading}
                        >
                          <X className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}; 