import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Textarea } from '../ui/textarea';
import { Label } from '../ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import { Checkbox } from '../ui/checkbox';
import { toast } from 'sonner';
import type { Database } from '../../types/database';
import type { ProductCategory } from '../../types/product';
import { CategorySelector } from './CategorySelector';
import { ProductImageUpload } from './ProductImageUpload';

type Product = Database['public']['Tables']['products']['Row'];

interface ProductDetailProps {
  product: Product;
  categories: ProductCategory[];
  onSave: (updatedProduct: Partial<Product>) => Promise<void>;
  accessToken?: string | undefined;
}

export function ProductDetail({ product, categories, onSave, accessToken }: ProductDetailProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [updatedProduct, setUpdatedProduct] = useState<Partial<Product>>({ ...product });
  const [isSaving, setIsSaving] = useState(false);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  
  // Parse categories from product data
  const [selectedCategoryIds, setSelectedCategoryIds] = useState<number[]>(() => {
    try {
      if (product.categories_ids && typeof product.categories_ids === 'string') {
        return JSON.parse(product.categories_ids);
      } else if (Array.isArray(product.categories_ids)) {
        return product.categories_ids;
      }
      return [];
    } catch {
      return [];
    }
  });

  // Product status options
  const statusOptions = [
    { value: 'publish', label: 'Publicado' },
    { value: 'draft', label: 'Borrador' },
    { value: 'private', label: 'Privado' },
    { value: 'trash', label: 'Papelera' }
  ];

  // Stock status options
  const stockStatusOptions = [
    { value: 'instock', label: 'En stock' },
    { value: 'outofstock', label: 'Agotado' },
    { value: 'onbackorder', label: 'Por pedido' }
  ];

  // Product type options
  const typeOptions = [
    { value: 'simple', label: 'Simple' },
    { value: 'variable', label: 'Variable' },
    { value: 'grouped', label: 'Agrupado' },
    { value: 'external', label: 'Externo' }
  ];

  // Catalog visibility options
  const catalogVisibilityOptions = [
    { value: 'visible', label: 'Visible' },
    { value: 'catalog', label: 'Solo catálogo' },
    { value: 'search', label: 'Solo búsqueda' },
    { value: 'hidden', label: 'Oculto' }
  ];

  const formatCurrency = (value: string | number | null) => {
    if (!value) return '0';
    const numValue = typeof value === 'string' ? parseFloat(value) : value;
    return numValue.toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  const handleInputChange = (field: keyof Product, value: any) => {
    setUpdatedProduct(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleCategoryChange = (categoryIds: number[]) => {
    setSelectedCategoryIds(categoryIds);
    setUpdatedProduct(prev => ({
      ...prev,
      categories_ids: JSON.stringify(categoryIds)
    }));
  };

  const handleNumberChange = (field: keyof Product, value: string) => {
    const numValue = value === '' ? null : parseFloat(value);
    setUpdatedProduct(prev => ({ ...prev, [field]: numValue }));
  };

  const handleBooleanChange = (field: keyof Product, checked: boolean) => {
    setUpdatedProduct(prev => ({ ...prev, [field]: checked }));
  };

  const handleImagesUpdate = (images: string[]) => {
    setUpdatedProduct(prev => ({ ...prev, images }));
  };

  // Helper function to parse images JSON
  const parseImages = (imagesJson: any): string[] => {
    if (!imagesJson) return [];
    if (typeof imagesJson === 'string') {
      try {
        const parsed = JSON.parse(imagesJson);
        return Array.isArray(parsed) ? parsed : [];
      } catch {
        return [];
      }
    }
    return Array.isArray(imagesJson) ? imagesJson : [];
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
      // Ensure updated_at is set
      const dataToSave = {
        ...updatedProduct,
        updated_at: new Date().toISOString()
      };
      
      await onSave(dataToSave);
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
      setUpdatedProduct({ ...product });
    }
    setIsEditing(!isEditing);
  };

  const productImages = parseImages(product.images);

  const getStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'publish': return 'default';
      case 'draft': return 'secondary';
      case 'private': return 'outline';
      case 'trash': return 'destructive';
      default: return 'outline';
    }
  };

  const getStockStatusBadgeVariant = (status: string | null) => {
    switch (status) {
      case 'instock': return 'default';
      case 'outofstock': return 'destructive';
      case 'onbackorder': return 'secondary';
      default: return 'outline';
    }
  };

  return (
    <div className="container py-4 px-4 sm:px-6 max-w-6xl mx-auto">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight break-words">
            {product.name || 'Producto sin nombre'}
          </h1>
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

        {isEditing ? (
          /* Edit Mode */
          <Tabs defaultValue="basic" className="w-full">
            <TabsList className="grid w-full grid-cols-5">
              <TabsTrigger value="basic">Básico</TabsTrigger>
              <TabsTrigger value="pricing">Precios</TabsTrigger>
              <TabsTrigger value="inventory">Inventario</TabsTrigger>
              <TabsTrigger value="seo">SEO</TabsTrigger>
              <TabsTrigger value="advanced">Avanzado</TabsTrigger>
            </TabsList>

            <TabsContent value="basic" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Información Básica</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Nombre del producto *</Label>
                      <Input
                        id="name"
                        value={updatedProduct.name || ''}
                        onChange={(e) => handleInputChange('name', e.target.value)}
                        placeholder="Nombre del producto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="slug">Slug</Label>
                      <div className="flex space-x-2">
                        <Input
                          id="slug"
                          value={updatedProduct.slug || ''}
                          onChange={(e) => handleInputChange('slug', e.target.value)}
                          placeholder="slug-del-producto"
                        />
                        <Button type="button" variant="outline" onClick={generateSlug}>
                          Generar
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="sku">SKU</Label>
                      <Input
                        id="sku"
                        value={updatedProduct.sku || ''}
                        onChange={(e) => handleInputChange('sku', e.target.value)}
                        placeholder="Código único del producto"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="brands">Marca</Label>
                      <Input
                        id="brands"
                        value={updatedProduct.brands || ''}
                        onChange={(e) => handleInputChange('brands', e.target.value)}
                        placeholder="Marca del producto"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="status">Estado</Label>
                      <Select
                        value={updatedProduct.status || 'draft'}
                        onValueChange={(value) => handleInputChange('status', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {statusOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="type">Tipo</Label>
                      <Select
                        value={updatedProduct.type || 'simple'}
                        onValueChange={(value) => handleInputChange('type', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {typeOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="catalog_visibility">Visibilidad</Label>
                      <Select
                        value={updatedProduct.catalog_visibility || 'visible'}
                        onValueChange={(value) => handleInputChange('catalog_visibility', value)}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {catalogVisibilityOptions.map(option => (
                            <SelectItem key={option.value} value={option.value}>
                              {option.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="short_description">Descripción corta</Label>
                    <Textarea
                      id="short_description"
                      rows={3}
                      value={updatedProduct.short_description || ''}
                      onChange={(e) => handleInputChange('short_description', e.target.value)}
                      placeholder="Descripción breve del producto"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="description">Descripción completa</Label>
                    <Textarea
                      id="description"
                      rows={6}
                      value={updatedProduct.description || ''}
                      onChange={(e) => handleInputChange('description', e.target.value)}
                      placeholder="Descripción detallada del producto"
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="featured"
                      checked={updatedProduct.featured || false}
                      onCheckedChange={(checked) => handleBooleanChange('featured', checked as boolean)}
                    />
                    <Label htmlFor="featured">Producto destacado</Label>
                  </div>
                </CardContent>
              </Card>

              <ProductImageUpload
                productId={product.id}
                currentImages={parseImages(updatedProduct.images || product.images)}
                onImagesUpdate={handleImagesUpdate}
                disabled={isSaving}
              />
            </TabsContent>

            <TabsContent value="pricing" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración de Precios</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="price">Precio *</Label>
                      <Input
                        id="price"
                        type="number"
                        step="0.01"
                        value={updatedProduct.price || ''}
                        onChange={(e) => handleNumberChange('price', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="regular_price">Precio regular</Label>
                      <Input
                        id="regular_price"
                        type="number"
                        step="0.01"
                        value={updatedProduct.regular_price || ''}
                        onChange={(e) => handleNumberChange('regular_price', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sale_price">Precio de oferta</Label>
                      <Input
                        id="sale_price"
                        type="number"
                        step="0.01"
                        value={updatedProduct.sale_price || ''}
                        onChange={(e) => handleNumberChange('sale_price', e.target.value)}
                        placeholder="0.00"
                      />
                    </div>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="on_sale"
                      checked={updatedProduct.on_sale || false}
                      onCheckedChange={(checked) => handleBooleanChange('on_sale', checked as boolean)}
                    />
                    <Label htmlFor="on_sale">En oferta</Label>
                  </div>

                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="sold_individually"
                      checked={updatedProduct.sold_individually || false}
                      onCheckedChange={(checked) => handleBooleanChange('sold_individually', checked as boolean)}
                    />
                    <Label htmlFor="sold_individually">Vender individualmente</Label>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="inventory" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Inventario y Stock</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="stock_status">Estado del stock</Label>
                    <Select
                      value={updatedProduct.stock_status || 'instock'}
                      onValueChange={(value) => handleInputChange('stock_status', value)}
                    >
                      <SelectTrigger>
                        <SelectValue />
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

                  <div className="space-y-2">
                    <Label>Dimensiones (cm)</Label>
                    <div className="grid grid-cols-3 gap-4">
                      <div>
                        <Label htmlFor="dimensions_length" className="text-sm">Largo</Label>
                        <Input
                          id="dimensions_length"
                          type="number"
                          step="0.01"
                          value={updatedProduct.dimensions_length || ''}
                          onChange={(e) => handleNumberChange('dimensions_length', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dimensions_width" className="text-sm">Ancho</Label>
                        <Input
                          id="dimensions_width"
                          type="number"
                          step="0.01"
                          value={updatedProduct.dimensions_width || ''}
                          onChange={(e) => handleNumberChange('dimensions_width', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label htmlFor="dimensions_height" className="text-sm">Alto</Label>
                        <Input
                          id="dimensions_height"
                          type="number"
                          step="0.01"
                          value={updatedProduct.dimensions_height || ''}
                          onChange={(e) => handleNumberChange('dimensions_height', e.target.value)}
                          placeholder="0.00"
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="seo" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Optimización SEO</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="seo_title">Título SEO</Label>
                    <Input
                      id="seo_title"
                      value={updatedProduct.seo_title || ''}
                      onChange={(e) => handleInputChange('seo_title', e.target.value)}
                      placeholder="Título para motores de búsqueda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_description">Descripción SEO</Label>
                    <Textarea
                      id="seo_description"
                      rows={3}
                      value={updatedProduct.seo_description || ''}
                      onChange={(e) => handleInputChange('seo_description', e.target.value)}
                      placeholder="Descripción para motores de búsqueda"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="seo_keywords">Palabras clave SEO</Label>
                    <Input
                      id="seo_keywords"
                      value={updatedProduct.seo_keywords || ''}
                      onChange={(e) => handleInputChange('seo_keywords', e.target.value)}
                      placeholder="palabra1, palabra2, palabra3"
                    />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="advanced" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle>Configuración Avanzada</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <CategorySelector
                    selectedCategoryIds={selectedCategoryIds}
                    onCategoryChange={handleCategoryChange}
                    accessToken={accessToken}
                  />

                  <div className="space-y-2">
                    <Label htmlFor="total_sales">Total de ventas</Label>
                    <Input
                      id="total_sales"
                      type="number"
                      value={updatedProduct.total_sales || ''}
                      onChange={(e) => handleNumberChange('total_sales', e.target.value)}
                      placeholder="0"
                      readOnly
                    />
                    <p className="text-sm text-muted-foreground">Este campo se actualiza automáticamente</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            <div className="flex justify-end space-x-4 pt-4">
              <Button variant="outline" onClick={toggleEditMode}>
                Cancelar
              </Button>
              <Button onClick={handleSaveChanges} disabled={isSaving}>
                {isSaving ? 'Guardando...' : 'Guardar cambios'}
              </Button>
            </div>
          </Tabs>
        ) : (
          /* View Mode */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Product Images */}
            <div className="lg:col-span-1">
              {productImages.length > 0 ? (
                <div className="space-y-4">
                  <div className=" border rounded-lg overflow-hidden">
                    <img 
                      src={productImages[activeImageIndex]} 
                      alt={product.name || 'Product'} 
                      className="w-full h-auto object-contain mx-auto"
                      style={{ maxHeight: '400px' }}
                    />
                  </div>
                  {productImages.length > 1 && (
                    <div className="grid grid-cols-4 gap-2">
                      {productImages.map((imageUrl, index) => (
                        <div 
                          key={index}
                          onClick={() => setActiveImageIndex(index)}
                          className={`border rounded-lg overflow-hidden cursor-pointer 
                            ${index === activeImageIndex ? 'ring-2 ring-primary' : ''}`}
                        >
                          <img 
                            src={imageUrl} 
                            alt={product.name || 'Product'} 
                            className="w-full h-20 object-cover"
                          />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="w-full h-80 bg-card rounded-lg border flex items-center justify-center">
                  <span className="text-muted-foreground">No hay imagen disponible</span>
                </div>
              )}
            </div>

            {/* Product Information */}
            <div className="lg:col-span-2 space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    Información del Producto
                    <div className="flex gap-2">
                      <Badge variant={getStatusBadgeVariant(product.status)}>
                        {statusOptions.find(s => s.value === product.status)?.label || product.status}
                      </Badge>
                      {product.featured && (
                        <Badge variant="secondary">Destacado</Badge>
                      )}
                    </div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">SKU</Label>
                      <p className="text-sm">{product.sku || 'No definido'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Marca</Label>
                      <p className="text-sm">{product.brands || 'No definida'}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Tipo</Label>
                      <p className="text-sm">{typeOptions.find(t => t.value === product.type)?.label || product.type}</p>
                    </div>
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Stock</Label>
                      <Badge variant={getStockStatusBadgeVariant(product.stock_status)}>
                        {stockStatusOptions.find(s => s.value === product.stock_status)?.label || product.stock_status}
                      </Badge>
                    </div>
                  </div>

                  {product.short_description && (
                    <div>
                      <Label className="text-sm font-medium text-muted-foreground">Descripción</Label>
                      <p className="text-sm mt-1">{product.short_description}</p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Precios</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="text-center p-4 bg-primary/5 rounded-lg">
                      <Label className="text-sm font-medium text-muted-foreground">Precio</Label>
                      <p className="text-2xl font-bold text-primary">${formatCurrency(product.price)}</p>
                    </div>
                    {product.regular_price && (
                      <div className="text-center p-4 bg-muted/50 rounded-lg">
                        <Label className="text-sm font-medium text-muted-foreground">Precio Regular</Label>
                        <p className="text-xl font-semibold">${formatCurrency(product.regular_price)}</p>
                      </div>
                    )}
                    {product.sale_price && (
                      <div className="text-center p-4 bg-green-50 rounded-lg">
                        <Label className="text-sm font-medium text-muted-foreground">Precio Oferta</Label>
                        <p className="text-xl font-semibold text-green-600">${formatCurrency(product.sale_price)}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {(product.dimensions_length || product.dimensions_width || product.dimensions_height) && (
                <Card>
                  <CardHeader>
                    <CardTitle>Dimensiones</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-3 gap-4 text-center">
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Largo</Label>
                        <p className="text-lg font-semibold">{product.dimensions_length || 0} cm</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Ancho</Label>
                        <p className="text-lg font-semibold">{product.dimensions_width || 0} cm</p>
                      </div>
                      <div>
                        <Label className="text-sm font-medium text-muted-foreground">Alto</Label>
                        <p className="text-lg font-semibold">{product.dimensions_height || 0} cm</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
