// Shared TypeScript interfaces for PDF generation

export interface BillingInfo {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  company?: string;
  address?: string;
  city?: string;
  rut?: string;
}

export interface ProjectInfo {
  name: string;
  startDate: string;
  endDate: string;
  numJornadas: number;
  companyRut?: string;
  retireName?: string;
  retirePhone?: string;
  retireRut?: string;
  comments?: string;
}

export interface LineItem {
  name: string;
  sku?: string;
  price: number;
  quantity: number;
}

export interface TotalsInfo {
  subtotal: number;
  discount: number;
  iva: number;
  total: number;
  reserve: number;
}

export interface ShippingInfo {
  method: string;
  total: number;
  deliveryMethod?: 'pickup' | 'shipping';
  shippingAddress?: string;
  shippingPhone?: string;
}

export interface CouponInfo {
  code: string;
  discount: number;
}

// Budget PDF specific
export interface BudgetDocumentData {
  orderId: number;
  billing: BillingInfo;
  project: ProjectInfo;
  lineItems: LineItem[];
  totals: TotalsInfo;
  couponCode?: string;
  status: string;
  shippingInfo?: ShippingInfo;
  userSignatureUrl?: string; // For contract PDF
}

// Contract PDF specific
export interface ContractDocumentData {
  userId: number;
  nombre: string;
  apellido: string;
  email: string;
  rut: string;
  telefono?: string;
  direccion?: string;
  ciudad?: string;
  tipoCliente: string;
  empresaNombre?: string;
  empresaRut?: string;
}

// Processing PDF specific
export interface ProcessingDocumentData {
  orderId: number;
  customerName: string;
  customerEmail: string;
  customerRut: string;
  customerCompany: string;
  customerPhone: string;
  projectName: string;
  startDate: string;
  endDate: string;
  numJornadas: number;
  companyRut: string;
  retireName: string;
  comments: string;
  lineItems: LineItem[];
  totals: TotalsInfo;
  hasCoupon: boolean;
  hasShipping: boolean;
  shippingInfo?: ShippingInfo;
  couponCode?: string;
}
