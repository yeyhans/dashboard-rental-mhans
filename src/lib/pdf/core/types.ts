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
  deliveryMethod?: "pickup" | "shipping";
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

/** Transfer data printed in the budget and in contract clause QUINTA (from `SiteSettings.bank`). */
export interface PdfBankInfo {
  holder: string;
  rut: string;
  bankName: string;
  accountType: string;
  accountNumber: string;
  email: string;
}

/** The landlord (company + legal representative) as the signature blocks print it. */
export interface PdfLandlordInfo {
  /** Legal representative. */
  name: string;
  cedula: string;
  domicilio: string;
  /** Company legal name. */
  company: string;
  companyRut: string;
  /** Remote or data-URI image printed above the left-hand signature rule; "" when unset. */
  signatureUrl: string;
}

export interface PdfPolicies {
  /** Template with the `{reserva}` placeholder. */
  acceptance: string;
  footer: string;
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
  bank: PdfBankInfo;
  policies: PdfPolicies;
}

// Processing PDF (confirmed order): the budget sheet plus the contract annex and signatures.
export interface ProcessingAnnexInfo {
  /** DD-MM-AAAA */
  startDate: string;
  endDate: string;
  /** Start date minus 1 day, DD-MM-AAAA. */
  deliveryDate: string;
  /** Net CLP "valor total del arriendo" (calculated_subtotal), printed "+ IVA". */
  totalNet: number;
  /** Reserve percentage when the order reserve is percent-typed. */
  reservePct?: number;
  reserveLabel: string;
  pickupAddress: string;
}

export interface ProcessingSignerInfo {
  name: string;
  rut: string;
  /** Only for tipo_cliente = empresa. */
  company?: string;
  companyRut?: string;
}

export interface ProcessingDocumentData extends BudgetDocumentData {
  landlord: PdfLandlordInfo;
  annex: ProcessingAnnexInfo;
  signer: ProcessingSignerInfo;
}

// Contract PDF (redesign "MarioHans OS"): facts the contract text and the signature block print.
export interface ContractTenantInfo {
  /** Natural person, or the legal representative when the client is a company. */
  name: string;
  /** Personal cédula (RUT) of `name`. */
  rut: string;
  /** Already joined "street, city"; empresa fields first, personal fields as fallback. */
  address: string;
  email: string;
  /** Only for tipo_cliente = empresa. */
  company: string;
  companyRut: string;
}

export interface ContractSignerInfo {
  name: string;
  /** Full line, e.g. "Cédula de identidad nacional N° 12.345.678-5". */
  cedula: string;
  company?: string;
  /** Full line, e.g. "RUT N° 76.543.210-K". */
  companyRut?: string;
}

export interface UserContractDocumentData {
  userId: number;
  isCompany: boolean;
  /** Header subtitle: "persona jurídica" | "persona natural". */
  subtitle: string;
  /** "2 de octubre de 2026" */
  issueDateLong: string;
  tenant: ContractTenantInfo;
  signer: ContractSignerInfo;
  landlord: PdfLandlordInfo;
  bank: PdfBankInfo;
  /** Reserve percentage printed in clause QUINTA (site default). */
  reservePct: number;
  /** Landlord notification e-mail (clause DÉCIMO CUARTA). */
  landlordEmail: string;
  /** Site URL printed in the clauses. */
  website: string;
  /** Client signature image (remote URL), printed above the right-hand rule when present. */
  signatureImageUrl?: string;
}

/** @deprecated kept as an alias for existing imports. */
export type UserContractData = UserContractDocumentData;
