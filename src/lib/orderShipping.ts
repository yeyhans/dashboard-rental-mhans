// Browser-safe shipping helpers for the order editor (T-05).
// The order editor must not import ShippingService: that module carries the service-role
// client and its queries end up in the browser bundle. Reads go through /api/shipping/methods,
// which requires an admin session.

export interface ShippingMethod {
  id: number;
  name: string;
  description: string | null;
  cost: string; // Decimal stored as string in database
  shipping_type:
    | "free"
    | "flat_rate"
    | "local_pickup"
    | "calculated"
    | "express";
  enabled: boolean;
  min_amount: string | null; // Decimal stored as string
  max_amount: string | null; // Decimal stored as string
  available_regions?: any | null;
  excluded_regions?: any | null;
  estimated_days_min: string; // Stored as string in database
  estimated_days_max: string; // Stored as string in database
  requires_address: boolean;
  requires_phone: boolean;
  metadata: any;
  created_at: string;
  updated_at: string;
  created_by: string | null;
}

export interface ShippingAddress {
  first_name: string;
  last_name: string;
  address_1: string;
  city: string;
  phone: string;
}

export interface ShippingLine {
  id: string | number;
  method_id: string | number;
  method_title: string;
  method_type: string;
  total: string;
  taxes: any[];
  meta_data: {
    estimated_delivery: string;
    tracking_number: string | null;
    shipping_address?: ShippingAddress;
  };
}

const ENABLED_METHODS_URL =
  "/api/shipping/methods?enabled=true&page=1&limit=100";

/** Enabled shipping methods, read through the protected API with the session cookie. */
export async function fetchEnabledShippingMethods(): Promise<ShippingMethod[]> {
  const response = await fetch(ENABLED_METHODS_URL, {
    method: "GET",
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) {
    throw new Error(
      `No se pudieron cargar los métodos de envío (HTTP ${response.status})`,
    );
  }
  const payload = (await response.json()) as {
    shippingMethods?: ShippingMethod[];
  };
  return payload.shippingMethods ?? [];
}

export function validateShippingMethod(
  method: ShippingMethod,
  cartTotal: number,
  region?: string,
): { isValid: boolean; message?: string } {
  if (!method.enabled) {
    return { isValid: false, message: "Método de envío no disponible" };
  }

  if (method.min_amount && cartTotal < parseFloat(method.min_amount)) {
    return {
      isValid: false,
      message: `Monto mínimo requerido: $${parseFloat(method.min_amount).toLocaleString()}`,
    };
  }

  if (method.max_amount && cartTotal > parseFloat(method.max_amount)) {
    return {
      isValid: false,
      message: `Monto máximo permitido: $${parseFloat(method.max_amount).toLocaleString()}`,
    };
  }

  if (
    region &&
    method.available_regions &&
    method.available_regions.length > 0 &&
    !method.available_regions.includes(region)
  ) {
    return { isValid: false, message: "No disponible en tu región" };
  }

  if (
    region &&
    method.excluded_regions &&
    method.excluded_regions.length > 0 &&
    method.excluded_regions.includes(region)
  ) {
    return { isValid: false, message: "No disponible en tu región" };
  }

  return { isValid: true };
}

export function createShippingLine(
  method: ShippingMethod,
  shippingAddress?: ShippingAddress,
): ShippingLine {
  return {
    id: method.id,
    method_id: method.id,
    method_title: method.name,
    method_type: method.shipping_type,
    total: method.cost,
    taxes: [],
    meta_data: {
      estimated_delivery: formatDeliveryTime(
        method.estimated_days_min,
        method.estimated_days_max,
      ),
      tracking_number: null,
      ...(shippingAddress && { shipping_address: shippingAddress }),
    },
  };
}

export const formatShippingCost = (cost: string | number): string => {
  const numericCost = typeof cost === "string" ? parseFloat(cost) : cost;
  if (numericCost === 0) return "Gratis";
  return `$${numericCost.toLocaleString("es-CL")}`;
};

export const formatDeliveryTime = (
  minDays: string | number,
  maxDays: string | number,
): string => {
  const numericMinDays =
    typeof minDays === "string" ? parseInt(minDays) : minDays;
  const numericMaxDays =
    typeof maxDays === "string" ? parseInt(maxDays) : maxDays;

  if (numericMinDays === numericMaxDays) {
    return `${numericMinDays} ${numericMinDays === 1 ? "día" : "días"}`;
  }
  return `${numericMinDays}-${numericMaxDays} días`;
};

export const getShippingTypeLabel = (type: string): string => {
  const labels: Record<string, string> = {
    free: "Envío Gratis",
    flat_rate: "Tarifa Fija",
    local_pickup: "Retiro en Tienda",
    calculated: "Calculado",
    express: "Express",
  };
  return labels[type] || type;
};
