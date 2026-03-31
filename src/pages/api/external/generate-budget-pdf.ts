import type { APIRoute } from 'astro';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';

/**
 * External API endpoint for generating budget PDFs from frontend applications
 * This endpoint is specifically designed to be called from external frontend applications
 * running on different domains (like VPS Hostinger) to generate PDFs using the backend infrastructure
 *
 * Auth: requires either a valid Supabase JWT (Authorization: Bearer <token>)
 * or an inter-service API key (X-API-Key matching FRONTEND_API_SECRET env var).
 */

async function validateExternalRequest(request: Request): Promise<boolean> {
  // Check inter-service API key first (lightweight, no network call)
  const apiKeySecret = import.meta.env.FRONTEND_API_SECRET;
  const apiKey = request.headers.get('X-API-Key');
  if (apiKeySecret && apiKey && apiKey === apiKeySecret) {
    return true;
  }

  // Fall back to validating a Supabase JWT
  const authHeader = request.headers.get('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    try {
      const supabase = createClient(
        import.meta.env.SUPABASE_URL!,
        import.meta.env.SUPABASE_SERVICE_ROLE_KEY!,
        { auth: { persistSession: false, autoRefreshToken: false } }
      );
      const { data, error } = await supabase.auth.getUser(token);
      if (!error && data?.user) return true;
    } catch {
      // invalid token — fall through to 401
    }
  }

  return false;
}

export const POST: APIRoute = async ({ request }) => {
  try {
    // Enable CORS for cross-origin requests from frontend
    const allowedOrigins = [
      'http://localhost:4321', // Frontend development server
      'http://localhost:3000', // Alternative frontend port
      import.meta.env.PUBLIC_FRONTEND_URL || 'http://localhost:4321'
    ].filter(Boolean);

    const origin = request.headers.get('Origin');
    const corsHeaders = {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, x-frontend-source, Accept',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    };

    // Handle preflight OPTIONS request
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: corsHeaders
      });
    }

    // Rate limiting: 5 requests per minute per IP
    const ip = getClientIp(request);
    const rl = checkRateLimit(ip, RATE_LIMITS.pdfGeneration);
    if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

    // Validate inter-service auth
    const authorized = await validateExternalRequest(request);
    if (!authorized) {
      console.error('[POST /api/external/generate-budget-pdf] Solicitud no autorizada');
      return new Response(JSON.stringify({
        success: false,
        error: 'No autorizado'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('[POST /api/external/generate-budget-pdf] Solicitud externa autorizada');
    
    const requestData = await request.json();
    console.log('📋 Received external request data:', {
      order_id: requestData.order_id,
      customer_id: requestData.customer_id,
      billing_email: requestData.billing?.email,
      project_name: requestData.metadata?.order_proyecto,
      source: 'external-frontend'
    });

    const { 
      orderData,
      uploadToR2 = true,
      sendEmail = true 
    } = requestData;

    // Validate required fields for external requests
    if (!orderData || !orderData.order_id || !orderData.customer_id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Campos requeridos faltantes: orderData.order_id, orderData.customer_id'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Validate billing information
    const billingEmail = orderData.billing?.email;
    if (!billingEmail) {
      return new Response(JSON.stringify({
        success: false,
        message: 'Email de facturación requerido para generar presupuesto'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    // Create order in Supabase if it doesn't exist (for frontend-generated orders)
    console.log('💾 Processing order data for external request...');
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );

    // Check if order exists, create if not
    let { data: existingOrder, error: fetchError } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderData.order_id)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      console.error('❌ Error checking existing order:', fetchError);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al verificar orden existente'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    if (!existingOrder) {
      console.log('📝 Order does not exist, creating new order in database...');
      
      // Verify customer exists or get a valid customer_id
      let validCustomerId = parseInt(orderData.customer_id);
      
      // Check if customer exists
      const { data: customerCheck } = await supabase
        .from('user_profiles')
        .select('user_id')
        .eq('user_id', validCustomerId)
        .single();
      
      if (!customerCheck) {
        console.log('⚠️  Customer ID does not exist, will try to find any valid customer...');
        // Get any existing customer as fallback
        const { data: anyCustomer } = await supabase
          .from('user_profiles')
          .select('user_id')
          .limit(1)
          .single();
        
        if (anyCustomer) {
          validCustomerId = anyCustomer.user_id;
          console.log(`✅ Using existing customer ID: ${validCustomerId}`);
        } else {
          console.error('❌ No customers found in database');
          return new Response(JSON.stringify({
            success: false,
            message: 'No se encontraron clientes válidos en la base de datos'
          }), {
            status: 500,
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          });
        }
      }
      
      // Prepare order data for Supabase insertion using actual table schema
      const supabaseOrderData = {
        id: orderData.order_id,
        customer_id: validCustomerId,
        status: orderData.status || 'on-hold',
        currency: 'CLP',
        date_created: orderData.created_at || new Date().toISOString(),
        date_modified: new Date().toISOString(),
        // Billing information
        billing_first_name: orderData.billing?.first_name || '',
        billing_last_name: orderData.billing?.last_name || '',
        billing_company: orderData.billing?.company || '',
        billing_email: orderData.billing?.email || '',
        billing_phone: orderData.billing?.phone || '',
        billing_address_1: orderData.billing?.address_1 || '',
        billing_city: orderData.billing?.city || '',
        // Order project details
        order_proyecto: orderData.metadata?.order_proyecto || '',
        order_fecha_inicio: orderData.metadata?.order_fecha_inicio || '',
        order_fecha_termino: orderData.metadata?.order_fecha_termino || '',
        num_jornadas: parseInt(orderData.metadata?.num_jornadas || '1'),
        company_rut: orderData.metadata?.company_rut || '',
        // Retirement details (if provided)
        order_retire_name: orderData.metadata?.order_retire_name || '',
        order_retire_phone: orderData.metadata?.order_retire_phone || '',
        order_retire_rut: orderData.metadata?.order_retire_rut || '',
        order_comments: orderData.metadata?.order_comments || '',
        // Financial calculations
        calculated_subtotal: parseFloat(orderData.metadata?.calculated_subtotal || '0'),
        calculated_discount: parseFloat(orderData.metadata?.calculated_discount || '0'),
        calculated_iva: parseFloat(orderData.metadata?.calculated_iva || '0'),
        calculated_total: parseFloat(orderData.metadata?.calculated_total || '0'),
        shipping_total: parseFloat(orderData.metadata?.shipping_total || '0'),
        total: parseFloat(orderData.metadata?.calculated_total || '0'),
        // Items and related data
        line_items: orderData.line_items || [],
        coupon_lines: orderData.coupon_lines || [],
        tax_lines: [],
        shipping_lines: [],
        fee_lines: [],
        // Order management
        correo_enviado: false,
        pago_completo: false,
        is_editable: true,
        needs_payment: true,
        needs_processing: true,
        created_via: 'external-frontend',
        customer_note: orderData.metadata?.order_comments || ''
      };

      const { data: newOrder, error: insertError } = await supabase
        .from('orders')
        .insert(supabaseOrderData)
        .select()
        .single();

      if (insertError) {
        console.error('❌ Error creating order:', insertError);
        return new Response(JSON.stringify({
          success: false,
          message: 'Error al crear orden en base de datos',
          error: insertError.message
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        });
      }

      console.log('✅ Order created successfully in database');
      existingOrder = newOrder;
    } else {
      console.log('✅ Order already exists in database');
    }

    // Generate PDF using direct internal API call (avoiding orderPdfGenerationService fetch issues)
    console.log('📄 Generating budget PDF using direct internal API call...');
    
    const baseUrl = new URL(request.url).origin;
    const internalApiUrl = `${baseUrl}/api/order/generate-budget-pdf`;
    
    console.log('🔗 Calling internal PDF API:', internalApiUrl);
    
    // Make direct internal call to the PDF generation API
    const pdfResponse = await fetch(internalApiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Internal-Request': 'true',
        'X-External-Source': 'frontend'
      },
      body: JSON.stringify({
        order_id: orderData.order_id,
        customer_id: existingOrder.customer_id,
        billing_email: orderData.billing?.email,
        project_name: orderData.metadata?.order_proyecto || `Orden ${orderData.order_id}`,
        uploadToR2,
        sendEmail
      })
    });

    if (!pdfResponse.ok) {
      const errorText = await pdfResponse.text();
      console.error('❌ Internal PDF API failed:', pdfResponse.status, errorText);
      return new Response(JSON.stringify({
        success: false,
        message: 'Error al generar PDF desde API interna',
        error: `Internal API error: ${pdfResponse.status} ${errorText}`
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    const pdfResult = await pdfResponse.json();

    if (!pdfResult.success) {
      console.error('❌ Backend PDF generation failed:', pdfResult.error);
      return new Response(JSON.stringify({
        success: false,
        message: pdfResult.message || 'Error al generar PDF de presupuesto',
        error: pdfResult.error
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log('✅ External budget PDF generation completed successfully');

    // Return success response with CORS headers
    return new Response(JSON.stringify({
      success: true,
      message: 'Presupuesto PDF generado exitosamente desde backend',
      pdf_url: pdfResult.pdfUrl,
      pdfUrl: pdfResult.pdfUrl,
      budgetUrl: pdfResult.pdfUrl, // For compatibility with frontend
      metadata: {
        ...pdfResult.metadata,
        generated_via: 'external-backend',
        frontend_source: 'vps-hostinger',
        backend_service: 'vercel'
      }
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Error in external budget PDF generation API:', error);
    
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, x-frontend-source',
    };
    
    return new Response(JSON.stringify({
      success: false,
      message: 'Error interno del servidor backend',
      error: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
};

// Handle preflight OPTIONS requests for CORS
export const OPTIONS: APIRoute = async ({ request }) => {
  const allowedOrigins = [
    'http://localhost:4321', // Frontend development server
    'http://localhost:3000', // Alternative frontend port
    import.meta.env.PUBLIC_FRONTEND_URL || 'http://localhost:4321'
  ].filter(Boolean);
  
  const origin = request.headers.get('Origin');
  
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': allowedOrigins.includes(origin || '') ? origin : allowedOrigins[0],
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key, x-frontend-source, Accept',
      'Access-Control-Allow-Credentials': 'true',
      'Access-Control-Max-Age': '86400',
    }
  });
};
