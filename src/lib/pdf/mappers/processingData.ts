import type { ProcessingDocumentData } from "../core/types";
import { DEFAULT_SETTINGS, type SiteSettings } from "../../siteSettings";
import { joinPickupAddresses, pdfLandlord } from "./settingsData";
import {
  addDaysDDMMAAAA,
  buildBudgetDocumentData,
  type BudgetOrderInput,
} from "./budgetData";

export interface ProcessingProfileInput {
  rut?: string | null;
  tipo_cliente?: string | null;
  empresa_nombre?: string | null;
  empresa_rut?: string | null;
}

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

/** Budget data + the facts the contract annex and the signature block print. */
export function buildProcessingDocumentData(
  order: BudgetOrderInput,
  profile?: ProcessingProfileInput | null,
  now: Date = new Date(),
  settings: SiteSettings = DEFAULT_SETTINGS,
): ProcessingDocumentData {
  const budget = buildBudgetDocumentData(order, profile, now, settings);
  const startRaw = clean(
    order.metadata?.order_fecha_inicio ?? order.order_fecha_inicio,
  );
  const hasReserveConfig =
    order.reserve_value !== undefined &&
    order.reserve_value !== null &&
    order.reserve_value !== "";
  const reservePct = hasReserveConfig
    ? Number(order.reserve_value)
    : settings.reserve.defaultPct;
  const hasPct =
    (hasReserveConfig ? order.reserve_type === "percent" : true) &&
    Number.isFinite(reservePct) &&
    reservePct > 0;

  const isEmpresa = clean(profile?.tipo_cliente) === "empresa";
  const company = isEmpresa
    ? clean(profile?.empresa_nombre) || budget.client.company
    : "";
  const companyRut = company ? clean(profile?.empresa_rut) : "";

  return {
    ...budget,
    landlord: pdfLandlord(settings),
    annex: {
      startDate: budget.reservation.startDate,
      endDate: budget.reservation.endDate,
      deliveryDate: addDaysDDMMAAAA(startRaw, -1),
      totalNet: budget.totals.subtotal,
      ...(hasPct ? { reservePct } : {}),
      reserveLabel: budget.totals.reserveLabel,
      pickupAddress: joinPickupAddresses(settings.pickupAddresses),
    },
    signer: {
      name: budget.client.name,
      rut: budget.client.rut,
      ...(company ? { company } : {}),
      ...(companyRut ? { companyRut } : {}),
    },
  };
}
