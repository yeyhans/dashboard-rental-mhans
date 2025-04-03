export type LineItem = {
  id?: number;
  name: string;
  product_id: number | string;
  sku: string;
  price: string;
  quantity: number;
  image?: string;
};

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
};

export type Order = {
  id: number;
  status: string;
  date_created: string;
  date_modified: string;
  customer_id: number;
  billing: Billing;
  metadata: Metadata;
  line_items: LineItem[];
}; 