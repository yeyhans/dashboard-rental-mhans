import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type Product = Database['public']['Tables']['products']['Row'];
type ProductInsert = Database['public']['Tables']['products']['Insert'];
type ProductUpdate = Database['public']['Tables']['products']['Update'];

export class ProductService {
  /**
   * Verificar que el cliente de Supabase esté disponible
   */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin;
  }

  /**
   * Obtener todos los productos con paginación
   */
  static async getAllProducts(page: number = 1, limit: number = 1000, includeInactive: boolean = false) {
    try {
      const client = this.ensureSupabaseAdmin();
      const offset = (page - 1) * limit;
      
      let query = client
        .from('products')
        .select('*', { count: 'exact' })
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('status', 'publish');
      }

      const { data, error, count } = await query
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        products: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching products:', error);
      throw error;
    }
  }

  /**
   * Obtener producto por ID
   */
  static async getProductById(productId: number): Promise<Product | null> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('id', productId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching product by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener producto por slug
   */
  static async getProductBySlug(slug: string): Promise<Product | null> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error } = await client
        .from('products')
        .select('*')
        .eq('slug', slug)
        .eq('status', 'publish')
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null;
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching product by slug:', error);
      throw error;
    }
  }

  /**
   * Crear nuevo producto
   */
  static async createProduct(productData: ProductInsert): Promise<Product> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error } = await client
        .from('products')
        .insert([productData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error creating product:', error);
      throw error;
    }
  }

  /**
   * Actualizar producto
   */
  static async updateProduct(productId: number, updates: ProductUpdate): Promise<Product> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error } = await client
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating product:', error);
      throw error;
    }
  }

  /**
   * Eliminar producto
   */
  static async deleteProduct(productId: number): Promise<boolean> {
    try {
      const client = this.ensureSupabaseAdmin();
      const { error } = await client
        .from('products')
        .delete()
        .eq('id', productId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting product:', error);
      throw error;
    }
  }

  /**
   * Obtener todos los productos activos sin paginación (para selectores)
   */
  static async getAllActiveProducts() {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error, count } = await client
        .from('products')
        .select('*', { count: 'exact' })
        .eq('status', 'publish')
        .order('name', { ascending: true });

      if (error) {
        throw error;
      }

      return {
        products: data,
        total: count || 0
      };
    } catch (error) {
      console.error('Error fetching all active products:', error);
      throw error;
    }
  }

  /**
   * Buscar productos
   */
  static async searchProducts(searchTerm: string, page: number = 1, limit: number = 1000, categoryId?: number) {
    try {
      const offset = (page - 1) * limit;
      
      const client = this.ensureSupabaseAdmin();
      let query = client
        .from('products')
        .select('*', { count: 'exact' })
        .eq('status', 'publish');

      // Add search filter if searchTerm is provided
      if (searchTerm && searchTerm.trim()) {
        query = query.or(`name.ilike.%${searchTerm}%,description.ilike.%${searchTerm}%,short_description.ilike.%${searchTerm}%,sku.ilike.%${searchTerm}%`);
      }

      // Add category filter if categoryId is provided
      if (categoryId) {
        query = query.contains('categories_ids', [categoryId.toString()]);
      }

      const { data, error, count } = await query
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        products: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm,
        categoryId
      };
    } catch (error) {
      console.error('Error searching products:', error);
      throw error;
    }
  }

  /**
   * Obtener productos por categoría
   */
  static async getProductsByCategory(categoryId: number, page: number = 1, limit: number = 1000) {
    try {
      const client = this.ensureSupabaseAdmin();
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await client
        .from('products')
        .select('*', { count: 'exact' })
        .contains('categories_ids', [categoryId.toString()])
        .eq('status', 'publish')
        .order('name', { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        products: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        categoryId
      };
    } catch (error) {
      console.error('Error fetching products by category:', error);
      throw error;
    }
  }

  /**
   * Obtener productos destacados
   */
  static async getFeaturedProducts(limit: number = 1000) {
    try {
      const client = this.ensureSupabaseAdmin();
      const { data, error, count } = await client
        .from('products')
        .select('*', { count: 'exact' })
        .eq('featured', true)
        .eq('status', 'publish')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return {
        products: data,
        total: count || 0,
        page: 1,
        limit,
        totalPages: 1
      };
    } catch (error) {
      console.error('Error fetching featured products:', error);
      throw error;
    }
  }

  /**
   * Actualizar stock de producto
   */
  static async updateProductStock(productId: number, quantity: number): Promise<Product> {
    try {
      const client = this.ensureSupabaseAdmin();
      const product = await this.getProductById(productId);
      if (!product) {
        throw new Error('Producto no encontrado');
      }

      // Note: The current schema doesn't have stock_quantity field, using stock_status only
      const stockStatus = quantity > 0 ? 'instock' : 'outofstock';

      const { data, error } = await client
        .from('products')
        .update({ 
          stock_status: stockStatus,
          updated_at: new Date().toISOString()
        })
        .eq('id', productId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw error;
    }
  }

  /**
   * Obtener estadísticas de productos
   */
  static async getProductStats() {
    try {
      const client = this.ensureSupabaseAdmin();
      // Total de productos
      const { count: totalProducts, error: totalError } = await client
        .from('products')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Productos activos
      const { count: activeProducts, error: activeError } = await client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'publish');

      if (activeError) throw activeError;

      // Productos sin stock
      const { count: outOfStock, error: stockError } = await client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('stock_status', 'outofstock');

      if (stockError) throw stockError;

      // Productos destacados
      const { count: featuredProducts, error: featuredError } = await client
        .from('products')
        .select('*', { count: 'exact', head: true })
        .eq('featured', true)
        .eq('status', 'publish');

      if (featuredError) throw featuredError;

      return {
        totalProducts: totalProducts || 0,
        activeProducts: activeProducts || 0,
        outOfStock: outOfStock || 0,
        featuredProducts: featuredProducts || 0,
        inactiveProducts: (totalProducts || 0) - (activeProducts || 0),
        stockAvailabilityRate: totalProducts ? (((totalProducts || 0) - (outOfStock || 0)) / totalProducts * 100).toFixed(1) : '0'
      };
    } catch (error) {
      console.error('Error fetching product stats:', error);
      throw error;
    }
  }

  /**
   * Duplicar producto
   */
  static async duplicateProduct(productId: number): Promise<Product> {
    try {
      const originalProduct = await this.getProductById(productId);
      if (!originalProduct) {
        throw new Error('Producto no encontrado');
      }

      const duplicateData: ProductInsert = {
        name: `${originalProduct.name} (Copia)`,
        slug: `${originalProduct.slug}-copy-${Date.now()}`,
        description: originalProduct.description,
        short_description: originalProduct.short_description,
        sku: originalProduct.sku ? `${originalProduct.sku}-copy` : null,
        price: originalProduct.price,
        sale_price: originalProduct.sale_price,
        stock_status: 'outofstock',
        dimensions_length: originalProduct.dimensions_length,
        dimensions_width: originalProduct.dimensions_width,
        dimensions_height: originalProduct.dimensions_height,
        categories_ids: originalProduct.categories_ids,
        images: originalProduct.images,
        status: 'draft', // Inactivo por defecto
        featured: false,
        brands: originalProduct.brands,
        tags: originalProduct.tags
      };

      return await this.createProduct(duplicateData);
    } catch (error) {
      console.error('Error duplicating product:', error);
      throw error;
    }
  }

  /**
   * Actualizar stock de producto
   */
  static async updateStock(productId: number, stockQuantity: number): Promise<Product> {
    try {
      const client = this.ensureSupabaseAdmin();
      const updates: ProductUpdate = {
        updated_at: new Date().toISOString()
      };

      // Actualizar estado basado en stock
      if (stockQuantity <= 0) {
        updates.stock_status = 'outofstock';
      } else {
        updates.stock_status = 'instock';
      }

      const { data, error } = await client
        .from('products')
        .update(updates)
        .eq('id', productId)
        .select('*')
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating product stock:', error);
      throw error;
    }
  }
}
