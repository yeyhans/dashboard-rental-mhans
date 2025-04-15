import React, { useState } from 'react';
import { Card, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { ScrollArea } from '../ui/scroll-area';
import { toast } from 'sonner';
import type { ProductImage, Product, ProductCategory } from '../../types/product';

interface ProductDetailProps {
  product: Product;
  categories: ProductCategory[];
  onSave: (updatedProduct: Partial<Product>) => Promise<void>;
}

export function ProductDetail({ product, categories, onSave }: ProductDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [updatedProduct, setUpdatedProduct] = useState<Partial<Product>>({ ...product });
  const [isSaving, setIsSaving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [newImageUrl, setNewImageUrl] = useState('');
  const [newImageAlt, setNewImageAlt] = useState('');
  const [searchCategory, setSearchCategory] = useState('');

  // Stock status options
  const stockStatusOptions = [
    { value: 'instock', label: 'En stock' },
    { value: 'outofstock', label: 'Agotado' },
    { value: 'onbackorder', label: 'Por pedido' }
  ];

  const getStockStatusDisplay = (status: string) => {
    const option = stockStatusOptions.find(opt => opt.value === status);
    return option ? option.label : status;
  };

  const getStockStatusClass = (status: string) => {
    switch (status) {
      case 'instock': return 'bg-green-100 text-green-800';
      case 'outofstock': return 'bg-red-100 text-red-800';
      case 'onbackorder': return 'bg-yellow-100 text-yellow-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Format currency with thousands separator
  const formatCurrency = (value: string | number) => {
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setUpdatedProduct(prev => ({ ...prev, [name]: value }));
  };

  // Handle category checkbox selection
  const handleCategoryToggle = (categoryId: number, checked: boolean) => {
    if (!updatedProduct.categories) {
      updatedProduct.categories = [...product.categories];
    }

    if (checked) {
      // Add the category if it's checked and not already in the list
      const categoryToAdd = categories.find(c => c.id === categoryId);
      if (categoryToAdd && !updatedProduct.categories.some(c => c.id === categoryId)) {
        setUpdatedProduct(prev => ({
          ...prev,
          categories: [...(prev.categories || []), categoryToAdd]
        }));
      }
    } else {
      // Remove the category if it's unchecked
      setUpdatedProduct(prev => ({
        ...prev,
        categories: (prev.categories || []).filter(c => c.id !== categoryId)
      }));
    }
  };

  // Generate slug from name
  const generateSlug = () => {
    if (!updatedProduct.name) return;
    
    const slug = updatedProduct.name
      .toLowerCase()
      .replace(/[áàäâãå]/g, 'a')
      .replace(/[éèëê]/g, 'e')
      .replace(/[íìïî]/g, 'i')
      .replace(/[óòöôõ]/g, 'o')
      .replace(/[úùüû]/g, 'u')
      .replace(/[ñ]/g, 'n')
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
    
    setUpdatedProduct(prev => ({ ...prev, slug }));
  };

  const handleSaveChanges = async () => {
    setIsSaving(true);
    try {
      await onSave(updatedProduct);
      setIsEditing(false);
      toast.success("Producto actualizado correctamente", {
        description: "Los cambios han sido guardados."
      });
    } catch (error) {
      toast.error("Error al actualizar el producto", {
        description: "No se pudo actualizar el producto. Inténtalo de nuevo."
      });
    } finally {
      setIsSaving(false);
    }
  };

  const toggleEditMode = () => {
    if (isEditing) {
      // Cancel editing - restore original data
      setUpdatedProduct({ ...product });
      setSearchCategory('');
    }
    setIsEditing(!isEditing);
  };

  const handleImageClick = (index: number) => {
    setActiveImageIndex(index);
  };

  // Filter categories based on search term
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(searchCategory.toLowerCase())
  );

  return (
    <div className="container py-4 px-4 sm:px-6 max-w-5xl mx-auto">
      <div className="space-y-6">
        {/* Header with title and actions */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">{product.name}</h1>
          <div className="flex space-x-3 w-full sm:w-auto">
            <Button 
              onClick={toggleEditMode}
              variant={isEditing ? "outline" : "default"}
              className="flex-1 sm:flex-none"
            >
              {isEditing ? 'Cancelar' : 'Editar producto'}
            </Button>
            <Button 
              variant="outline" 
              className="flex-1 sm:flex-none"
              asChild
            >
              <a href="/products">← Volver</a>
            </Button>
          </div>
        </div>

        {/* Status message */}
        {isSaving && (
          <div className="p-4 bg-blue-50 text-blue-700 rounded-md">
            Guardando cambios...
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Product Images Section */}
          <div className="space-y-4">
            {product.images && product.images.length > 0 ? (
              <div>
                <div className="bg-white border rounded-lg overflow-hidden">
                  <img 
                    src={product.images[activeImageIndex]?.src} 
                    alt={product.images[activeImageIndex]?.alt || product.name} 
                    className="w-full h-auto object-contain mx-auto"
                    style={{ maxHeight: '350px' }}
                  />
                </div>

                {product.images.length > 1 && (
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    {product.images.map((image, index) => (
                      <div 
                        key={image.id} 
                        onClick={() => handleImageClick(index)}
                        className={`border rounded-lg overflow-hidden cursor-pointer 
                          ${index === activeImageIndex ? 'ring-2 ring-primary' : ''}`}
                      >
                        <img 
                          src={image.src} 
                          alt={image.alt || product.name} 
                          className="w-full h-20 object-cover"
                        />
                      </div>
                    ))}
                  </div>
                )}

                {isEditing && (
                  <div className="mt-4 space-y-2">
                    <h3 className="text-md font-semibold">Gestionar imágenes</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="text"
                        placeholder="URL de la imagen"
                        value={newImageUrl}
                        onChange={(e) => setNewImageUrl(e.target.value)}
                      />
                      <Input
                        type="text"
                        placeholder="Texto alternativo"
                        value={newImageAlt}
                        onChange={(e) => setNewImageAlt(e.target.value)}
                      />
                    </div>
                    <Button 
                      onClick={() => toast("Funcionalidad en desarrollo", {
                        description: "Próximamente podrás añadir imágenes aquí"
                      })}
                      variant="outline"
                      className="w-full sm:w-auto"
                      disabled={!newImageUrl}
                    >
                      Añadir imagen
                    </Button>
                  </div>
                )}
              </div>
            ) : (
              <div className="w-full h-80 bg-card rounded-lg border flex items-center justify-center">
                <span className="text-muted-foreground">No hay imagen disponible</span>
              </div>
            )}
          </div>

          {/* Product Info Section */}
          <div className="space-y-6">
            {isEditing ? (
              <Card>
                <CardContent className="pt-6 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Nombre del producto</Label>
                    <Input
                      id="name"
                      name="name"
                      value={updatedProduct.name || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="slug"
                          name="slug"
                          value={updatedProduct.slug || ''}
                          onChange={handleInputChange}
                          className="flex-1"
                        />
                        <Button 
                          type="button" 
                          variant="outline" 
                          onClick={generateSlug}
                          className="whitespace-nowrap"
                        >
                          Generar
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        El slug se usa en la URL del producto
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        name="sku"
                        value={updatedProduct.sku || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio</Label>
                      <Input
                        id="price"
                        name="price"
                        type="number"
                        value={updatedProduct.price || ''}
                        onChange={handleInputChange}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="stock_status">Estado del stock</Label>
                      <Select
                        name="stock_status"
                        value={updatedProduct.stock_status || 'instock'}
                        onValueChange={(value) => setUpdatedProduct(prev => ({ ...prev, stock_status: value }))}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar estado" />
                        </SelectTrigger>
                        <SelectContent>
                          {stockStatusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="categories">Categorías</Label>
                    <Input
                      placeholder="Buscar categorías..."
                      value={searchCategory}
                      onChange={(e) => setSearchCategory(e.target.value)}
                      className="mb-2"
                    />
                    <Card className="border">
                      <ScrollArea className="h-48 px-1">
                        <div className="p-2 space-y-2">
                          {filteredCategories.length > 0 ? (
                            filteredCategories.map((category) => (
                              <label
                                key={category.id}
                                className="flex items-center space-x-2 py-1 px-2 rounded hover:bg-muted cursor-pointer"
                              >
                                <Checkbox 
                                  id={`category-${category.id}`}
                                  checked={updatedProduct.categories?.some(c => c.id === category.id) || false}
                                  onCheckedChange={(checked) => handleCategoryToggle(category.id, checked as boolean)}
                                />
                                <span>{category.name}</span>
                              </label>
                            ))
                          ) : (
                            <div className="py-2 text-center text-muted-foreground">
                              No se encontraron categorías
                            </div>
                          )}
                        </div>
                      </ScrollArea>
                    </Card>
                    {updatedProduct.categories && updatedProduct.categories.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {updatedProduct.categories.map(category => (
                          <Badge key={category.id} variant="secondary" className="flex items-center space-x-1">
                            <span>{category.name}</span>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-4 w-4 p-0 text-muted-foreground hover:text-foreground"
                              onClick={() => handleCategoryToggle(category.id, false)}
                            >
                              ×
                            </Button>
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="short_description">Descripción</Label>
                    <Textarea
                      id="short_description"
                      name="short_description"
                      rows={6}
                      value={updatedProduct.short_description?.replace(/<[^>]*>/g, '') || ''}
                      onChange={handleInputChange}
                    />
                  </div>
                  
                  <Button 
                    onClick={handleSaveChanges} 
                    disabled={isSaving}
                    className="w-full"
                  >
                    {isSaving ? 'Guardando...' : 'Guardar cambios'}
                  </Button>
                </CardContent>
              </Card>
            ) : (
              <Tabs defaultValue="info" className="w-full">
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="info">Información</TabsTrigger>
                  <TabsTrigger value="description">Descripción</TabsTrigger>
                </TabsList>
                
                <TabsContent value="info" className="space-y-4 mt-4">
                  <Card>
                    <CardContent className="pt-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="space-y-1">
                          <p className="text-sm text-muted-foreground">Precio</p>
                          <p className="text-2xl sm:text-3xl font-bold">$ {formatCurrency(product.price)}</p>
                        </div>
                        <div className="space-y-1 text-right">
                          <p className="text-sm text-muted-foreground">Disponibilidad</p>
                          <Badge className={getStockStatusClass(product.stock_status)}>
                            {getStockStatusDisplay(product.stock_status)}
                          </Badge>
                        </div>
                      </div>
                      
                      <div className="space-y-4 mt-6">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                          {product.sku && (
                            <div className="p-3 sm:p-4 bg-card rounded-lg border">
                              <div className="text-sm font-medium text-muted-foreground">SKU / Código</div>
                              <div className="text-lg sm:text-xl font-medium mt-1">{product.sku}</div>
                            </div>
                          )}
                          
                          {product.slug && (
                            <div className="p-3 sm:p-4 bg-card rounded-lg border">
                              <div className="text-sm font-medium text-muted-foreground">Slug</div>
                              <div className="text-lg sm:text-xl font-medium mt-1 break-all">{product.slug}</div>
                            </div>
                          )}
                        </div>

                        {product.categories && product.categories.length > 0 && (
                          <div className="p-3 sm:p-4 bg-card rounded-lg border">
                            <div className="text-sm font-medium text-muted-foreground">Categorías</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {product.categories.map((category) => (
                                <Badge key={category.id} variant="secondary">
                                  {category.name}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </TabsContent>
                
                <TabsContent value="description" className="mt-4">
                  {product.short_description ? (
                    <Card>
                      <CardContent className="pt-6">
                        <div 
                          className="prose max-w-none prose-sm sm:prose-base" 
                          dangerouslySetInnerHTML={{ __html: product.short_description }} 
                        />
                      </CardContent>
                    </Card>
                  ) : (
                    <Card>
                      <CardContent className="pt-6">
                        <p className="text-muted-foreground">No hay descripción disponible para este producto.</p>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>
              </Tabs>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 