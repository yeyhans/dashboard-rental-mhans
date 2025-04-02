export interface Order {
  id: number;
  status: string;
  total: string;
  date_created: string;
  customer: {
    id: number;
    email: string;
  };
  line_items: Array<{
    product_id: number;
    quantity: number;
  }>;
} 