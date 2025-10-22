import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { OrderService } from '../../../../services/orderService';

export const DELETE: APIRoute = withAuth(async (context) => {
  try {
    const { id } = context.params;
    const orderId = parseInt(id as string);

    if (isNaN(orderId)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'ID de orden inválido'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Parse request body
    const body = await context.request.json();
    const { pdfType, pdfUrl } = body;

    if (!pdfType || !['budget', 'contract'].includes(pdfType)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Tipo de PDF inválido. Debe ser "budget" o "contract"'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get current order
    const order = await OrderService.getOrderById(orderId);
    
    if (!order) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Orden no encontrada'
        }),
        {
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
      let updateData: any = {
        date_modified: new Date().toISOString()
      };

      if (pdfType === 'budget') {
        // Handle budget PDF deletion
        if (!pdfUrl) {
          return new Response(
            JSON.stringify({
              success: false,
              message: 'URL del presupuesto es requerida'
            }),
            {
              status: 400,
              headers: { 'Content-Type': 'application/json' }
            }
          );
        }

        const currentUrls = order.new_pdf_on_hold_url || '';
        
        // Split URLs, filter out the one to delete, and rejoin
        const urlArray = currentUrls
          .split(',')
          .map((url: string) => url.trim())
          .filter((url: string) => url && url !== pdfUrl);

        // Update with cleaned URLs or null if empty
        updateData.new_pdf_on_hold_url = urlArray.length > 0 ? urlArray.join(',') : null;

      } else if (pdfType === 'contract') {
        // Handle contract PDF deletion
        updateData.new_pdf_processing_url = null;
      }

      // Update the order
      const updatedOrder = await OrderService.updateOrder(orderId, updateData);

      if (!updatedOrder) {
        return new Response(
          JSON.stringify({
            success: false,
            message: 'Error al eliminar PDF'
          }),
          {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: pdfType === 'budget' 
            ? 'Presupuesto eliminado exitosamente' 
            : 'Contrato eliminado exitosamente',
          data: updatedOrder
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );

    } catch (error) {
      console.error('Error deleting PDF:', error);
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Error interno del servidor al eliminar PDF'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
});

// Handle other methods
export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({ success: false, message: 'Método no permitido' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};

export const POST: APIRoute = async () => {
  return new Response(
    JSON.stringify({ success: false, message: 'Método no permitido' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};

export const PUT: APIRoute = async () => {
  return new Response(
    JSON.stringify({ success: false, message: 'Método no permitido' }),
    { status: 405, headers: { 'Content-Type': 'application/json' } }
  );
};
