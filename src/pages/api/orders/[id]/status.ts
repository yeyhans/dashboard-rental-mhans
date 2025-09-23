import type { APIRoute } from 'astro';
import { supabase } from '../../../../lib/supabase';

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const { status, reason } = await request.json();

    if (!id) {
      return new Response(JSON.stringify({ error: 'Order ID is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!status) {
      return new Response(JSON.stringify({ error: 'Status is required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Valid order statuses
    const validStatuses = [
      'pending', 'processing', 'on-hold', 'completed', 
      'cancelled', 'refunded', 'failed', 'trash', 'auto-draft'
    ];

    if (!validStatuses.includes(status)) {
      return new Response(JSON.stringify({ error: 'Invalid status' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Update order status in Supabase
    const { data, error } = await supabase
      .from('orders')
      .update({ 
        status,
        date_modified: new Date().toISOString()
      })
      .eq('id', parseInt(id))
      .select()
      .single();

    if (error) {
      console.error('Error updating order status:', error);
      return new Response(JSON.stringify({ error: 'Failed to update order status' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Log the status change for history (you can implement this later)
    // await logOrderHistory(id, 'status_change', { old_status: data.status, new_status: status, reason });

    return new Response(JSON.stringify({ 
      success: true, 
      data,
      message: `Order status updated to ${status}` 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in status update API:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
