import { sendBudgetGeneratedEmail, type BudgetEmailData } from './emailService';

// Complete Order/Budget Data Interface with all required columns
interface BudgetData {
  // Core order fields
  id?: number;
  order_id?: number; // For backward compatibility
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
  
  // Tax and shipping lines
  tax_lines?: Array<{
    id?: number;
    rate_code?: string;
    rate_id?: number;
    label?: string;
    compound?: boolean;
    tax_total?: string;
    shipping_tax_total?: string;
  }>;
  shipping_lines?: Array<{
    id?: number;
    method_title?: string;
    method_id?: string;
    total?: string;
    total_tax?: string;
  }>;
  fee_lines?: Array<{
    id?: number;
    name?: string;
    tax_class?: string;
    tax_status?: string;
    total?: string;
    total_tax?: string;
  }>;
  
  // Refunds
  refunds?: Array<{
    id?: number;
    reason?: string;
    total?: string;
    date_created?: string;
  }>;
  
  // Timestamps
  created_at?: string;
  updated_at?: string;
}

interface BudgetResult {
  success: boolean;
  message: string;
  budgetUrl?: string;
  pdf_url?: string;
  error?: string;
  debug?: any;
  metadata?: {
    order_id?: number;
    pages?: number;
    hasLineItems?: boolean;
    hasCoupon?: boolean;
    budgetType?: string;
    generatedAt?: string;
    projectName?: string;
    totalAmount?: string;
    numJornadas?: string;
  };
}

/**
 * Generate budget PDF with order data using backend PDF generation
 * This follows the same pattern as the frontend but uses backend infrastructure
 */
export const generateBudgetWithOrderData = async (
  orderData: BudgetData,
  uploadToR2: boolean = true,
  sendEmail: boolean = true
): Promise<BudgetResult> => {
  try {
    console.log('🚀 Starting backend budget PDF generation for order:', orderData.order_id || orderData.id);
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
    console.log('📄 Generating budget PDF using backend API...');
    console.log('📋 Budget data being sent to API:', {
      order_id: orderData.order_id || orderData.id,
      customer_id: orderData.customer_id,
      billing_email: orderData.billing?.email || orderData.billing_email,
      project_name: orderData.metadata?.order_proyecto || orderData.order_proyecto,
      total: orderData.metadata?.calculated_total || orderData.calculated_total
    });
    
    // Use relative URL since we're in the same backend
    const response = await fetch('/api/budget/generate-pdf', {
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
      console.error('❌ Backend budget PDF generation failed:', errorText);
      return {
        success: false,
        message: 'Error al generar el presupuesto PDF',
        error: errorText
      };
    }

    const result = await response.json();
    console.log('📥 Backend budget PDF generation result:', result);

    if (!result.success) {
      console.error('❌ Backend budget PDF generation failed:', result.message);
      return {
        success: false,
        message: result.message || 'Error al generar el presupuesto PDF',
        error: result.error
      };
    }

    const budgetUrl = result.pdf_url || result.budgetUrl;
    console.log('🔗 Backend budget PDF URL generated:', budgetUrl);

    if (!budgetUrl) {
      console.error('❌ No budget URL found in response');
      return {
        success: false,
        message: 'No se pudo obtener la URL del presupuesto generado',
        error: 'Missing budgetUrl in response',
        debug: result
      };
    }

    console.log('✅ Backend budget PDF generated successfully');
    
    // Optional: Send additional admin notification
    if (sendEmail && budgetUrl) {
      console.log('📧 Sending additional budget notifications...');
      try {
        // The API already sends the customer email, but we can send additional notifications here if needed
        console.log('✅ Budget notifications handled by API');
      } catch (emailError) {
        console.warn('⚠️ Additional email notifications failed (non-critical):', emailError);
      }
    }
    
    return {
      success: true,
      message: 'Presupuesto PDF generado exitosamente',
      budgetUrl: budgetUrl,
      pdf_url: budgetUrl,
      metadata: result.metadata
    };
    
  } catch (error) {
    console.error('💥 Error in backend generateBudgetWithOrderData:', error);
    return {
      success: false,
      message: 'Error interno al generar el presupuesto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Generate budget PDF from order ID
 * Fetches order data from database and generates budget PDF
 */
export const generateBudgetFromOrderId = async (
  orderId: number,
  uploadToR2: boolean = true,
  sendEmail: boolean = true
): Promise<BudgetResult> => {
  try {
    console.log('🔍 Fetching order data for budget generation, orderId:', orderId);
    
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
    
    // Convert order data to BudgetData format
    const budgetData: BudgetData = {
      order_id: order.id,
      customer_id: order.customer_id,
      status: order.status,
      billing: order.billing || {},
      metadata: order.metadata || {},
      line_items: order.line_items || [],
      coupon_code: order.coupon_code,
      coupon_lines: order.coupon_lines || [],
      created_at: order.created_at,
      updated_at: order.updated_at
    };
    
    // Generate budget PDF
    return await generateBudgetWithOrderData(budgetData, uploadToR2, sendEmail);
    
  } catch (error) {
    console.error('💥 Error in generateBudgetFromOrderId:', error);
    return {
      success: false,
      message: 'Error interno al obtener datos de la orden',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

/**
 * Check if order is eligible for budget generation
 * Validates order status and required data
 */
export const canGenerateBudget = async (orderId: number): Promise<{
  canGenerate: boolean;
  message: string;
  missingRequirements: string[];
}> => {
  try {
    console.log('🔍 Checking budget generation eligibility for order:', orderId);
    
    if (!orderId) {
      return {
        canGenerate: false,
        message: 'ID de orden requerido',
        missingRequirements: ['ID de orden válido']
      };
    }

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
      return {
        canGenerate: false,
        message: 'Orden no encontrada',
        missingRequirements: ['Orden válida']
      };
    }

    const missingRequirements: string[] = [];

    // Check order status - budget generation is typically for 'on-hold' status
    if (order.status !== 'on-hold') {
      missingRequirements.push(`Estado de orden debe ser 'En Espera' (actual: ${order.status})`);
    }

    // Check billing information
    if (!order.billing?.email) {
      missingRequirements.push('Email de facturación');
    }
    if (!order.billing?.first_name) {
      missingRequirements.push('Nombre del cliente');
    }
    if (!order.billing?.last_name) {
      missingRequirements.push('Apellido del cliente');
    }

    // Check metadata
    if (!order.metadata?.order_proyecto) {
      missingRequirements.push('Nombre del proyecto');
    }
    if (!order.metadata?.calculated_total) {
      missingRequirements.push('Total calculado');
    }

    // Check line items
    if (!order.line_items || order.line_items.length === 0) {
      missingRequirements.push('Productos en la orden');
    }

    const canGenerate = missingRequirements.length === 0;

    console.log('📋 Budget generation eligibility result:', {
      canGenerate,
      orderId,
      status: order.status,
      missingRequirements
    });

    return {
      canGenerate,
      message: canGenerate 
        ? 'Orden elegible para generar presupuesto' 
        : `Faltan requisitos: ${missingRequirements.join(', ')}`,
      missingRequirements
    };

  } catch (error) {
    console.error('Error checking budget generation eligibility:', error);
    return {
      canGenerate: false,
      message: 'Error al verificar elegibilidad para generar presupuesto',
      missingRequirements: ['Error de sistema']
    };
  }
};

/**
 * Update order status and trigger budget generation
 * This function can be called when an order moves to 'on-hold' status
 */
export const processOrderForBudget = async (
  orderId: number,
  newStatus: string = 'on-hold'
): Promise<{
  success: boolean;
  message: string;
  budgetUrl?: string;
  error?: string;
}> => {
  try {
    console.log('🔄 Processing order for budget generation:', { orderId, newStatus });
    
    // First, update the order status
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      import.meta.env.PUBLIC_SUPABASE_URL!,
      import.meta.env.SUPABASE_SERVICE_ROLE_KEY || import.meta.env.PUBLIC_SUPABASE_ANON_KEY!
    );
    
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);
    
    if (updateError) {
      console.error('❌ Failed to update order status:', updateError);
      return {
        success: false,
        message: 'Error al actualizar estado de la orden',
        error: updateError.message
      };
    }
    
    console.log('✅ Order status updated successfully');
    
    // Check if order is eligible for budget generation
    const eligibility = await canGenerateBudget(orderId);
    if (!eligibility.canGenerate) {
      return {
        success: false,
        message: `Orden no elegible para presupuesto: ${eligibility.message}`,
        error: eligibility.missingRequirements.join(', ')
      };
    }
    
    // Generate budget PDF
    const budgetResult = await generateBudgetFromOrderId(orderId, true, true);
    
    if (!budgetResult.success) {
      return {
        success: false,
        message: `Error al generar presupuesto: ${budgetResult.message}`,
        error: budgetResult.error
      };
    }
    
    return {
      success: true,
      message: 'Orden procesada y presupuesto generado exitosamente',
      budgetUrl: budgetResult.budgetUrl
    };
    
  } catch (error) {
    console.error('💥 Error in processOrderForBudget:', error);
    return {
      success: false,
      message: 'Error interno al procesar orden para presupuesto',
      error: error instanceof Error ? error.message : 'Error desconocido'
    };
  }
};

// Export types for use in other modules
export type { BudgetData, BudgetResult };
