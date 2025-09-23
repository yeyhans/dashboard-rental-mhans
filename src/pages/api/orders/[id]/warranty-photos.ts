import type { APIRoute } from 'astro';
import { OrderService } from '../../../../services/orderService';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const orderId = params.id;
    
    if (!orderId || isNaN(Number(orderId))) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid order ID'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = await request.json();
    const { photoUrls } = body;

    if (!Array.isArray(photoUrls)) {
      return new Response(JSON.stringify({
        success: false,
        error: 'photoUrls must be an array'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Validate URLs
    for (const url of photoUrls) {
      if (typeof url !== 'string' || !url.startsWith('https://')) {
        return new Response(JSON.stringify({
          success: false,
          error: 'All photo URLs must be valid HTTPS URLs'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        });
      }
    }

    // Update warranty photos
    const updatedOrder = await OrderService.updateWarrantyPhotos(Number(orderId), photoUrls);

    return new Response(JSON.stringify({
      success: true,
      message: `Successfully updated warranty photos for order ${orderId}`,
      order: updatedOrder,
      totalPhotos: photoUrls.length
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error updating warranty photos:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Failed to update warranty photos',
      message: error instanceof Error ? error.message : 'Unknown error'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const OPTIONS: APIRoute = async () => {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'PUT, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
  });
};
