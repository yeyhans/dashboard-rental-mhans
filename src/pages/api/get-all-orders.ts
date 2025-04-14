import type { APIRoute } from 'astro';

interface WordPressOrder {
  id: number;
  status: string;
  date_created: string;
  total: string;
  customer: {
    first_name: string;
    last_name: string;
    email: string;
  };
  fotos_garantia: string[];
  correo_enviado: boolean;
  pago_completo: boolean;
}

interface WooCommerceOrder {
  id: number;
  status: string;
  date_created: string;
  date_modified: string;
  customer_id: number;
  billing: {
    first_name: string;
    last_name: string;
    company: string;
    address_1: string;
    city: string;
    email: string;
    phone: string;
  };
  metadata: Record<string, string>;
  line_items: Array<{
    name: string;
    product_id: number;
    sku: string;
    price: number;
    quantity: number;
    image: string;
  }>;
}

export const GET: APIRoute = async ({ request }) => {
  try {
    const url = new URL(request.url);
    const page = url.searchParams.get('page') || '1';
    const per_page = url.searchParams.get('per_page') || '20';

    // Fetch WooCommerce orders
    const wooResponse = await fetch(`${url.origin}/api/woo/get-orders?page=${page}&per_page=${per_page}`);
    const wooData = await wooResponse.json();

    // Fetch WordPress orders
    const wpResponse = await fetch(`${url.origin}/api/wp/get-orders?page=${page}&per_page=${per_page}`);
    const wpData = await wpResponse.json();

    // Ensure we have valid data structures or default to empty arrays
    const wooOrders = (wooData?.data?.orders || []) as WooCommerceOrder[];
    const wpOrders = (wpData?.orders?.orders || []) as WordPressOrder[];

    console.log('WooCommerce orders count:', wooOrders.length);
    console.log('WordPress orders count:', wpOrders.length);

    // Create a map of WooCommerce orders by ID for easy lookup
    const wooOrdersMap = new Map(
      wooOrders.map((order) => [order.id, order])
    );

    // Create a map of WordPress orders by ID for easy lookup
    const wpOrdersMap = new Map(
      wpOrders.map((order) => [order.id, order])
    );

    // Get all unique order IDs
    const allOrderIds = new Set([...wooOrdersMap.keys(), ...wpOrdersMap.keys()]);
    console.log('Total unique orders:', allOrderIds.size);

    // Combine and merge orders based on ID
    const mergedOrders = Array.from(allOrderIds).map(orderId => {
      const wooOrder = wooOrdersMap.get(orderId);
      const wpOrder = wpOrdersMap.get(orderId);

      // If order exists in both systems, merge the data
      if (wooOrder && wpOrder) {
        return {
          ...wooOrder,
          wordpress_data: {
            ...wpOrder,
            fotos_garantia: wpOrder.fotos_garantia || [],
            correo_enviado: wpOrder.correo_enviado || false,
            pago_completo: wpOrder.pago_completo || false
          }
        };
      }

      // If order only exists in WooCommerce
      if (wooOrder) {
        return {
          ...wooOrder,
          wordpress_data: null
        };
      }

      // If order only exists in WordPress
      if (wpOrder) {
        return {
          id: orderId,
          status: wpOrder.status,
          date_created: wpOrder.date_created,
          total: wpOrder.total,
          customer: wpOrder.customer,
          woocommerce_data: null,
          wordpress_data: {
            ...wpOrder,
            fotos_garantia: wpOrder.fotos_garantia || [],
            correo_enviado: wpOrder.correo_enviado || false,
            pago_completo: wpOrder.pago_completo || false
          }
        };
      }

      // This should never happen, but TypeScript needs it
      return null;
    }).filter(order => order !== null);

    // Calculate total based on the merged orders
    const total = mergedOrders.length;
    const totalPages = Math.ceil(total / parseInt(per_page));

    // Add some debug information to help troubleshoot
    console.log('Merged orders count:', mergedOrders.length);
    console.log('Calculated total pages:', totalPages);

    return new Response(JSON.stringify({
      success: true,
      message: 'Orders fetched successfully',
      data: {
        orders: mergedOrders,
        total: total,
        totalPages: totalPages,
        page: parseInt(page),
        per_page: parseInt(per_page),
        debug: {
          wooOrdersCount: wooOrders.length,
          wpOrdersCount: wpOrders.length,
          uniqueOrdersCount: allOrderIds.size
        }
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });

  } catch (error: any) {
    console.error('Error fetching combined orders:', error);
    
    // Add more detailed error information
    return new Response(JSON.stringify({
      success: false,
      message: 'Error fetching combined orders',
      error: error.message,
      stack: error.stack,
      details: {
        name: error.name,
        cause: error.cause
      }
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 