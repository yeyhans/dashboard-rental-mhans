import React, { useState } from 'react';
import { ProductDetail } from './ProductDetail';
import { updateProduct } from './ProductAPI';
import type { Product, ProductCategory } from '../../types/product';
import { Toaster } from 'sonner';

interface ProductDetailControllerProps {
  initialProduct: Product;
  initialCategories: ProductCategory[];
}

export function ProductDetailController({ initialProduct, initialCategories }: ProductDetailControllerProps) {
  const [product, setProduct] = useState<Product>(initialProduct);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'loading' | null; message: string | null }>({
    type: null,
    message: null
  });

  const handleSaveProduct = async (updatedProduct: Partial<Product>) => {
    setStatusMessage({ type: 'loading', message: 'Guardando cambios...' });
    
    try {
      const result = await updateProduct(product.id, updatedProduct);
      
      if (result.success) {
        setStatusMessage({ type: 'success', message: 'Producto actualizado correctamente' });
        
        // Update local state with the changes
        setProduct({
          ...product,
          ...updatedProduct
        });
        
        // After a brief delay, clear the status message
        setTimeout(() => {
          setStatusMessage({ type: null, message: null });
        }, 3000);
        
        return Promise.resolve();
      } else {
        setStatusMessage({ type: 'error', message: result.message || 'Error al actualizar el producto' });
        return Promise.reject(new Error(result.message));
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al actualizar el producto';
      setStatusMessage({ type: 'error', message: errorMessage });
      return Promise.reject(error);
    }
  };

  return (
    <>
      {statusMessage.type === 'error' && statusMessage.message && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md max-w-5xl mx-auto mt-4">
          {statusMessage.message}
        </div>
      )}
      
      <ProductDetail 
        product={product} 
        categories={initialCategories} 
        onSave={handleSaveProduct}
      />
      
      <Toaster richColors position="top-right" />
    </>
  );
} 