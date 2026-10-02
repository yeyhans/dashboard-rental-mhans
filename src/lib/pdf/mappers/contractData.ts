import type { UserContractDocumentData } from "../core/types";

export interface ContractProfileInput {
  user_id?: number | string | null;
  nombre?: string | null;
  apellido?: string | null;
  email?: string | null;
  rut?: string | null;
  direccion?: string | null;
  ciudad?: string | null;
  tipo_cliente?: string | null;
  empresa_nombre?: string | null;
  empresa_rut?: string | null;
  empresa_direccion?: string | null;
  empresa_ciudad?: string | null;
  url_firma?: string | null;
}

const clean = (value: unknown): string =>
  typeof value === "string" ? value.trim() : "";

const joinAddress = (street: string, city: string): string =>
  [street, city].filter(Boolean).join(", ");

/** "2 de octubre de 2026", in Chile time. */
export function formatLongDateEs(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Santiago",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  }).formatToParts(date);
  const get = (type: string) =>
    Number(parts.find((part) => part.type === type)?.value);
  const months = [
    "enero",
    "febrero",
    "marzo",
    "abril",
    "mayo",
    "junio",
    "julio",
    "agosto",
    "septiembre",
    "octubre",
    "noviembre",
    "diciembre",
  ];
  return `${get("day")} de ${months[get("month") - 1]} de ${get("year")}`;
}

export function buildUserContractData(
  profile: ContractProfileInput,
  now: Date = new Date(),
): UserContractDocumentData {
  const isCompany = clean(profile.tipo_cliente) === "empresa";
  const name = [clean(profile.nombre), clean(profile.apellido)]
    .filter(Boolean)
    .join(" ");
  const rut = clean(profile.rut);
  const personalAddress = joinAddress(
    clean(profile.direccion),
    clean(profile.ciudad),
  );
  const companyAddress = joinAddress(
    clean(profile.empresa_direccion),
    clean(profile.empresa_ciudad),
  );
  const company = isCompany ? clean(profile.empresa_nombre) : "";
  const companyRut = isCompany ? clean(profile.empresa_rut) : "";
  const signature = clean(profile.url_firma);

  return {
    userId: Number(profile.user_id) || 0,
    isCompany,
    subtitle: isCompany ? "persona jurídica" : "persona natural",
    issueDateLong: formatLongDateEs(now),
    tenant: {
      name,
      rut,
      address: isCompany ? companyAddress || personalAddress : personalAddress,
      email: clean(profile.email),
      company,
      companyRut,
    },
    signer: {
      name,
      cedula: `Cédula de identidad nacional N° ${rut}`.trim(),
      ...(company ? { company } : {}),
      ...(companyRut ? { companyRut: `RUT N° ${companyRut}` } : {}),
    },
    ...(signature ? { signatureImageUrl: signature } : {}),
  };
}
