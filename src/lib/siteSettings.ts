import { z } from "zod";

/**
 * Business settings edited from the "Configuración del sitio" page (table `site_settings`,
 * migration 0015). The PDFs and emails read them through `SiteSettingsService.get()`.
 *
 * `DEFAULT_SETTINGS` carries the values that used to be hardcoded, so an empty or missing row
 * behaves exactly like the old constants. Stored data is always merged over the defaults.
 */

const text = (max = 300) =>
  z
    .string({ invalid_type_error: "Debe ser texto" })
    .trim()
    .max(max, `Máximo ${max} caracteres`);

const requiredText = (label: string, max = 300) =>
  text(max).min(1, `${label} es obligatorio`);

/** Light check: one `@`, a dot after it, no spaces. Empty allowed (field not set). */
const optionalEmail = z
  .string({ invalid_type_error: "Debe ser texto" })
  .trim()
  .max(200, "Máximo 200 caracteres")
  .refine(
    (v) => v === "" || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v),
    "Correo electrónico inválido",
  );

const optionalUrl = z
  .string({ invalid_type_error: "Debe ser texto" })
  .trim()
  .max(500, "Máximo 500 caracteres")
  .refine(
    (v) => v === "" || /^https?:\/\/[^\s]+$/i.test(v),
    "La URL debe comenzar con http:// o https://",
  );

/** Chilean RUT/cédula, with or without dots and hyphen. Empty allowed. */
const optionalRut = z
  .string({ invalid_type_error: "Debe ser texto" })
  .trim()
  .max(15, "Máximo 15 caracteres")
  .refine(
    (v) => v === "" || /^\d{1,2}(\.?\d{3}){2}-?[\dkK]$/.test(v),
    "RUT inválido",
  );

const optionalPhone = z
  .string({ invalid_type_error: "Debe ser texto" })
  .trim()
  .max(30, "Máximo 30 caracteres")
  .refine((v) => v === "" || /^\+?[\d\s()-]{6,}$/.test(v), "Teléfono inválido");

export const siteSettingsSchema = z.object({
  company: z.object({
    legalName: requiredText("La razón social"),
    tradeName: text(),
    rut: optionalRut,
    giro: text(),
    domicilio: text(),
  }),
  representative: z.object({
    name: requiredText("El nombre del representante"),
    cedula: optionalRut,
    domicilio: text(),
    signatureUrl: optionalUrl,
    signatureUpdatedAt: text(40),
  }),
  bank: z.object({
    holder: text(),
    rut: optionalRut,
    bankName: text(),
    accountType: text(),
    accountNumber: text(40),
    email: optionalEmail,
  }),
  contact: z.object({
    email: optionalEmail,
    adminNotificationEmail: optionalEmail,
    phone: optionalPhone,
    whatsapp: optionalPhone,
    website: optionalUrl,
  }),
  pickupAddresses: z
    .array(requiredText("La dirección"), {
      invalid_type_error: "Debe ser una lista",
    })
    .min(1, "Debe haber al menos una dirección de retiro")
    .max(5, "Máximo 5 direcciones de retiro"),
  reserve: z.object({
    defaultPct: z
      .number({ invalid_type_error: "La reserva debe ser un número" })
      .int("La reserva debe ser un número entero")
      .min(0, "La reserva no puede ser menor que 0")
      .max(100, "La reserva no puede ser mayor que 100"),
  }),
  policies: z.object({
    /** `{reserva}` is replaced by the reserve label ("reserva 25%") when the budget is rendered. */
    acceptance: text(1000),
    footer: text(1000),
    pickupWindow: text(300),
    returnDeadline: text(300),
  }),
});

export type SiteSettings = z.infer<typeof siteSettingsSchema>;

export const DEFAULT_SETTINGS: SiteSettings = {
  company: {
    legalName: "Hans Salinas SpA",
    tradeName: "Mario Hans Rental Fotográfico",
    rut: "77.892.569-9",
    giro: "Arriendo de equipos fotográficos",
    domicilio: "Santiago, Chile",
  },
  representative: {
    name: "Mario Alberto Hans Salinas",
    cedula: "16.135.586-0",
    domicilio: "Jose Victorino Lastarria 394, departamento N° 83, Santiago",
    signatureUrl: "https://media.mariohans.cl/firmas/firma_mario_hans.png",
    signatureUpdatedAt: "",
  },
  bank: {
    holder: "Hans Salinas SpA",
    rut: "77.892.569-9",
    bankName: "Banco de Chile",
    accountType: "Cuenta Corriente",
    accountNumber: "8140915407",
    email: "rental.mariohans@gmail.com",
  },
  contact: {
    email: "rental.mariohans@gmail.com",
    adminNotificationEmail: "rental.mariohans@gmail.com",
    phone: "+56990818976",
    whatsapp: "+56990818976",
    website: "https://rental.mariohans.cl",
  },
  pickupAddresses: ["Purísima 25, Recoleta", "Bellavista 77, Recoleta"],
  reserve: { defaultPct: 25 },
  policies: {
    acceptance:
      "Al aceptar el valor del presupuesto y realizar el abono de {reserva}, el arrendatario acepta plenamente todas las condiciones de arriendo y la política por daño.",
    footer:
      "Retiro el día anterior entre 15:00 y 20:00 hrs y devolución hasta las 13:00 hrs del día siguiente al término del arriendo, previa coordinación. Las devoluciones fuera del plazo acordado estarán sujetas al cobro de un día adicional de arriendo por cada día de retraso.",
    pickupWindow: "Retiro el día anterior entre 15:00 y 20:00 hrs",
    returnDeadline:
      "Devolución hasta las 13:00 hrs del día siguiente al término del arriendo",
  },
};

export interface SiteSettingsIssue {
  /** Dotted path, e.g. `contact.email` or `pickupAddresses.0`. */
  path: string;
  message: string;
}

export interface SiteSettingsError {
  message: string;
  issues: SiteSettingsIssue[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Merge a partial (or untrusted) object over `DEFAULT_SETTINGS`. Sections merge field by field;
 * `pickupAddresses` is replaced as a whole. Unknown sections and non-object sections are ignored.
 * Does NOT validate: use `parseSiteSettings` for that.
 */
export function withDefaults(partial: unknown): SiteSettings {
  const input = isRecord(partial) ? partial : {};
  const merged: Record<string, unknown> = {};

  for (const key of Object.keys(DEFAULT_SETTINGS) as Array<
    keyof SiteSettings
  >) {
    const base = DEFAULT_SETTINGS[key];
    const override = input[key];
    if (key === "pickupAddresses") {
      merged[key] = override === undefined ? [...(base as string[])] : override;
    } else if (isRecord(override)) {
      merged[key] = { ...(base as object), ...override };
    } else {
      merged[key] = { ...(base as object) };
    }
  }

  return merged as unknown as SiteSettings;
}

/** Merge over the defaults, then validate. On failure `settings` is the defaults and `error` is set. */
export function parseSiteSettings(input: unknown): {
  settings: SiteSettings;
  error: SiteSettingsError | null;
} {
  const result = siteSettingsSchema.safeParse(withDefaults(input));
  if (result.success) {
    return { settings: result.data, error: null };
  }

  const issues = result.error.issues.map((issue) => ({
    path: issue.path.join("."),
    message: issue.message,
  }));
  return {
    settings: withDefaults(undefined),
    error: { message: "Hay datos inválidos en la configuración", issues },
  };
}
