import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type Category = Database['public']['Tables']['categories']['Row'];
type CategoryInsert = Database['public']['Tables']['categories']['Insert'];
type CategoryUpdate = Database['public']['Tables']['categories']['Update'];

export class CategoryService {
  /**
   * Obtener todas las categorías con paginación
   */
  static async getAllCategories(page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      let query = supabaseAdmin
        .from('categories')
        .select('*', { count: 'exact' })
        .order('name', { ascending: true });

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        categories: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
  }

  /**
   * Obtener categoría por ID
   */
  static async getCategoryById(categoryId: number): Promise<Category | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('id', categoryId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching category by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener categoría por slug
   */
  static async getCategoryBySlug(slug: string): Promise<Category | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching category by slug:', error);
      throw error;
    }
  }

  /**
   * Crear nueva categoría
   */
  static async createCategory(categoryData: CategoryInsert): Promise<Category> {
    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .insert([categoryData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating category:', error);
      throw error;
    }
  }

  /**
   * Actualizar categoría
   */
  static async updateCategory(categoryId: number, updates: CategoryUpdate): Promise<Category> {
    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .update(updates)
        .eq('id', categoryId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating category:', error);
      throw error;
    }
  }

  /**
   * Eliminar categoría
   */
  static async deleteCategory(categoryId: number): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('categories')
        .delete()
        .eq('id', categoryId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting category:', error);
      throw error;
    }
  }

  /**
   * Obtener categorías jerárquicas (con subcategorías)
   */
  static async getCategoriesHierarchy(): Promise<(Category & { children?: Category[] })[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('categories')
        .select('*')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      // Organizar en jerarquía
      const categoryMap = new Map<number, Category & { children: Category[] }>();
      const rootCategories: (Category & { children: Category[] })[] = [];

      // Crear mapa de categorías
      data.forEach(category => {
        categoryMap.set(category.id, { ...category, children: [] });
      });

      // Organizar jerarquía
      data.forEach(category => {
        const categoryWithChildren = categoryMap.get(category.id)!;
        
        if (category.parent) {
          const parent = categoryMap.get(category.parent);
          if (parent) {
            parent.children.push(categoryWithChildren);
          }
        } else {
          rootCategories.push(categoryWithChildren);
        }
      });

      return rootCategories;
    } catch (error) {
      console.error('Error fetching categories hierarchy:', error);
      throw error;
    }
  }

  /**
   * Buscar categorías
   */
  static async searchCategories(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('categories')
        .select('*', { count: 'exact' })
        .or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%`)
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        categories: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm
      };
    } catch (error) {
      console.error('Error searching categories:', error);
      throw error;
    }
  }

  /**
   * Reordenar categorías (Note: sort_order field doesn't exist in current schema)
   */
  static async reorderCategories(): Promise<boolean> {
    try {
      // Since sort_order doesn't exist in the schema, we'll just return true
      // This method would need to be implemented when the schema supports ordering
      console.log('Reorder categories called but sort_order field not available in schema');
      return true;
    } catch (error) {
      console.error('Error reordering categories:', error);
      throw error;
    }
  }
}
