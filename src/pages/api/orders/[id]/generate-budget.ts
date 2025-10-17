import type { APIRoute } from 'astro';
import { generateBudgetPdfFromId } from '../../../../lib/orderPdfGenerationService';

/**
 * POST /api/orders/:id/generate-budget
 * 
 * Dedicated endpoint for generating budget PDFs after order creation.
 * This runs synchronously to avoid Vercel serverless timeout issues.
 * 
 * Flow:
 * 1. Generates PDF using orderPdfGenerationService
 * 2. Uploads PDF to R2 storage
 * 3. Sends email notification to customer
 * 4. Updates order.new_pdf_on_hold_url in Supabase (handled by underlying API)
 * 5. Returns PDF URL to frontend
 */
export const POST: APIRoute = async ({ params, request }) => {
  try {
    const orderId = parseInt(params.id || '');
    
    if (isNaN(orderId)) {
      return new Response(
        JSON.stringify({
          success: false,
          message: 'ID de orden inválido',
          error: 'Invalid order ID'
        }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Access-Control-Allow-Credentials': 'true',
          }
        }
      );
    }

    // Parse request body to get sendEmail option
    let sendEmail = true; // Default to true for backward compatibility
    try {
      const body = await request.json();
      if (typeof body.sendEmail === 'boolean') {
        sendEmail = body.sendEmail;
      }
    } catch (e) {
      // If no body or parsing fails, use default (true)
      console.log('No body provided, using default sendEmail: true');
    }

    console.log('🎯 POST /api/orders/:id/generate-budget - Starting PDF generation for order:', orderId);
    console.log('📧 Email will be sent:', sendEmail);

    // Generate PDF (uploads to R2, updates database, and optionally sends email)
    console.log('📄 Generating budget PDF...');
    const result = await generateBudgetPdfFromId(orderId, true, sendEmail);

    if (!result.success) {
      console.error('❌ PDF generation failed:', result.error);
      return new Response(
        JSON.stringify({
          success: false,
          message: result.message || 'Error al generar presupuesto',
          error: result.error
        }),
        {
          status: 500,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
            'Access-Control-Allow-Credentials': 'true',
          }
        }
      );
    }

    console.log('✅ PDF generated successfully:', result.pdfUrl);
    console.log('📋 Order already updated by generate-budget-pdf API');

    // Note: Order update is handled by /api/order/generate-budget-pdf
    // No need to update again here to avoid duplicate URLs

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Presupuesto generado exitosamente',
        pdfUrl: result.pdfUrl,
        metadata: result.metadata
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      }
    );

  } catch (error) {
    console.error('💥 Error in generate-budget endpoint:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        message: 'Error interno al generar presupuesto',
        error: error instanceof Error ? error.message : 'Error desconocido'
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
          'Access-Control-Allow-Credentials': 'true',
        }
      }
    );
  }
};

/**
 * OPTIONS handler for CORS preflight
 */
export const OPTIONS: APIRoute = async ({ request }) => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': request.headers.get('origin') || '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }
  });
};
