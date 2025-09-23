import type { Database } from '../../types/database';
import { apiClient } from '../../services/apiClient';

type Product = Database['public']['Tables']['products']['Row'];

export async function updateProduct(productId: string | number, data: Partial<Product>, accessToken?: string): Promise<{success: boolean, message: string, data?: any}> {
  try {
    // If we have an access token, use it directly instead of apiClient
    if (accessToken) {
      const response = await fetch(`/api/products/${productId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify(data)
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } else {
      // Fallback to apiClient
      const response = await apiClient.put(`/api/products/${productId}`, data);
      const result = await apiClient.handleJsonResponse<{success: boolean, message: string, data?: any}>(response);
      return result;
    }
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al actualizar el producto'
    };
  }
}

export async function getProduct(productId: string | number): Promise<{success: boolean, data?: Product, message?: string}> {
  try {
    const response = await apiClient.get(`/api/products/${productId}`);
    const result = await apiClient.handleJsonResponse<{success: boolean, data?: Product, message?: string}>(response);
    return result;
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al obtener el producto'
    };
  }
}

export async function getCategories(accessToken?: string): Promise<{success: boolean, data?: {categories: any[], total?: string}, message?: string}> {
  try {
    // If we have an access token, use it directly instead of apiClient
    if (accessToken) {
      const response = await fetch(`/api/categories?limit=100`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        }
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      return result;
    } else {
      // Fallback to apiClient
      const response = await apiClient.get(`/api/categories?limit=100`);
      const result = await apiClient.handleJsonResponse<{success: boolean, data?: {categories: any[], total?: string}, message?: string}>(response);
      return result;
    }
  } catch (error) {
    console.error('Error fetching categories:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al obtener las categorías'
    };
  }
}

export async function createProduct(data: Partial<Product>): Promise<{success: boolean, message: string, data?: any}> {
  try {
    const response = await apiClient.post('/api/products', data);
    const result = await apiClient.handleJsonResponse<{success: boolean, message: string, data?: any}>(response);
    return result;
  } catch (error) {
    console.error('Error creating product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al crear el producto'
    };
  }
}

export async function deleteProduct(productId: string | number): Promise<{success: boolean, message: string}> {
  try {
    const response = await apiClient.delete(`/api/products/${productId}`);
    const result = await apiClient.handleJsonResponse<{success: boolean, message: string}>(response);
    return result;
  } catch (error) {
    console.error('Error deleting product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Error al eliminar el producto'
    };
  }
}