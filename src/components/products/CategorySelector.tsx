import React, { useState, useEffect } from 'react';
import { Tag, X } from 'lucide-react';
import { Badge } from '../ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/select';
import { Label } from '../ui/label';
import { cn } from '../../lib/utils';
import { getCategories } from './ProductAPI';
import type { Database } from '../../types/database';

type Category = Database['public']['Tables']['categories']['Row'];

interface CategorySelectorProps {
  selectedCategoryIds: number[];
  onCategoryChange: (categoryIds: number[]) => void;
  accessToken?: string | undefined;
  className?: string;
}

export function CategorySelector({ 
  selectedCategoryIds, 
  onCategoryChange, 
  accessToken,
  className 
}: CategorySelectorProps) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCategories();
  }, [accessToken]);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const result = await getCategories(accessToken);
      
      if (result.success && result.data?.categories) {
        setCategories(result.data.categories);
      } else {
        console.error('Error loading categories:', result.message);
      }
    } catch (error) {
      console.error('Error loading categories:', error);
    } finally {
      setLoading(false);
    }
  };

  const selectedCategories = categories.filter(cat => 
    selectedCategoryIds.includes(cat.id)
  );

  const availableCategories = categories.filter(cat => 
    !selectedCategoryIds.includes(cat.id)
  );

  const handleAddCategory = (categoryId: string) => {
    const id = parseInt(categoryId);
    if (!isNaN(id) && !selectedCategoryIds.includes(id)) {
      onCategoryChange([...selectedCategoryIds, id]);
    }
  };

  const handleRemoveCategory = (categoryId: number) => {
    onCategoryChange(selectedCategoryIds.filter(id => id !== categoryId));
  };

  return (
    <div className={cn("space-y-3", className)}>
      <Label>Categorías del Producto</Label>
      
      {/* Selected Categories Display */}
      {selectedCategories.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedCategories.map((category) => (
            <Badge
              key={category.id}
              variant="secondary"
              className="flex items-center gap-1 px-2 py-1"
            >
              <Tag className="h-3 w-3" />
              {category.name}
              <button
                type="button"
                onClick={() => handleRemoveCategory(category.id)}
                className="ml-1 hover:text-destructive"
                title="Remover categoría"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      {/* Add Category Selector */}
      {availableCategories.length > 0 && (
        <Select onValueChange={handleAddCategory} disabled={loading}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder={loading ? "Cargando categorías..." : "Agregar categoría..."} />
          </SelectTrigger>
          <SelectContent>
            {availableCategories.map((category) => (
              <SelectItem key={category.id} value={category.id.toString()}>
                <div className="flex items-center space-x-2">
                  <Tag className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">{category.name}</div>
                    {category.description && (
                      <div className="text-sm text-muted-foreground">
                        {category.description}
                      </div>
                    )}
                  </div>
                </div>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {/* Category Count Info */}
      {!loading && (
        <div className="text-sm text-muted-foreground">
          {selectedCategories.length} de {categories.length} categorías seleccionadas
        </div>
      )}
    </div>
  );
}
