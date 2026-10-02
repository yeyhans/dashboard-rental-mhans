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
  /** e.g. "Reserva 30%" or "Reserva" for a fixed amount (src/lib/pricing.ts reserveLabel). */
  reserveLabel?: string;
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

// Legacy order-shaped data still used by the contract PDF (generate-contract-pdf)
export interface OrderPdfData {
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

// Budget PDF (redesign "MarioHans OS"): everything the template prints, already formatted for display
// where the template shows text (dates are DD-MM-AAAA), raw numbers (CLP) where it shows money.
export interface BudgetClientInfo {
  name: string;
  email: string;
  rut: string;
  /** "Productora" line (billing company); hidden when empty. */
  company: string;
  phone: string;
}

export interface BudgetReservationInfo {
  /** Project name (order_proyecto). */
  title: string;
  startDate: string;
  endDate: string;
  /** Who picks the equipment up: order_retire_name or "El cliente". */
  retireLabel: string;
  /** End date + 1 day, DD-MM-AAAA. */
  returnDate: string;
}

export interface BudgetDiscountInfo {
  /** Net CLP discount; the row is hidden when <= 0. */
  amount: number;
  /** Percentage when the coupon is percent-typed. */
  pct?: number;
  /** "Descuento 10%" or "Descuento". */
  label: string;
}

export interface BudgetShippingInfo {
  label: string;
  /** Net CLP; the row is hidden when <= 0. */
  total: number;
}

export interface BudgetTotals {
  productsNet: number;
  subtotal: number;
  iva: number;
  total: number;
  reserve: number;
  reserveLabel: string;
  balance: number;
}

export interface BudgetDocumentData {
  orderId: number;
  /** DD-MM-AAAA */
  issueDate: string;
  client: BudgetClientInfo;
  reservation: BudgetReservationInfo;
  note: string;
  numJornadas: number;
  lineItems: LineItem[];
  discount: BudgetDiscountInfo;
  shipping: BudgetShippingInfo;
  totals: BudgetTotals;
}
