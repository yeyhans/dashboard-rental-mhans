// Order PDF Generation Service
// Similar to budgetGenerationService but for processing orders

export interface OrderPdfData {
  // Core order fields
  id?: number;
  order_id?: number;
  status: string;
  currency?: string;
  date_created?: string;
  date_modified?: string;
  date_completed?: string;
  date_paid?: string;
  customer_id: string;
  
  // Calculated totals
  calculated_subtotal?: string;
  calculated_discount?: string;
  calculated_iva?: string;
  calculated_total?: string;
  shipping_total?: string;
  cart_tax?: string;
  total?: string;
  total_tax?: string;
  
  // Billing information (flattened for compatibility)
  billing_first_name?: string;
  billing_last_name?: string;
  billing_company?: string;
  billing_address_1?: string;
  billing_city?: string;
  billing_email?: string;
  billing_phone?: string;
  
  // Billing object (nested for compatibility)
  billing?: {
    first_name: string;
    last_name: string;
    company?: string;
    address_1: string;
    city: string;
    email: string;
    phone: string;
  };
  
  // Project metadata (flattened for compatibility)
  order_proyecto?: string;
  order_fecha_inicio?: string;
  order_fecha_termino?: string;
  num_jornadas?: string;
  company_rut?: string;
  order_retire_name?: string;
  order_retire_phone?: string;
  order_retire_rut?: string;
  order_comments?: string;
  
  // Metadata object (nested for compatibility)
  metadata?: {
    order_proyecto: string;
    order_fecha_inicio: string;
    order_fecha_termino: string;
    num_jornadas: string;
    company_rut: string;
    calculated_subtotal: string;
    calculated_discount: string;
    calculated_iva: string;
    calculated_total: string;
    order_retire_name?: string;
    order_retire_phone?: string;
    order_retire_rut?: string;
    order_comments?: string;
  };
  
  // Line items
  line_items: Array<{
    product_id: string;
    quantity: number;
    sku: string;
    price: string;
    name: string;
    image?: string;
  }>;
  
  // Payment information
  payment_method?: string;
  payment_method_title?: string;
  transaction_id?: string;
  order_key?: string;
  customer_ip_address?: string;
  customer_user_agent?: string;
  created_via?: string;
  customer_note?: string;
  
  // Status flags
  correo_enviado?: boolean;
  pago_completo?: boolean;
  is_editable?: boolean;
  needs_payment?: boolean;
  needs_processing?: boolean;
  
  // Additional data
  fotos_garantia?: string[];
  orden_compra?: string;
  numero_factura?: string;
  new_pdf_on_hold_url?: string;
  new_pdf_processing_url?: string;
  
  // Coupons and discounts
  coupon_code?: string;
  coupon_lines?: Array<{
    code: string;
    discount: string;
    discount_type: string;
    metadata: {
      coupon_amount: string;
      coupon_id: string;
    };
  }>;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

export interface OrderPdfResult {
  success: boolean;
  message: string;
  pdfUrl?: string;
  pdf_url?: string;
  error?: string;
  debug?: any;
  metadata?: {
    order_id?: number;
    pages?: number;
    hasLineItems?: boolean;
    hasCoupon?: boolean;
    pdfType?: string;
    generatedAt?: string;
    projectName?: string;
    totalAmount?: string;
    numJornadas?: string;
  };
}

/**
 * Generate order processing PDF with order data using backend PDF generation
 * This follows the same pattern as budget PDF but for processing orders
 */
export const generateOrderProcessingPdf = async (
  orderData: OrderPdfData,
  uploadToR2: boolean = true,
  sendEmail: boolean = false
): Promise<OrderPdfResult> => {
  try {
    console.log('🚀 Starting backend order processing PDF generation for order:', orderData.order_id || orderData.id);
    console.log('📋 Order data received:', {
      order_id: orderData.order_id || orderData.id,
      customer_id: orderData.customer_id,
      billing_name: `${orderData.billing?.first_name || orderData.billing_first_name || ''} ${orderData.billing?.last_name || orderData.billing_last_name || ''}`,
      billing_email: orderData.billing?.email || orderData.billing_email,
      project_name: orderData.metadata?.order_proyecto || orderData.order_proyecto,
      total: orderData.metadata?.calculated_total || orderData.calculated_total,
      line_items_count: orderData.line_items?.length || 0
    });
    
    // Validate required fields with fallbacks
    const orderId = orderData.order_id || orderData.id;
    const billingEmail = orderData.billing?.email || orderData.billing_email;
    
    if (!orderId || !orderData.customer_id || !billingEmail) {
      console.error('❌ Missing required fields:', {
        order_id: orderId,
        customer_id: orderData.customer_id,
        billing_email: billingEmail
      });
      
      return {
        success: false,
        message: 'Campos requeridos faltantes: order_id, customer_id, billing.email'
      };
    }

    // Generate PDF using backend API
    console.log('📄 Generating order processing PDF using backend API...');
    console.log('📋 Order data being sent to API:', {
      order_id: orderData.order_id || orderData.id,
      customer_id: orderData.customer_id,
      billing_email: orderData.billing?.email || orderData.billing_email,
      project_name: orderData.metadata?.order_proyecto || orderData.order_proyecto,
      total: orderData.metadata?.calculated_total || orderData.calculated_total
    });
    
    // Use relative URL since we're in the same backend
    const response = await fetch('/api/order/generate-processing-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        orderData: orderData,
        uploadToR2: uploadToR2,
        sendEmail: sendEmail
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Backend order processing PDF generation failed:', errorText);
      return {
        success: false,
        message: 'Error al generar el PDF de procesamiento',
        error: errorText
      };
    }

    const result = await response.json();
    console.log('📥 Backend order processing PDF generation result:', result);

    if (!result.success) {
      console.error('❌ Backend order processing PDF generation failed:', result.message);
      return {
        success: false,
        message: result.message || 'Error al generar el PDF de procesamiento',
        error: result.error
      };
    }

    const pdfUrl = result.pdf_url || result.pdfUrl;
    console.log('🔗 Backend order processing PDF URL generated:', pdfUrl);

    if (!pdfUrl) {
      console.error('❌ No PDF URL found in response');
      return {
        success: false,
        message: 'No se pudo obtener la URL del PDF generado',
        error: 'Missing pdfUrl in response',
        debug: result
      };
    }

    console.log('✅ Backend order processing PDF generated successfully');
    
    return {
      success: true,
      message: 'PDF de procesamiento generado exitosamente',
      pdfUrl: pdfUrl,
      pdf_url: pdfUrl,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('💥 Error in backend generateOrderProcessingPdf:', error);
    return {
      success: false,
      message: 'Error interno al generar el PDF de procesamiento',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Generate order processing PDF from order ID
 * Fetches order data from database and generates processing PDF
 */
export const generateOrderProcessingPdfFromId = async (
  orderId: number,
  uploadToR2: boolean = true,
  sendEmail: boolean = false
): Promise<OrderPdfResult> => {
  try {
    console.log('🔍 Fetching order data for processing PDF generation, orderId:', orderId);
    
    // Fetch order data from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (error || !order) {
      console.error('❌ Error fetching order data:', error);
      return {
        success: false,
        message: 'Orden no encontrada',
        error: error?.message || 'Order not found'
      };
    }
    
    console.log('✅ Order data fetched successfully');
    
    // Convert order data to OrderPdfData format
    const orderPdfData: OrderPdfData = {
      order_id: order.id,
      customer_id: order.customer_id,
      status: order.status,
      billing: order.billing || {},
      metadata: order.metadata || {},
      line_items: order.line_items || [],
      coupon_code: order.coupon_code,
      coupon_lines: order.coupon_lines || [],
      created_at: order.created_at,
      updated_at: order.updated_at,
      // Include all order fields
      billing_first_name: order.billing_first_name,
      billing_last_name: order.billing_last_name,
      billing_company: order.billing_company,
      billing_email: order.billing_email,
      billing_phone: order.billing_phone,
      billing_address_1: order.billing_address_1,
      billing_city: order.billing_city,
      order_proyecto: order.order_proyecto,
      order_fecha_inicio: order.order_fecha_inicio,
      order_fecha_termino: order.order_fecha_termino,
      num_jornadas: order.num_jornadas?.toString(),
      company_rut: order.company_rut,
      calculated_subtotal: order.calculated_subtotal?.toString(),
      calculated_discount: order.calculated_discount?.toString(),
      calculated_iva: order.calculated_iva?.toString(),
      calculated_total: order.calculated_total?.toString(),
      shipping_total: order.shipping_total?.toString()
    };
    
    // Generate processing PDF
    return await generateOrderProcessingPdf(orderPdfData, uploadToR2, sendEmail);
    
  } catch (error) {
    console.error('💥 Error in generateOrderProcessingPdfFromId:', error);
    return {
      success: false,
      message: 'Error interno al obtener datos de la orden',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Generate budget PDF from order ID
 * Fetches order data from database and generates budget PDF
 */
export const generateBudgetPdfFromId = async (
  orderId: number,
  uploadToR2: boolean = true,
  sendEmail: boolean = false
): Promise<OrderPdfResult> => {
  try {
    console.log('🔍 Fetching order data for budget PDF generation, orderId:', orderId);
    
    // Fetch order data from Supabase
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { data: order, error } = await supabase
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();
    
    if (error || !order) {
      console.error('❌ Error fetching order data:', error);
      return {
        success: false,
        message: 'Orden no encontrada',
        error: error?.message || 'Order not found'
      };
    }

    console.log('✅ Order data fetched successfully for budget PDF');

    // Call the budget PDF generation API
    const response = await fetch('/api/order/generate-budget-pdf', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        order_id: orderId,
        customer_id: order.customer_id,
        billing_email: order.billing?.email || order.billing_email,
        project_name: order.metadata?.order_proyecto || order.order_proyecto || `Orden ${orderId}`,
        uploadToR2,
        sendEmail
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('❌ Budget PDF API error:', errorData);
      return {
        success: false,
        message: errorData.message || 'Error al generar presupuesto',
        error: errorData.error || 'API request failed'
      };
    }

    const result = await response.json();
    console.log('✅ Budget PDF generated successfully');
    
    return {
      success: true,
      message: result.message || 'Presupuesto generado exitosamente',
      pdfUrl: result.pdfUrl || result.pdf_url,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('💥 Error in generateBudgetPdfFromId:', error);
    return {
      success: false,
      message: 'Error interno al obtener datos de la orden',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};
