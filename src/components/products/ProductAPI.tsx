import type { Product } from '../../types/product';

export async function updateProduct(productId: string | number, data: Partial<Product>): Promise<{success: boolean, message: string, data?: any}> {
  try {
    const response = await fetch(`/api/woo/update-product/${productId}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error updating product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while updating product'
    };
  }
}

export async function getProduct(productId: string | number): Promise<{success: boolean, data?: Product, message?: string}> {
  try {
    const response = await fetch(`/api/woo/get-product/${productId}`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching product:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while fetching product'
    };
  }
}

export async function getCategories(): Promise<{success: boolean, data?: {categories: any[], total?: string}, message?: string}> {
  try {
    const response = await fetch(`/api/woo/get-categories`);
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('Error fetching categories:', error);
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Unknown error occurred while fetching categories'
    };
  }
} 