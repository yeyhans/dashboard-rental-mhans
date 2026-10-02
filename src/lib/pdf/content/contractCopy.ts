import { DEFAULT_SETTINGS } from "../../siteSettings";
import type {
  ContractTenantInfo,
  PdfBankInfo,
  PdfLandlordInfo,
} from "../core/types";
import { pdfBank, pdfLandlord } from "../mappers/settingsData";
import {
  CLAUSES_TITLE,
  CLAUSE_TEMPLATES,
  CONTRACT_TITLE,
  EXPONEN,
  EXPONEN_TITLE,
  PREAMBLE_CONTINUATION,
  type ContractBlock,
} from "./contractClauses";

const TENANT_ALIAS = "en adelante “LA PARTE ARRENDATARIA” o “EL ARRENDATARIO”.";

export interface ContractCopyInput {
  isCompany: boolean;
  issueDateLong: string;
  tenant: ContractTenantInfo;
  /** Landlord, bank, reserve, e-mail and site; each defaults to `DEFAULT_SETTINGS`. */
  landlord?: PdfLandlordInfo;
  bank?: PdfBankInfo;
  reservePct?: number;
  landlordEmail?: string;
  website?: string;
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

function landlordComparecencia(landlord: PdfLandlordInfo): string {
  return `${landlord.company}, Rol Único Tributario N° ${landlord.companyRut}, representada legalmente por ${landlord.name}, cédula de identidad nacional N° ${landlord.cedula}, ambos con domicilio para estos efectos en ${landlord.domicilio}, en adelante “LA PARTE ARRENDADORA” o “LA ARRENDADORA”`;
}

/** Comparecencia: HTML wording for companies, derived wording for natural persons. */
export function buildComparecencia(input: ContractCopyInput): string {
  const { tenant } = input;
  const landlord = input.landlord ?? pdfLandlord(DEFAULT_SETTINGS);
  const address = orMissing(tenant.address);
  const head = `En Santiago de Chile, a ${input.issueDateLong}, comparecen por una parte ${landlordComparecencia(landlord)}; y por la otra, `;
  if (input.isCompany) {
    return `${head}${orMissing(tenant.company)}, Rol Único Tributario N° ${orMissing(tenant.companyRut)}, representada legalmente por ${orMissing(tenant.name)}, cédula de identidad nacional N° ${orMissing(tenant.rut)}, ambos con domicilio en ${address}, ${TENANT_ALIAS}`;
  }
  return `${head}${orMissing(tenant.name)}, cédula de identidad nacional N° ${orMissing(tenant.rut)}, con domicilio en ${address}, ${TENANT_ALIAS}`;
}

/** Pure: resolves every placeholder of the contract template for one client. */
export function buildContractCopy(input: ContractCopyInput): ContractCopy {
  const bank = input.bank ?? pdfBank(DEFAULT_SETTINGS);
  const reservePct = input.reservePct ?? DEFAULT_SETTINGS.reserve.defaultPct;
  const vars: Record<string, string> = {
    landlordEmail: input.landlordEmail || DEFAULT_SETTINGS.contact.email,
    tenantEmail: orMissing(input.tenant.email),
    website: input.website || DEFAULT_SETTINGS.contact.website,
    reservePct: String(reservePct).replace(".", ","),
    balancePct: String(Math.round((100 - reservePct) * 100) / 100).replace(
      ".",
      ",",
    ),
    bankHolder: bank.holder,
    bankRut: bank.rut,
    bankName: bank.bankName,
    accountType: bank.accountType,
    accountNumber: bank.accountNumber,
    bankEmail: bank.email,
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
      blocks: clause.blocks
        .map((block) =>
          block.kind === "p"
            ? { kind: "p" as const, text: resolve(block.text) }
            : { kind: "bullets" as const, items: block.items.map(resolve) },
        )
        // A bank field left empty in the settings prints nothing instead of a blank line.
        .filter((block) => block.kind !== "p" || block.text.trim() !== ""),
    })),
  };
}
