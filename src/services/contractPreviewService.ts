import { isValidRut } from "../lib/rut";
import { DEFAULT_SETTINGS, type SiteSettings } from "../lib/siteSettings";
import { buildContractCopy } from "../lib/pdf/content/contractCopy";
import { buildUserContractData } from "../lib/pdf/mappers/contractData";

/**
 * Read-only contract preview: renders the same clause text the signed PDF uses, as plain
 * structured text, for a tenant that may not be stored yet. No I/O, no PII logging.
 */

export interface ContractPreviewInput {
  tipo_cliente: "natural" | "empresa";
  nombre: string;
  apellido: string;
  rut: string;
  direccion: string;
  ciudad: string;
  email: string;
  empresa_nombre: string;
  empresa_rut: string;
  empresa_direccion: string;
  empresa_ciudad: string;
}

export interface ContractPreview {
  title: string;
  parties: string[];
  clauses: { number: string; title: string; paragraphs: string[] }[];
  closing: string[];
  issuedOn: string;
}

export type ContractPreviewValidation =
  | { ok: true; value: ContractPreviewInput }
  | { ok: false; error: string };

const MAX_LEN = 200;
const MAX_EMAIL_LEN = 254;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// eslint-disable-next-line no-control-regex
const CONTROL_CHARS = /[\u0000-\u001F\u007F-\u009F]/g;

type FieldRule = { key: keyof ContractPreviewInput; label: string };

const OPTIONAL_FIELDS: FieldRule[] = [
  { key: "ciudad", label: "ciudad" },
  { key: "email", label: "email" },
  { key: "empresa_nombre", label: "empresa_nombre" },
  { key: "empresa_rut", label: "empresa_rut" },
  { key: "empresa_direccion", label: "empresa_direccion" },
  { key: "empresa_ciudad", label: "empresa_ciudad" },
];

const REQUIRED_FIELDS: FieldRule[] = [
  { key: "nombre", label: "nombre" },
  { key: "apellido", label: "apellido" },
  { key: "rut", label: "rut" },
  { key: "direccion", label: "direccion" },
];

export function validateContractPreviewInput(
  body: unknown,
): ContractPreviewValidation {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "Cuerpo de la solicitud inválido" };
  }
  const raw = body as Record<string, unknown>;

  if (raw["tipo_cliente"] !== "natural" && raw["tipo_cliente"] !== "empresa") {
    return { ok: false, error: "tipo_cliente debe ser natural o empresa" };
  }

  const value: ContractPreviewInput = {
    tipo_cliente: raw["tipo_cliente"],
    nombre: "",
    apellido: "",
    rut: "",
    direccion: "",
    ciudad: "",
    email: "",
    empresa_nombre: "",
    empresa_rut: "",
    empresa_direccion: "",
    empresa_ciudad: "",
  };

  const read = (rule: FieldRule, required: boolean): string | null => {
    const input = raw[rule.key];
    if (input === undefined || input === null) {
      return required ? `El campo ${rule.label} es obligatorio` : null;
    }
    if (typeof input !== "string") {
      return `El campo ${rule.label} es inválido`;
    }
    const cleaned = input.replace(CONTROL_CHARS, "").trim();
    const max = rule.key === "email" ? MAX_EMAIL_LEN : MAX_LEN;
    if (cleaned.length > max) {
      return `El campo ${rule.label} es demasiado largo`;
    }
    if (required && cleaned === "") {
      return `El campo ${rule.label} es obligatorio`;
    }
    (value as unknown as Record<string, string>)[rule.key] = cleaned;
    return null;
  };

  for (const rule of REQUIRED_FIELDS) {
    const error = read(rule, true);
    if (error) return { ok: false, error };
  }
  for (const rule of OPTIONAL_FIELDS) {
    const error = read(rule, false);
    if (error) return { ok: false, error };
  }

  if (!isValidRut(value.rut)) {
    return { ok: false, error: "El RUT no es válido" };
  }
  if (value.email && !EMAIL_PATTERN.test(value.email)) {
    return { ok: false, error: "El email no es válido" };
  }
  if (value.tipo_cliente === "empresa") {
    if (!value.empresa_nombre) {
      return { ok: false, error: "El campo empresa_nombre es obligatorio" };
    }
    if (!isValidRut(value.empresa_rut)) {
      return { ok: false, error: "El RUT de la empresa no es válido" };
    }
  }

  return { ok: true, value };
}

/** "DD/MM/YYYY" in Chile time. */
function formatIssuedOn(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "America/Santiago",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}/${get("month")}/${get("year")}`;
}

export function buildContractPreview(
  input: ContractPreviewInput,
  now: Date = new Date(),
  settings: SiteSettings = DEFAULT_SETTINGS,
): ContractPreview {
  const data = buildUserContractData(input, now, settings);
  const copy = buildContractCopy(data);

  return {
    title: copy.title,
    parties: [
      copy.comparecencia,
      copy.preamble,
      copy.exponenTitle,
      ...copy.exponen,
    ],
    clauses: copy.clauses.map((clause) => ({
      number: clause.number,
      title: clause.title,
      paragraphs: clause.blocks.flatMap((block) =>
        block.kind === "p" ? [block.text] : block.items.map((i) => `• ${i}`),
      ),
    })),
    closing: ["Firma del arrendatario"],
    issuedOn: formatIssuedOn(now),
  };
}
