export type LineItem = {
  id?: number;
  name: string;
  product_id: number | string;
  sku: string;
  price: string;
  quantity: number;
  image?: string;
};

// Updated Order type to match database structure
export type Order = {
  // Primary fields
  id: number;
  status: string;
  currency: string;
  date_created: string;
  date_modified: string;
  date_completed?: string;
  date_paid?: string;
  customer_id: number;
  
  // Financial calculations
  calculated_subtotal: number;
  calculated_discount: number;
  calculated_iva: number;
  calculated_total: number;
  discount_total: number;
  shipping_total: number;
  cart_tax: number;
  total: number;
  total_tax: number;
  
  // Billing information (flattened from nested structure)
  billing_first_name: string;
  billing_last_name: string;
  billing_company: string;
  billing_address_1: string;
  billing_city: string;
  billing_email: string;
  billing_phone: string;
  
  // Project information
  order_proyecto: string;
  order_fecha_inicio: string;
  order_fecha_termino: string;
  num_jornadas: number;
  company_rut: string;
  
  // Retirement information
  order_retire_name: string;
  order_retire_phone: string;
  order_retire_rut: string;
  order_comments: string;
  
  // Line items and related data
  line_items: LineItem[];
  
  // Payment information
  payment_method: string;
  payment_method_title: string;
  transaction_id: string;
  order_key: string;
  customer_ip_address: string;
  customer_user_agent: string;
  created_via: string;
  customer_note: string;
  
  // Status flags
  correo_enviado: boolean;
  pago_completo: boolean;
  is_editable: boolean;
  needs_payment: boolean;
  needs_processing: boolean;
  
  // Document and media
  fotos_garantia: string[];
  orden_compra: string;
  numero_factura: string;
  new_pdf_on_hold_url: string;
  new_pdf_processing_url: string;
  
  // Additional data (JSON fields)
  tax_lines: any[];
  shipping_lines: any[];
  fee_lines: any[];
  coupon_lines: any[];
  refunds: any[];
};

// Legacy types for backward compatibility
export type Billing = {
  first_name: string;
  last_name: string;
  company: string;
  address_1: string;
  city: string;
  email: string;
  phone: string;
};

export type Metadata = {
  order_fecha_inicio: string;
  order_fecha_termino: string;
  num_jornadas: string;
  calculated_subtotal: string;
  calculated_discount: string;
  calculated_iva: string;
  calculated_total: string;
  company_rut: string;
  order_proyecto: string;
  pdf_on_hold_url: string;
  pdf_processing_url: string;
  order_retire_name: string;
  order_retire_rut: string;
  order_retire_phone: string;
  order_comments: string;
};