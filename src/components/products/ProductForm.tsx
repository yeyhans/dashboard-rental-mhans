import { useState, useEffect } from 'react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Switch } from '../ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '../ui/card';
import { Badge } from '../ui/badge';
import { X, Plus } from 'lucide-react';
import type { ProductCategory } from '../../types/product';
import { ProductImageUpload } from './ProductImageUpload';
import { ProductImageService } from '../../services/productImageService';

interface ProductFormData {
  name: string;
  slug: string;
  type: string;
  status: string;
  featured: boolean;
  catalog_visibility: string;
  description: string;
  short_description: string;
  sku: string;
  price: number | null;
  regular_price: number | null;
  sale_price: number | null;
  on_sale: boolean;
  sold_individually: boolean;
  stock_status: string;
  brands: string;
  dimensions_length: number | null;
  dimensions_width: number | null;
  dimensions_height: number | null;
  seo_title: string;
  seo_description: string;
  seo_keywords: string;
  primary_term_product_cat: string;
  categories_ids: number[];
  categories_name: string;
  tags: string[];
  images: string[];
  collage_image_url: string | null;
}

interface ProductFormProps {
  onSubmit?: (data: ProductFormData) => Promise<void>;
  onCancel?: () => void; // Made optional for standalone page mode
  categories: ProductCategory[];
  loading?: boolean;
  initialData?: Partial<ProductFormData>;
  onSuccess?: (productId: number) => void;
  onProductCreated?: (product: any) => void; // Callback when product is created (for Dashboard)
  redirectOnSuccess?: string; // URL to redirect to after successful creation (for standalone page mode)
}

const ProductForm = ({ 
  onSubmit, 
  onCancel, 
  categories, 
  loading = false,
  initialData,
  onSuccess,
  redirectOnSuccess
}: ProductFormProps) => {
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    slug: '',
    type: 'simple',
    status: 'draft',
    featured: false,
    catalog_visibility: 'visible',
    description: '',
    short_description: '',
    sku: '',
    price: null,
    regular_price: null,
    sale_price: null,
    on_sale: false,
    sold_individually: false,
    stock_status: 'instock',
    brands: '',
    dimensions_length: null,
    dimensions_width: null,
    dimensions_height: null,
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    primary_term_product_cat: '',
    categories_ids: [],
    categories_name: '',
    tags: [],
    images: [],
    collage_image_url: null,
    ...initialData
  });

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [currentTag, setCurrentTag] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  // Auto-generate slug from name
  useEffect(() => {
    if (formData.name && !initialData?.slug) {
      const slug = formData.name
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, '')
        .replace(/\s+/g, '-')
        .replace(/-+/g, '-')
        .trim();
      setFormData(prev => ({ ...prev, slug }));
    }
  }, [formData.name, initialData?.slug]);

  // Auto-generate unique SKU from name
  useEffect(() => {
    if (formData.name && !initialData?.sku) {
      const baseSku = formData.name
        .toUpperCase()
        .replace(/[^A-Z0-9\s]/g, '')
        .replace(/\s+/g, '-')
        .substring(0, 10); // Limit to 10 characters
      const timestamp = Date.now().toString().slice(-6); // Last 6 digits of timestamp
      const uniqueSku = `${baseSku}-${timestamp}`;
      setFormData(prev => ({ ...prev, sku: uniqueSku }));
    }
  }, [formData.name, initialData?.sku]);

  // Auto-generate SEO title from name
  useEffect(() => {
    if (formData.name && !initialData?.seo_title) {
      setFormData(prev => ({ ...prev, seo_title: formData.name }));
    }
  }, [formData.name, initialData?.seo_title]);

  // Update categories_name when categories_ids change
  useEffect(() => {
    const selectedCategories = categories.filter(cat => 
      formData.categories_ids.includes(cat.id)
    );
    const categoriesName = selectedCategories.map(cat => cat.name).join(', ');
    setFormData(prev => ({ ...prev, categories_name: categoriesName }));
  }, [formData.categories_ids, categories]);

  const handleInputChange = (field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  const handleCategoryToggle = (categoryId: number) => {
    setFormData(prev => ({
      ...prev,
      categories_ids: prev.categories_ids.includes(categoryId)
        ? prev.categories_ids.filter(id => id !== categoryId)
        : [...prev.categories_ids, categoryId]
    }));
  };

  const handleAddTag = () => {
    if (currentTag.trim() && !formData.tags.includes(currentTag.trim())) {
      setFormData(prev => ({
        ...prev,
        tags: [...prev.tags, currentTag.trim()]
      }));
      setCurrentTag('');
    }
  };

  const handleRemoveTag = (tagToRemove: string) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.filter(tag => tag !== tagToRemove)
    }));
  };

  const handleImagesChange = (images: string[]) => {
    setFormData(prev => ({ ...prev, images }));
  };

  const handleCollageImageSelect = (imageUrl: string | null) => {
    setFormData(prev => ({ ...prev, collage_image_url: imageUrl }));
  };

  const handleFilesSelected = (files: File[]) => {
    setSelectedFiles(files);
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors.name = 'El nombre es obligatorio';
    }

    if (!formData.slug.trim()) {
      newErrors.slug = 'El slug es obligatorio';
    }

    if (!formData.sku.trim()) {
      newErrors.sku = 'El SKU es obligatorio';
    }

    if (formData.price !== null && formData.price < 0) {
      newErrors.price = 'El precio debe ser mayor o igual a 0';
    }

    if (formData.regular_price !== null && formData.regular_price < 0) {
      newErrors.regular_price = 'El precio regular debe ser mayor o igual a 0';
    }

    if (formData.sale_price !== null && formData.sale_price < 0) {
      newErrors.sale_price = 'El precio de oferta debe ser mayor o igual a 0';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleCreateProductWithImages = async () => {
    if (!validateForm()) {
      return;
    }

    setIsCreating(true);
    setUploadProgress('Creando producto...');

    try {
      // 1. Preparar datos del producto
      const productData = {
        name: formData.name,
        slug: formData.slug,
        type: formData.type,
        status: formData.status,
        featured: formData.featured,
        catalog_visibility: formData.catalog_visibility,
        description: formData.description,
        short_description: formData.short_description,
        sku: formData.sku,
        price: formData.price,
        regular_price: formData.regular_price,
        sale_price: formData.sale_price,
        on_sale: formData.on_sale,
        sold_individually: formData.sold_individually,
        stock_status: formData.stock_status,
        brands: formData.brands,
        dimensions_length: formData.dimensions_length,
        dimensions_width: formData.dimensions_width,
        dimensions_height: formData.dimensions_height,
        seo_title: formData.seo_title,
        seo_description: formData.seo_description,
        seo_keywords: formData.seo_keywords,
        primary_term_product_cat: formData.primary_term_product_cat,
        categories_ids: formData.categories_ids,
        categories_name: formData.categories_name,
        tags: formData.tags,
        images: [], // Inicialmente vacío
        collage_image_url: formData.collage_image_url || null
      };

      console.log('🚀 Preparando datos del producto:', productData);
      
      let createdProduct;
      
      // Si hay un callback onSubmit, usarlo (para compatibilidad con Dashboard)
      if (onSubmit) {
        console.log('🔄 Usando callback onSubmit del Dashboard');
        createdProduct = await onSubmit(productData);
        console.log('✅ Producto creado via Dashboard:', createdProduct);
      } else {
        // Si no hay callback, crear el producto directamente
        console.log('🚀 Creando producto directamente via API');
        const response = await fetch('/api/products/create', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(productData),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Error al crear el producto');
        }

        const result = await response.json();
        if (!result.success) {
          throw new Error(result.message || 'Error al crear el producto');
        }

        createdProduct = result.data;
        console.log('✅ Producto creado con ID:', createdProduct.id);
      }

      // 2. Si hay imágenes seleccionadas, subirlas
      if (selectedFiles.length > 0 && createdProduct) {
        setUploadProgress(`Subiendo ${selectedFiles.length} imágenes...`);
        console.log('📸 Subiendo imágenes para producto:', createdProduct.id);
        
        const uploadResult = await ProductImageService.uploadProductImages(
          createdProduct.id,
          selectedFiles
        );

        if (!uploadResult.success) {
          throw new Error(uploadResult.error || 'Error al subir las imágenes');
        }

        console.log('✅ Imágenes subidas exitosamente:', uploadResult.urls);
        setUploadProgress('¡Producto creado exitosamente!');
      } else {
        setUploadProgress('¡Producto creado exitosamente!');
      }

      // 3. Limpiar formulario y llamar callback de éxito
      if (createdProduct) {
        // Limpiar formulario
        setFormData({
          name: '',
          slug: '',
          type: 'simple',
          status: 'draft',
          featured: false,
          catalog_visibility: 'visible',
          description: '',
          short_description: '',
          sku: '',
          price: null,
          regular_price: null,
          sale_price: null,
          on_sale: false,
          sold_individually: false,
          stock_status: 'instock',
          brands: '',
          dimensions_length: null,
          dimensions_width: null,
          dimensions_height: null,
          seo_title: '',
          seo_description: '',
          seo_keywords: '',
          primary_term_product_cat: '',
          categories_ids: [],
          categories_name: '',
          tags: [],
          images: [],
          collage_image_url: null
        });
        
        // Limpiar archivos seleccionados
        setSelectedFiles([]);
        
        // Llamar callback de éxito
        if (onSuccess) {
          onSuccess(createdProduct.id);
        }
        
        // Redirigir si estamos en modo standalone (sin onSubmit) y hay redirectOnSuccess definido
        if (!onSubmit && redirectOnSuccess && typeof window !== 'undefined') {
          // Esperar un breve delay para mostrar el mensaje de éxito antes de redirigir
          setTimeout(() => {
            window.location.href = redirectOnSuccess;
          }, 2000);
        }
      }

    } catch (error) {
      console.error('❌ Error creando producto:', error);
      setUploadProgress('');
      setErrors({ submit: error instanceof Error ? error.message : 'Error desconocido' });
    } finally {
      setIsCreating(false);
      // Limpiar mensaje de progreso después de 3 segundos
      setTimeout(() => setUploadProgress(''), 3000);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await handleCreateProductWithImages();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic Information */}
      <Card>
        <CardHeader>
          <CardTitle>Información Básica</CardTitle>
          <CardDescription>
            Información principal del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="name">Nombre del Producto *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Ej: Taladro Eléctrico 500W"
                className={errors.name ? 'border-red-500' : ''}
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            <div>
              <Label htmlFor="slug">Slug *</Label>
              <Input
                id="slug"
                value={formData.slug}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                placeholder="taladro-electrico-500w"
                className={errors.slug ? 'border-red-500' : ''}
              />
              {errors.slug && <p className="text-red-500 text-sm mt-1">{errors.slug}</p>}
            </div>

            <div>
              <Label htmlFor="sku">SKU *</Label>
              <Input
                id="sku"
                value={formData.sku}
                onChange={(e) => handleInputChange('sku', e.target.value)}
                placeholder="TAL-500W-001"
                className={errors.sku ? 'border-red-500' : ''}
              />
              {errors.sku && <p className="text-red-500 text-sm mt-1">{errors.sku}</p>}
            </div>

            <div>
              <Label htmlFor="brands">Marca</Label>
              <Input
                id="brands"
                value={formData.brands}
                onChange={(e) => handleInputChange('brands', e.target.value)}
                placeholder="Ej: Bosch, DeWalt, Makita"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="short_description">Descripción Corta</Label>
            <Textarea
              id="short_description"
              value={formData.short_description}
              onChange={(e) => handleInputChange('short_description', e.target.value)}
              placeholder="Descripción breve del producto..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="description">Descripción Completa</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => handleInputChange('description', e.target.value)}
              placeholder="Descripción detallada del producto..."
              rows={4}
            />
          </div>
        </CardContent>
      </Card>

      {/* Pricing */}
      <Card>
        <CardHeader>
          <CardTitle>Precios</CardTitle>
          <CardDescription>
            Configuración de precios del producto
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="regular_price">Precio Regular</Label>
              <Input
                id="regular_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.regular_price || ''}
                onChange={(e) => handleInputChange('regular_price', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.00"
                className={errors.regular_price ? 'border-red-500' : ''}
              />
              {errors.regular_price && <p className="text-red-500 text-sm mt-1">{errors.regular_price}</p>}
            </div>

            <div>
              <Label htmlFor="sale_price">Precio de Oferta</Label>
              <Input
                id="sale_price"
                type="number"
                min="0"
                step="0.01"
                value={formData.sale_price || ''}
                onChange={(e) => handleInputChange('sale_price', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.00"
                className={errors.sale_price ? 'border-red-500' : ''}
              />
              {errors.sale_price && <p className="text-red-500 text-sm mt-1">{errors.sale_price}</p>}
            </div>

            <div>
              <Label htmlFor="price">Precio Final</Label>
              <Input
                id="price"
                type="number"
                min="0"
                step="0.01"
                value={formData.price || ''}
                onChange={(e) => handleInputChange('price', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.00"
                className={errors.price ? 'border-red-500' : ''}
              />
              {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price}</p>}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Switch
              id="on_sale"
              checked={formData.on_sale}
              onCheckedChange={(checked: boolean) => handleInputChange('on_sale', checked)}
            />
            <Label htmlFor="on_sale">Producto en oferta</Label>
          </div>
        </CardContent>
      </Card>

      {/* Inventory & Status */}
      <Card>
        <CardHeader>
          <CardTitle>Inventario y Estado</CardTitle>
          <CardDescription>
            Configuración de stock y visibilidad
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="stock_status">Estado del Stock</Label>
              <Select
                value={formData.stock_status}
                onValueChange={(value) => handleInputChange('stock_status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="instock">En Stock</SelectItem>
                  <SelectItem value="outofstock">Agotado</SelectItem>
                  <SelectItem value="onbackorder">En Pedido</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="status">Estado del Producto</Label>
              <Select
                value={formData.status}
                onValueChange={(value) => handleInputChange('status', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="publish">Publicado</SelectItem>
                  <SelectItem value="draft">Borrador</SelectItem>
                  <SelectItem value="private">Privado</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="type">Tipo de Producto</Label>
              <Select
                value={formData.type}
                onValueChange={(value) => handleInputChange('type', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simple">Simple</SelectItem>
                  <SelectItem value="variable">Variable</SelectItem>
                  <SelectItem value="grouped">Agrupado</SelectItem>
                  <SelectItem value="external">Externo</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="catalog_visibility">Visibilidad en Catálogo</Label>
              <Select
                value={formData.catalog_visibility}
                onValueChange={(value) => handleInputChange('catalog_visibility', value)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="visible">Visible</SelectItem>
                  <SelectItem value="catalog">Solo en Catálogo</SelectItem>
                  <SelectItem value="search">Solo en Búsqueda</SelectItem>
                  <SelectItem value="hidden">Oculto</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="featured"
                checked={formData.featured}
                onCheckedChange={(checked: boolean) => handleInputChange('featured', checked)}
              />
              <Label htmlFor="featured">Producto Destacado</Label>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="sold_individually"
                checked={formData.sold_individually}
                onCheckedChange={(checked: boolean) => handleInputChange('sold_individually', checked)}
              />
              <Label htmlFor="sold_individually">Vender Individualmente</Label>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Dimensions */}
      <Card>
        <CardHeader>
          <CardTitle>Dimensiones</CardTitle>
          <CardDescription>
            Medidas físicas del producto (en cm)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="dimensions_length">Largo (cm)</Label>
              <Input
                id="dimensions_length"
                type="number"
                min="0"
                step="0.1"
                value={formData.dimensions_length || ''}
                onChange={(e) => handleInputChange('dimensions_length', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label htmlFor="dimensions_width">Ancho (cm)</Label>
              <Input
                id="dimensions_width"
                type="number"
                min="0"
                step="0.1"
                value={formData.dimensions_width || ''}
                onChange={(e) => handleInputChange('dimensions_width', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.0"
              />
            </div>

            <div>
              <Label htmlFor="dimensions_height">Alto (cm)</Label>
              <Input
                id="dimensions_height"
                type="number"
                min="0"
                step="0.1"
                value={formData.dimensions_height || ''}
                onChange={(e) => handleInputChange('dimensions_height', e.target.value ? parseFloat(e.target.value) : null)}
                placeholder="0.0"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories */}
      <Card>
        <CardHeader>
          <CardTitle>Categorías</CardTitle>
          <CardDescription>
            Selecciona las categorías del producto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {categories.map((category) => (
              <div
                key={category.id}
                className={`p-2 border rounded-lg cursor-pointer transition-colors ${
                  formData.categories_ids.includes(category.id)
                    ? 'bg-primary text-primary-foreground border-primary'
                    : 'bg-background hover:bg-muted border-border'
                }`}
                onClick={() => handleCategoryToggle(category.id)}
              >
                <span className="text-sm font-medium">{category.name}</span>
              </div>
            ))}
          </div>
          
          {formData.categories_ids.length > 0 && (
            <div className="mt-4">
              <Label>Categorías Seleccionadas:</Label>
              <div className="flex flex-wrap gap-2 mt-2">
                {categories
                  .filter(cat => formData.categories_ids.includes(cat.id))
                  .map(category => (
                    <Badge key={category.id} variant="secondary">
                      {category.name}
                    </Badge>
                  ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Tags */}
      <Card>
        <CardHeader>
          <CardTitle>Etiquetas</CardTitle>
          <CardDescription>
            Agrega etiquetas para mejorar la búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              value={currentTag}
              onChange={(e) => setCurrentTag(e.target.value)}
              placeholder="Agregar etiqueta..."
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
            />
            <Button type="button" onClick={handleAddTag} variant="outline">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          {formData.tags.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {formData.tags.map((tag, index) => (
                <Badge key={index} variant="secondary" className="flex items-center gap-1">
                  {tag}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() => handleRemoveTag(tag)}
                  />
                </Badge>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Images */}
      <Card>
        <CardHeader>
          <CardTitle>Imágenes del Producto</CardTitle>
          <CardDescription>
            Sube las imágenes del producto
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProductImageUpload
            productId={null} // Will be set after product creation
            currentImages={formData.images}
            onImagesUpdate={handleImagesChange}
            onFilesSelected={handleFilesSelected}
            selectedCollageImage={formData.collage_image_url}
            onCollageImageSelect={handleCollageImageSelect}
          />
          {selectedFiles.length > 0 && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700 font-medium">
                {selectedFiles.length} imagen{selectedFiles.length !== 1 ? 'es' : ''} seleccionada{selectedFiles.length !== 1 ? 's' : ''} para subir
              </p>
              <div className="mt-2 space-y-1">
                {selectedFiles.map((file, index) => (
                  <div key={index} className="text-xs text-blue-600">
                    • {file.name} ({ProductImageService.formatFileSize(file.size)})
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* SEO */}
      <Card>
        <CardHeader>
          <CardTitle>SEO</CardTitle>
          <CardDescription>
            Optimización para motores de búsqueda
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="seo_title">Título SEO</Label>
            <Input
              id="seo_title"
              value={formData.seo_title}
              onChange={(e) => handleInputChange('seo_title', e.target.value)}
              placeholder="Título para SEO..."
            />
          </div>

          <div>
            <Label htmlFor="seo_description">Descripción SEO</Label>
            <Textarea
              id="seo_description"
              value={formData.seo_description}
              onChange={(e) => handleInputChange('seo_description', e.target.value)}
              placeholder="Descripción para SEO..."
              rows={2}
            />
          </div>

          <div>
            <Label htmlFor="seo_keywords">Palabras Clave SEO</Label>
            <Input
              id="seo_keywords"
              value={formData.seo_keywords}
              onChange={(e) => handleInputChange('seo_keywords', e.target.value)}
              placeholder="palabra1, palabra2, palabra3..."
            />
          </div>

          <div>
            <Label htmlFor="primary_term_product_cat">Categoría Principal SEO</Label>
            <Input
              id="primary_term_product_cat"
              value={formData.primary_term_product_cat}
              onChange={(e) => handleInputChange('primary_term_product_cat', e.target.value)}
              placeholder="Categoría principal para SEO..."
            />
          </div>
        </CardContent>
      </Card>

      {/* Form Actions */}
      <div className="flex justify-end gap-4 pt-6 border-t">
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => {
            if (onCancel) {
              onCancel();
            } else if (typeof window !== 'undefined') {
              // Default navigation if no onCancel provided (standalone mode)
              window.location.href = '/products';
            }
          }} 
          disabled={isCreating || loading}
        >
          Cancelar
        </Button>
        <Button type="submit" disabled={isCreating || loading}>
          {isCreating ? (
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
              {uploadProgress || 'Creando...'}
            </div>
          ) : (
            loading ? 'Guardando...' : 'Crear Producto'
          )}
        </Button>
      </div>
      
      {/* Error Display */}
      {errors.submit && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-700 text-sm font-medium">Error:</p>
          <p className="text-red-600 text-sm">{errors.submit}</p>
        </div>
      )}
      
      {/* Success Message */}
      {uploadProgress && !isCreating && (
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <p className="text-green-700 text-sm font-medium">{uploadProgress}</p>
        </div>
      )}
    </form>
  );
};

export default ProductForm;
