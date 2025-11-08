import type { APIRoute } from 'astro';
import { ProductService } from '../../../services/productService';

export const POST: APIRoute = async ({ request }) => {
  try {
    const contentType = request.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Content-Type debe ser application/json'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const productData = await request.json();

    // Validate required fields
    const requiredFields = ['name', 'slug', 'sku'];
    const missingFields = requiredFields.filter(field => !productData[field]);
    
    if (missingFields.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `Campos requeridos faltantes: ${missingFields.join(', ')}`
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Prepare product data for insertion
    const productInsert = {
      name: productData.name,
      slug: productData.slug,
      type: productData.type || 'simple',
      status: productData.status || 'draft',
      featured: productData.featured || false,
      catalog_visibility: productData.catalog_visibility || 'visible',
      description: productData.description || null,
      short_description: productData.short_description || null,
      sku: productData.sku,
      price: productData.price || null,
      regular_price: productData.regular_price || null,
      sale_price: productData.sale_price || null,
      on_sale: productData.on_sale || false,
      total_sales: 0,
      sold_individually: productData.sold_individually || false,
      related_ids: null,
      stock_status: productData.stock_status || 'instock',
      brands: productData.brands || null,
      dimensions_length: productData.dimensions_length || null,
      dimensions_width: productData.dimensions_width || null,
      dimensions_height: productData.dimensions_height || null,
      seo_title: productData.seo_title || null,
      seo_description: productData.seo_description || null,
      seo_keywords: productData.seo_keywords || null,
      primary_term_product_cat: productData.primary_term_product_cat || null,
      images: productData.images || null,
      categories_ids: productData.categories_ids || null,
      categories_name: productData.categories_name || null,
      tags: productData.tags || null,
      collage_image_url: productData.collage_image_url || null,
    };

    // Create the product
    const newProduct = await ProductService.createProduct(productInsert);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Producto creado exitosamente',
        data: newProduct
      }),
      {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error creating product:', error);
    
    // Handle specific Supabase errors
    if (error && typeof error === 'object' && 'code' in error) {
      const supabaseError = error as any;
      
      if (supabaseError.code === '23505') {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Ya existe un producto con ese SKU o slug'
          }),
          {
            status: 409,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor al crear el producto'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};
