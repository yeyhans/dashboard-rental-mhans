import React from "react";
import type {
  BudgetDocumentData,
  LineItem,
  ProcessingDocumentData,
  ProcessingSignerInfo,
} from "../core/types";
import { DEFAULT_SETTINGS, type SiteSettings } from "../../siteSettings";
import {
  joinPickupAddresses,
  pdfBank,
  pdfLandlord,
  pdfPolicies,
} from "../mappers/settingsData";
import { generatePdfBuffer } from "../core/pdfService";
import { orderBreakdown } from "../../orderBreakdown";
import { reserveAmount } from "../../finance";
import { reserveLabel } from "../../pricing";

interface BuildOptions {
  orderId: number;
  items: LineItem[];
  jornadas: number;
  discountPct?: number;
  shipping?: number;
  note?: string;
  company?: string;
  retire?: string;
  title?: string;
  clientName?: string;
}

/** Builds a self-consistent BudgetDocumentData the same way the stored calculated_* would be. */
function build(options: BuildOptions): BudgetDocumentData {
  const gross = options.items.reduce(
    (sum, item) => sum + item.price * item.quantity * options.jornadas,
    0,
  );
  const discountAmount = options.discountPct
    ? Math.round((gross * options.discountPct) / 100)
    : 0;
  const shipping = options.shipping ?? 0;
  const subtotal = gross - discountAmount + shipping;
  const iva = Math.round(subtotal * 0.19);
  const total = subtotal + iva;
  const breakdown = orderBreakdown({
    lineItems: options.items,
    jornadas: options.jornadas,
    discount: discountAmount,
    shippingTotal: shipping,
    calculatedSubtotal: subtotal,
    calculatedIva: iva,
  });
  const reserve = reserveAmount({
    total,
    reserveType: "percent",
    reserveValue: 25,
  });

  return {
    orderId: options.orderId,
    issueDate: "16-05-2026",
    client: {
      name: options.clientName ?? "Camila Fernanda Rojas Valdivia",
      email: "camila.rojas@productora.cl",
      rut: "12.345.678-5",
      company: options.company ?? "",
      phone: "+56 9 8765 4321",
    },
    reservation: {
      title: options.title ?? "Spot Publicitario Marca X",
      startDate: "01-02-2026",
      endDate: "02-02-2026",
      retireLabel: options.retire ?? "El cliente",
      returnDate: "03-02-2026",
    },
    note: options.note ?? "",
    numJornadas: options.jornadas,
    lineItems: options.items,
    discount: {
      amount: discountAmount,
      ...(options.discountPct ? { pct: options.discountPct } : {}),
      label: options.discountPct
        ? `Descuento ${options.discountPct}%`
        : "Descuento",
    },
    shipping: { label: "Móvil rental", total: shipping },
    totals: {
      productsNet: breakdown.products.net,
      subtotal,
      iva,
      total,
      reserve,
      reserveLabel: reserveLabel("percent", 25),
      balance: total - reserve,
    },
    bank: pdfBank(DEFAULT_SETTINGS),
    policies: pdfPolicies(DEFAULT_SETTINGS),
  };
}

const LONG_NAMES = [
  "Profoto B10X Plus OCF Kit con Honeycomb beauty dish y bolso de transporte",
  "Sony FX6 Full-Frame Cinema Line con lente 24-70mm f/2.8 GM II",
  "Aputure LS 600d Pro Light Storm con controlador y trípode de ruedas",
  "DJI RS 3 Pro Combo estabilizador de cámara con sistema de seguimiento",
  "Sigma 18-35mm f/1.8 DC HSM Art montura Canon EF",
  "Manfrotto 504X Cabezal fluido con trípode de fibra de carbono 546GB",
  "Atomos Ninja V+ monitor grabador 5.2 pulgadas 8K HDR",
  "Zhiyun Crane 3S estabilizador profesional para cámaras de cine",
  "Godox AD600 Pro kit completo con softbox octagonal 120 cm",
  "Tilta Nucleus-M sistema inalámbrico de control de enfoque",
  "Rode NTG5 micrófono shotgun con Blimp y pértiga telescópica",
  "Canon EF 70-200mm f/2.8L IS III USM lente zoom telefoto",
  "SmallHD Cine 7 monitor de campo 1800 nits con baterías V-mount",
  "Kino Flo Diva-Lite 4 con estructura y difusores completos",
  "Teradek Bolt 4K 750 LT kit de transmisión inalámbrica de video",
  "Aputure Light Dome II con grid y adaptador Bowens para luces COB",
  "Sennheiser MKH 416 micrófono de cañón con cable XLR de 10 metros",
  "Libec RT50B trípode con spreader de piso y cabezal fluido",
];

export const shortOrder = build({
  orderId: 420,
  jornadas: 2,
  note: "Retiro con productor de línea. Confirmar horario por WhatsApp.",
  items: [
    { name: "Sony A7 IV cuerpo", sku: "A7IV", price: 45000, quantity: 1 },
    {
      name: "Sigma 24-70mm f/2.8 DG DN Art",
      sku: "S2470",
      price: 22000,
      quantity: 2,
    },
  ],
});

export const longNamedOrder = build({
  orderId: 1187,
  jornadas: 3,
  discountPct: 10,
  shipping: 25000,
  note: "Rodaje en locación. Incluye entrega y retiro en Providencia, coordinar acceso con seguridad del edificio.",
  retire: "Matías Alejandro Soto Pérez",
  title: "Campaña Verano 2026 - Spot institucional Grupo Andes",
  items: LONG_NAMES.map((name, index) => ({
    name,
    sku: `SKU-${index + 1}`,
    price: 12000 + index * 3500,
    quantity: (index % 3) + 1,
  })),
});

export const plainOrder = build({
  orderId: 52,
  jornadas: 1,
  items: [{ name: "Profoto Honeycomb beauty dish", price: 18000, quantity: 1 }],
});

export const companyOrder = build({
  orderId: 903,
  jornadas: 4,
  discountPct: 15,
  company: "Productora Los Andes SpA",
  clientName: "Francisca Antonia Ibarra Contreras",
  note: "Factura a nombre de la productora.",
  items: [
    { name: "ARRI SkyPanel S60-C", sku: "SP60", price: 60000, quantity: 2 },
    {
      name: "Easyrig Vario 5 con Serene",
      sku: "EZR",
      price: 30000,
      quantity: 1,
    },
  ],
});

export const budgetFixtures: Record<string, BudgetDocumentData> = {
  short: shortOrder,
  longNamed: longNamedOrder,
  plain: plainOrder,
  company: companyOrder,
};

/** Wraps a budget fixture with the annex facts and signer the processing document prints. */
function toProcessing(
  budget: BudgetDocumentData,
  signer: ProcessingSignerInfo,
): ProcessingDocumentData {
  return {
    ...budget,
    landlord: pdfLandlord(DEFAULT_SETTINGS),
    annex: {
      startDate: budget.reservation.startDate,
      endDate: budget.reservation.endDate,
      deliveryDate: "31-01-2026",
      totalNet: budget.totals.subtotal,
      reservePct: 25,
      reserveLabel: budget.totals.reserveLabel,
      pickupAddress: joinPickupAddresses(DEFAULT_SETTINGS.pickupAddresses),
    },
    signer,
  };
}

/** Short order: the annex starts mid first page. */
export const processingNatural = toProcessing(shortOrder, {
  name: shortOrder.client.name,
  rut: shortOrder.client.rut,
});

/** Empresa client: the signature block adds company name and RUT. */
export const processingEmpresa = toProcessing(companyOrder, {
  name: companyOrder.client.name,
  rut: "13.456.789-0",
  company: "Productora Los Andes SpA",
  companyRut: "76.543.210-K",
});

/** 18 items with discount and shipping: the annex starts mid-page and spans pages. */
export const processingLong = toProcessing(longNamedOrder, {
  name: longNamedOrder.client.name,
  rut: longNamedOrder.client.rut,
});

export const processingFixtures: Record<string, ProcessingDocumentData> = {
  natural: processingNatural,
  empresa: processingEmpresa,
  long: processingLong,
};

/** Renders any react-pdf document element to a PDF buffer through the production helper. */
export function renderToBufferForTest(
  document: React.ReactElement,
): Promise<Buffer> {
  return generatePdfBuffer({ document });
}

/**
 * Walks a react element tree, expanding function components, and returns every string/number
 * child. Lets tests assert on the copy a document prints without parsing the compressed PDF.
 */
export function collectText(node: unknown): string[] {
  if (node === null || node === undefined || typeof node === "boolean")
    return [];
  if (typeof node === "string" || typeof node === "number")
    return [String(node)];
  if (Array.isArray(node)) return node.flatMap(collectText);
  if (typeof node === "object" && "type" in (node as object)) {
    const element = node as { type: unknown; props: Record<string, unknown> };
    if (typeof element.type === "function") {
      return collectText(
        (element.type as (props: unknown) => unknown)(element.props),
      );
    }
    if (
      typeof element.type === "object" &&
      element.type !== null &&
      "render" in element.type
    ) {
      return collectText(
        (element.type as { render: (p: unknown) => unknown }).render(
          element.props,
        ),
      );
    }
    return collectText(element.props?.children);
  }
  return [];
}

// Contract fixtures (redesign "MarioHans OS").
import type { UserContractDocumentData } from "../core/types";
import { getLogoSource } from "../core/fonts";
import { buildUserContractData } from "../mappers/contractData";

/** Offline stand-in for a client signature image (the bundled logo as a data URI). */
function signatureDataUri(): string {
  return `data:image/png;base64,${getLogoSource().data.toString("base64")}`;
}

const contractNow = new Date("2026-10-02T15:00:00Z");

export const contractNatural: UserContractDocumentData = buildUserContractData(
  {
    user_id: 1,
    nombre: "Camila Fernanda",
    apellido: "Rojas Valdivia",
    email: "camila.rojas@productora.cl",
    rut: "12.345.678-5",
    direccion: "Av. Providencia 1234, depto 56",
    ciudad: "Providencia",
    tipo_cliente: "natural",
    url_firma: signatureDataUri(),
  },
  contractNow,
);

export const contractEmpresa: UserContractDocumentData = buildUserContractData(
  {
    user_id: 2,
    nombre: "Camila Fernanda",
    apellido: "Rojas Valdivia",
    email: "camila.rojas@productora.cl",
    rut: "12.345.678-5",
    direccion: "Av. Providencia 1234",
    ciudad: "Providencia",
    tipo_cliente: "empresa",
    empresa_nombre: "Productora Los Andes SpA",
    empresa_rut: "76.543.210-K",
    empresa_direccion: "Los Leones 99, oficina 402",
    empresa_ciudad: "Providencia",
  },
  contractNow,
);

export const contractFixtures: Record<string, UserContractDocumentData> = {
  natural: contractNatural,
  empresa: contractEmpresa,
};

// Settings override: every value the settings page manages differs from the defaults.
import { buildBudgetDocumentData } from "../mappers/budgetData";
import { buildProcessingDocumentData } from "../mappers/processingData";

export const settingsOverride: SiteSettings = {
  company: {
    ...DEFAULT_SETTINGS.company,
    legalName: "Luz y Cámara Rental SpA",
    rut: "76.111.222-3",
  },
  representative: {
    name: "Valentina Paz Orrego Díaz",
    cedula: "15.222.333-4",
    domicilio: "Av. Italia 1500, Ñuñoa",
    signatureUrl: signatureDataUri(),
    signatureUpdatedAt: "",
  },
  bank: {
    holder: "Luz y Cámara Rental SpA",
    rut: "76.111.222-3",
    bankName: "Banco Estado",
    accountType: "Cuenta Vista",
    accountNumber: "99887766",
    email: "pagos@luzcamara.cl",
  },
  contact: {
    ...DEFAULT_SETTINGS.contact,
    email: "hola@luzcamara.cl",
    adminNotificationEmail: "admin@luzcamara.cl",
    website: "https://luzcamara.cl",
  },
  pickupAddresses: ["Av. Italia 1500, Ñuñoa", "Los Leones 300, Providencia"],
  reserve: { defaultPct: 30 },
  policies: {
    ...DEFAULT_SETTINGS.policies,
    acceptance:
      "Con el abono de {reserva} aceptas las condiciones de Luz y Cámara.",
    footer: "Retiro y devolución según lo coordinado con Luz y Cámara Rental.",
  },
};

/** Order without reserve configuration, so the settings default reserve applies. */
const overrideOrder = {
  id: 777,
  billing: {
    first_name: "Camila",
    last_name: "Rojas",
    email: "camila.rojas@productora.cl",
  },
  line_items: [{ name: "Sony A7 IV cuerpo", price: 45000, quantity: 1 }],
  metadata: {
    num_jornadas: 2,
    order_fecha_inicio: "2026-02-01",
    order_fecha_termino: "2026-02-02",
    calculated_subtotal: 90000,
    calculated_iva: 17100,
    calculated_total: 107100,
  },
};

const overrideNow = new Date("2026-05-16T15:00:00Z");

export const budgetOverride: BudgetDocumentData = buildBudgetDocumentData(
  overrideOrder,
  null,
  overrideNow,
  settingsOverride,
);
export const processingOverride: ProcessingDocumentData =
  buildProcessingDocumentData(
    overrideOrder,
    null,
    overrideNow,
    settingsOverride,
  );
export const contractOverride: UserContractDocumentData = buildUserContractData(
  {
    user_id: 3,
    nombre: "Camila Fernanda",
    apellido: "Rojas Valdivia",
    email: "camila.rojas@productora.cl",
    rut: "12.345.678-5",
    direccion: "Av. Providencia 1234",
    ciudad: "Providencia",
    tipo_cliente: "natural",
  },
  contractNow,
  settingsOverride,
);

/** Strings of the default settings that must never appear in an override document. */
export const DEFAULT_ONLY_STRINGS = [
  "8140915407",
  "Banco de Chile",
  "Mario Alberto Hans Salinas",
  "16.135.586-0",
  "Purísima 25",
  "Bellavista 77",
  "rental.mariohans@gmail.com",
];
