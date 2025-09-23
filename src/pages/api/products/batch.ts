import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import type { Database } from '../../../types/database';

type Product = Database['public']['Tables']['products']['Row'];

export const POST: APIRoute = async ({ request }) => {
  try {
    const body = await request.json();
    const { ids } = body;

    // Validate required parameters
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Se requiere un array de IDs de productos',
          data: []
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Validate and convert IDs to numbers
    const validIds: number[] = [];
    const invalidIds: any[] = [];
    
    ids.forEach(id => {
      const numId = typeof id === 'string' ? parseInt(id, 10) : 
                   typeof id === 'number' ? id : NaN;
      
      if (!isNaN(numId) && numId > 0) {
        validIds.push(numId);
      } else {
        invalidIds.push(id);
      }
    });
    
    if (validIds.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          message: `No se encontraron IDs válidos de productos. IDs inválidos: ${JSON.stringify(invalidIds)}`,
          data: [],
          invalidIds
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Fetch products from database
    if (!supabaseAdmin) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error de configuración del servidor: cliente de base de datos no disponible',
          data: []
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }
    
    const { data: products, error } = await supabaseAdmin
      .from('products')
      .select('*')
      .in('id', validIds);

    if (error) {
      console.error('Error fetching products:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error al obtener productos de la base de datos',
          error: error.message,
          data: []
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json'
          }
        }
      );
    }

    // Ensure we return products in the same order as requested IDs
    const orderedProducts: Product[] = [];
    validIds.forEach(id => {
      const product = products?.find(p => p.id === id);
      if (product) {
        orderedProducts.push(product);
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        message: `Se obtuvieron ${orderedProducts.length} producto${orderedProducts.length !== 1 ? 's' : ''} de ${validIds.length} solicitado${validIds.length !== 1 ? 's' : ''}`,
        data: orderedProducts,
        requested: validIds.length,
        found: orderedProducts.length,
        missing: validIds.filter(id => !orderedProducts.some(p => p.id === id))
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

  } catch (error) {
    console.error('Error in products batch endpoint:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno del servidor al obtener productos',
        error: error instanceof Error ? error.message : 'Error desconocido',
        data: []
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }
};

// Support other HTTP methods with proper responses
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Este endpoint requiere una petición POST con un array de IDs de productos'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const PUT: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Método PUT no soportado. Use POST para obtener productos por lotes'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const DELETE: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      success: false,
      message: 'Método DELETE no soportado. Use POST para obtener productos por lotes'
    }),
    {
      status: 405,
      headers: {
        'Content-Type': 'application/json',
        'Allow': 'POST'
      }
    }
  );
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Allow': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    }
  });
};
