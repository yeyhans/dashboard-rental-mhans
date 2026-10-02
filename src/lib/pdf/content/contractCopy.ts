import type { ContractTenantInfo } from "../core/types";
import {
  CLAUSES_TITLE,
  CLAUSE_TEMPLATES,
  CONTRACT_TITLE,
  EXPONEN,
  EXPONEN_TITLE,
  PREAMBLE_CONTINUATION,
  type ContractBlock,
} from "./contractClauses";

export const LANDLORD_EMAIL = "rental.mariohans@gmail.com";
/** Mario's signature image, printed above the left-hand rule. */
export const LANDLORD_SIGNATURE_URL =
  "https://media.mariohans.cl/firmas/firma_mario_hans.png";
export const HEADER_COMPANY_LINE = "Hans Salinas SpA · FotoRental";

const LANDLORD_COMPARECENCIA =
  "Hans Salinas SpA, Rol Único Tributario N° 77.892.569-9, representada legalmente por Mario Alberto Hans Salinas, cédula de identidad nacional N° 16.135.586-0, ambos con domicilio para estos efectos en Jose Victorino Lastarria 394, departamento N° 83, comuna de Santiago, ciudad de Santiago, en adelante “LA PARTE ARRENDADORA” o “LA ARRENDADORA”";
const TENANT_ALIAS = "en adelante “LA PARTE ARRENDATARIA” o “EL ARRENDATARIO”.";

export interface ContractCopyInput {
  isCompany: boolean;
  issueDateLong: string;
  tenant: ContractTenantInfo;
}

export interface ContractClause {
  number: string;
  title: string;
  blocks: readonly ContractBlock[];
}

export interface ContractCopy {
  title: string;
  comparecencia: string;
  preamble: string;
  exponenTitle: string;
  exponen: readonly string[];
  clausesTitle: string;
  clauses: readonly ContractClause[];
}

const MISSING = "—";
const orMissing = (value: string): string => value.trim() || MISSING;

/** Comparecencia: HTML wording for companies, derived wording for natural persons. */
export function buildComparecencia(input: ContractCopyInput): string {
  const { tenant } = input;
  const address = orMissing(tenant.address);
  const head = `En Santiago de Chile, a ${input.issueDateLong}, comparecen por una parte ${LANDLORD_COMPARECENCIA}; y por la otra, `;
  if (input.isCompany) {
    return `${head}${orMissing(tenant.company)}, Rol Único Tributario N° ${orMissing(tenant.companyRut)}, representada legalmente por ${orMissing(tenant.name)}, cédula de identidad nacional N° ${orMissing(tenant.rut)}, ambos con domicilio en ${address}, ${TENANT_ALIAS}`;
  }
  return `${head}${orMissing(tenant.name)}, cédula de identidad nacional N° ${orMissing(tenant.rut)}, con domicilio en ${address}, ${TENANT_ALIAS}`;
}

/** Pure: resolves every placeholder of the contract template for one client. */
export function buildContractCopy(input: ContractCopyInput): ContractCopy {
  const vars: Record<string, string> = {
    landlordEmail: LANDLORD_EMAIL,
    tenantEmail: orMissing(input.tenant.email),
  };
  const resolve = (text: string) =>
    text.replace(/\{\{(\w+)\}\}/g, (_, key: string) => vars[key] ?? "");

  return {
    title: CONTRACT_TITLE,
    comparecencia: buildComparecencia(input),
    preamble: PREAMBLE_CONTINUATION,
    exponenTitle: EXPONEN_TITLE,
    exponen: EXPONEN,
    clausesTitle: CLAUSES_TITLE,
    clauses: CLAUSE_TEMPLATES.map((clause) => ({
      number: clause.number,
      title: clause.title,
      blocks: clause.blocks.map((block) =>
        block.kind === "p"
          ? { kind: "p" as const, text: resolve(block.text) }
          : { kind: "bullets" as const, items: block.items.map(resolve) },
      ),
    })),
  };
}
