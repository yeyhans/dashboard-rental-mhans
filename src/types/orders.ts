export interface OrderBilling {
  first_name: string;
  last_name: string;
  company: string;
  email: string;
  phone: string;
}

export interface MetadataItem {
  id: number;
  key: string;
  value: string;
}

export interface Order {
  id: number;
  number: string;
  status: string;
  date_created: string;
  date_completed?: string | null;
  date_paid?: string | null;
  total: string;
  billing: OrderBilling;
  currency_symbol: string;
  line_items: OrderLineItem[];
  meta_data?: MetadataItem[];
}

export interface OrderLineItem {
  id: number;
  name: string;
  product_id: number;
  variation_id: number;
  quantity: number;
  total: string;
  price: number;
  sku: string;
}

export interface ChartDataPoint {
  date: string;
  total: number;
  count: number;
}

export interface OrderStatusStat {
  name: string;
  value: number;
  color: string;
}

export interface ApiResponse {
  success: boolean;
  message: string;
  data: {
    orders: Order[];
    total: string;
    totalPages: string;
    validStatuses: string[];
  };
} 