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
import { Textarea } from './ui/textarea';
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "./ui/dialog";
import { 
  Plus, 
  Search, 
  Edit, 
  Trash2, 
  RefreshCw,
  FolderTree,
  Tag,
  Image as ImageIcon
} from 'lucide-react';
import { toast } from 'sonner';
import type { Database } from '../types/database';
import React from 'react';

type Category = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];

interface CategoriesResponse {
  categories: Category[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

interface CategoriesDashboardProps {
  initialCategories?: Category[];
  initialTotal?: number;
  initialStats?: {
    total: number;
    main: number;
    sub: number;
    withImages: number;
  };
}

const CategoriesDashboard = ({ 
  initialCategories = [],
  initialTotal = 0,
  initialStats
}: CategoriesDashboardProps) => {
  // All categories loaded from server
  const [allCategories] = useState<Category[]>(initialCategories);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [isMobileView, setIsMobileView] = useState(false);
  
  // Pagination states
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20);

  // Form states
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [formData, setFormData] = useState<Partial<CategoryInsert>>({
    name: '',
    slug: '',
    description: '',
    parent: null,
    image_src: ''
  });

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

  // Filter categories based on search term
  const filteredCategories = React.useMemo(() => {
    if (!searchTerm) return allCategories;
    const searchLower = searchTerm.toLowerCase();
    return allCategories.filter(category => 
      category.name.toLowerCase().includes(searchLower) ||
      category.slug.toLowerCase().includes(searchLower) ||
      (category.description && category.description.toLowerCase().includes(searchLower))
    );
  }, [allCategories, searchTerm]);

  // Calculate pagination
  const totalFilteredCategories = filteredCategories.length;
  const totalPages = Math.ceil(totalFilteredCategories / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const currentCategories = filteredCategories.slice(startIndex, endIndex);

  // Auto-generate slug from name
  const generateSlug = (name: string) => {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  };

  // Handle form input changes
  const handleInputChange = (field: keyof CategoryInsert, value: string | number | null) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Auto-generate slug when name changes
    if (field === 'name' && typeof value === 'string') {
      setFormData(prev => ({
        ...prev,
        slug: generateSlug(value)
      }));
    }
  };

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page
  };

  // Reset page when search changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm]);

  // Refresh data - reload the page to get fresh server-side data
  const refreshData = () => {
    if (typeof window !== 'undefined') {
      window.location.reload();
    }
  };

  // Create new category
  const handleCreateCategory = async () => {
    try {
      if (!formData.name?.trim()) {
        toast.error('El nombre es requerido');
        return;
      }

      setLoading(true);
      const response = await fetch('/api/categories', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al crear categoría');
      }

      toast.success('Categoría creada exitosamente');
      setIsCreateDialogOpen(false);
      resetForm();
      refreshData();
    } catch (err) {
      console.error('Error creating category:', err);
      toast.error(err instanceof Error ? err.message : 'Error al crear categoría');
    } finally {
      setLoading(false);
    }
  };

  // Update category
  const handleUpdateCategory = async () => {
    try {
      if (!editingCategory || !formData.name?.trim()) {
        toast.error('Datos inválidos para actualizar');
        return;
      }

      setLoading(true);
      const response = await fetch(`/api/categories/${editingCategory.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al actualizar categoría');
      }

      toast.success('Categoría actualizada exitosamente');
      setIsEditDialogOpen(false);
      setEditingCategory(null);
      resetForm();
      refreshData();
    } catch (err) {
      console.error('Error updating category:', err);
      toast.error(err instanceof Error ? err.message : 'Error al actualizar categoría');
    } finally {
      setLoading(false);
    }
  };

  // Delete category
  const handleDeleteCategory = async (categoryId: number, categoryName: string) => {
    if (!confirm(`¿Estás seguro de que deseas eliminar la categoría "${categoryName}"?`)) {
      return;
    }

    try {
      setLoading(true);
      const response = await fetch(`/api/categories/${categoryId}`, {
        method: 'DELETE',
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Error al eliminar categoría');
      }

      toast.success('Categoría eliminada exitosamente');
      refreshData();
    } catch (err) {
      console.error('Error deleting category:', err);
      toast.error(err instanceof Error ? err.message : 'Error al eliminar categoría');
    } finally {
      setLoading(false);
    }
  };

  // Open edit dialog
  const openEditDialog = (category: Category) => {
    setEditingCategory(category);
    setFormData({
      name: category.name,
      slug: category.slug,
      description: category.description || '',
      parent: category.parent,
      image_src: category.image_src || ''
    });
    setIsEditDialogOpen(true);
  };

  // Reset form
  const resetForm = () => {
    setFormData({
      name: '',
      slug: '',
      description: '',
      parent: null,
      image_src: ''
    });
  };

  // Handle search
  const handleSearch = () => {
    setCurrentPage(1);
  };

  // Handle pagination
  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Get parent category name
  const getParentCategoryName = (parentId: number | null) => {
    if (!parentId) return 'Ninguna';
    const parent = allCategories.find(cat => cat.id === parentId);
    return parent ? parent.name : `ID: ${parentId}`;
  };

  // Generate professional page numbers with ellipsis
  const generatePageNumbers = () => {
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
      pages.push({ type: 'page', number: 1 });
      if (startPage > 2) {
        pages.push({ type: 'ellipsis', key: 'ellipsis1' });
      }
    }
    
    // Show visible page range
    for (let i = startPage; i <= endPage; i++) {
      pages.push({ type: 'page', number: i });
    }
    
    // Show last page and ellipsis if needed
    if (endPage < totalPages) {
      if (endPage < totalPages - 1) {
        pages.push({ type: 'ellipsis', key: 'ellipsis2' });
      }
      pages.push({ type: 'page', number: totalPages });
    }
    
    return pages;
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Gestión de Categorías</h1>
          <p className="text-muted-foreground">
            Administra las categorías de productos de tu inventario
          </p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => resetForm()}>
              <Plus className="h-4 w-4 mr-2" />
              Nueva Categoría
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[500px]">
            <DialogHeader>
              <DialogTitle>Crear Nueva Categoría</DialogTitle>
              <DialogDescription>
                Completa los datos para crear una nueva categoría de productos.
              </DialogDescription>
            </DialogHeader>
            
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Nombre *</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => handleInputChange('name', e.target.value)}
                  placeholder="Nombre de la categoría"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="slug">Slug</Label>
                <Input
                  id="slug"
                  value={formData.slug || ''}
                  onChange={(e) => handleInputChange('slug', e.target.value)}
                  placeholder="slug-de-la-categoria"
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="description">Descripción</Label>
                <Textarea
                  id="description"
                  value={formData.description || ''}
                  onChange={(e) => handleInputChange('description', e.target.value)}
                  placeholder="Descripción de la categoría"
                  rows={3}
                />
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="parent">Categoría Padre</Label>
                <Select 
                  value={formData.parent?.toString() || 'none'} 
                  onValueChange={(value) => handleInputChange('parent', value === 'none' ? null : parseInt(value))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar categoría padre" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna (Categoría principal)</SelectItem>
                    {allCategories.map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="image_src">URL de Imagen</Label>
                <Input
                  id="image_src"
                  value={formData.image_src || ''}
                  onChange={(e) => handleInputChange('image_src', e.target.value)}
                  placeholder="https://ejemplo.com/imagen.jpg"
                />
              </div>
            </div>
            
            <DialogFooter>
              <Button variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateCategory} disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                Crear Categoría
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Categorías</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{initialStats?.total || initialTotal}</div>
            <p className="text-xs text-muted-foreground">
              Categorías registradas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Principales</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {initialStats?.main || allCategories.filter(cat => !cat.parent).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorías principales
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Subcategorías</CardTitle>
            <FolderTree className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {initialStats?.sub || allCategories.filter(cat => cat.parent).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorías anidadas
            </p>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Con Imágenes</CardTitle>
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {initialStats?.withImages || allCategories.filter(cat => cat.image_src).length}
            </div>
            <p className="text-xs text-muted-foreground">
              Categorías con imagen
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Buscar Categorías</CardTitle>
          <CardDescription>
            Encuentra categorías por nombre o descripción
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Buscar por nombre o descripción..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                  onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSearch} disabled={loading}>
                {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => setSearchTerm('')}
              >
                Limpiar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Categories Table/Cards */}
      <Card>
        <CardHeader>
          <CardTitle>Categorías ({initialStats?.total || initialTotal})</CardTitle>
          <CardDescription>
            Lista de todas las categorías de productos
            {searchTerm && (
              <span className="block mt-1 text-sm">
                Mostrando {totalFilteredCategories} resultados para "{searchTerm}"
              </span>
            )}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          )}

          {loading ? (
            <div className="space-y-3">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="flex items-center space-x-4">
                  <Skeleton className="h-12 w-12 rounded" />
                  <div className="space-y-2 flex-1">
                    <Skeleton className="h-4 w-[200px]" />
                    <Skeleton className="h-4 w-[150px]" />
                  </div>
                </div>
              ))}
            </div>
          ) : isMobileView ? (
            // Mobile Card View
            <div className="space-y-4">
              {currentCategories.map((category) => (
                <Card key={category.id} className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        {category.image_src && (
                          <img 
                            src={category.image_src} 
                            alt={category.name}
                            className="w-8 h-8 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <h3 className="font-semibold">{category.name}</h3>
                        {!category.parent && (
                          <Badge variant="secondary">Principal</Badge>
                        )}
                      </div>
                      
                      <p className="text-sm text-muted-foreground mb-2">
                        Slug: {category.slug}
                      </p>
                      
                      {category.description && (
                        <p className="text-sm text-gray-600 mb-2">
                          {category.description}
                        </p>
                      )}
                      
                      <div className="text-xs text-muted-foreground">
                        <p>Padre: {getParentCategoryName(category.parent)}</p>
                        <p>Productos: {category.count}</p>
                        <p>Creado: {formatDate(category.created_at)}</p>
                      </div>
                    </div>
                    
                    <div className="flex gap-2 ml-4">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => openEditDialog(category)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDeleteCategory(category.id, category.name)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            // Desktop Table View
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Categoría</TableHead>
                  <TableHead>Slug</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Padre</TableHead>
                  <TableHead>Productos</TableHead>
                  <TableHead>Creado</TableHead>
                  <TableHead className="text-right">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {currentCategories.map((category) => (
                  <TableRow key={category.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        {category.image_src && (
                          <img 
                            src={category.image_src} 
                            alt={category.name}
                            className="w-8 h-8 rounded object-cover"
                            onError={(e) => {
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        )}
                        <div>
                          <div className="font-medium">{category.name}</div>
                          {!category.parent && (
                            <Badge variant="secondary" className="mt-1">Principal</Badge>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-sm">{category.slug}</TableCell>
                    <TableCell>
                      <div className="max-w-[200px] truncate">
                        {category.description || '-'}
                      </div>
                    </TableCell>
                    <TableCell>{getParentCategoryName(category.parent)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{category.count}</Badge>
                    </TableCell>
                    <TableCell>{formatDate(category.created_at)}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(category)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteCategory(category.id, category.name)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}

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
                  <option value={20}>20</option>
                  <option value={50}>50</option>
                  <option value={100}>100</option>
                </select>
                <span className="text-sm text-muted-foreground">por página</span>
              </div>
              
              <div className="text-sm text-muted-foreground">
                Mostrando {startIndex + 1}-{Math.min(endIndex, totalFilteredCategories)} de {totalFilteredCategories} categorías
                {searchTerm && ` (filtradas de ${initialStats?.total || initialTotal} total)`}
              </div>
            </div>

            {/* Professional Pagination */}
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
                      const pages = generatePageNumbers();
                      return pages.map((item, index) => {
                        if (item.type === 'ellipsis') {
                          return (
                            <span key={item.key} className="px-2 text-muted-foreground">
                              ...
                            </span>
                          );
                        }
                        
                        return (
                          <Button
                            key={item.number}
                            variant={item.number === currentPage ? "default" : "outline"}
                            size="sm"
                            onClick={() => handlePageChange(item.number!)}
                            className="w-9 h-9 p-0"
                          >
                            {item.number}
                          </Button>
                        );
                      });
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

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>Editar Categoría</DialogTitle>
            <DialogDescription>
              Modifica los datos de la categoría seleccionada.
            </DialogDescription>
          </DialogHeader>
          
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="edit-name">Nombre *</Label>
              <Input
                id="edit-name"
                value={formData.name || ''}
                onChange={(e) => handleInputChange('name', e.target.value)}
                placeholder="Nombre de la categoría"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-slug">Slug</Label>
              <Input
                id="edit-slug"
                value={formData.slug || ''}
                onChange={(e) => handleInputChange('slug', e.target.value)}
                placeholder="slug-de-la-categoria"
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-description">Descripción</Label>
              <Textarea
                id="edit-description"
                value={formData.description || ''}
                onChange={(e) => handleInputChange('description', e.target.value)}
                placeholder="Descripción de la categoría"
                rows={3}
              />
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-parent">Categoría Padre</Label>
              <Select 
                value={formData.parent?.toString() || 'none'} 
                onValueChange={(value) => handleInputChange('parent', value === 'none' ? null : parseInt(value))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar categoría padre" />
                </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Ninguna (Categoría principal)</SelectItem>
                    {allCategories
                      .filter(cat => cat.id !== editingCategory?.id) // Evitar auto-referencia
                      .map((category) => (
                      <SelectItem key={category.id} value={category.id.toString()}>
                        {category.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
              </Select>
            </div>
            
            <div className="grid gap-2">
              <Label htmlFor="edit-image_src">URL de Imagen</Label>
              <Input
                id="edit-image_src"
                value={formData.image_src || ''}
                onChange={(e) => handleInputChange('image_src', e.target.value)}
                placeholder="https://ejemplo.com/imagen.jpg"
              />
            </div>
          </div>
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleUpdateCategory} disabled={loading}>
              {loading ? <RefreshCw className="h-4 w-4 mr-2 animate-spin" /> : <Edit className="h-4 w-4 mr-2" />}
              Actualizar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CategoriesDashboard;
