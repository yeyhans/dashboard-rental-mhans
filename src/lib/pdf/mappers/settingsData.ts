import type { SiteSettings } from "../../siteSettings";
import type { PdfBankInfo, PdfLandlordInfo, PdfPolicies } from "../core/types";

/** Pure projections of `SiteSettings` onto the shapes the PDF documents carry. */

export function pdfBank(settings: SiteSettings): PdfBankInfo {
  const { bank } = settings;
  return {
    holder: bank.holder,
    rut: bank.rut,
    bankName: bank.bankName,
    accountType: bank.accountType,
    accountNumber: bank.accountNumber,
    email: bank.email,
  };
}

export function pdfLandlord(settings: SiteSettings): PdfLandlordInfo {
  return {
    name: settings.representative.name,
    cedula: settings.representative.cedula,
    domicilio: settings.representative.domicilio,
    company: settings.company.legalName,
    companyRut: settings.company.rut,
    signatureUrl: settings.representative.signatureUrl,
  };
}

export function pdfPolicies(settings: SiteSettings): PdfPolicies {
  return {
    acceptance: settings.policies.acceptance,
    footer: settings.policies.footer,
  };
}

/**
 * The pickup addresses as one phrase. A trailing ", <comuna>" shared by every address is said once:
 * ["Purísima 25, Recoleta", "Bellavista 77, Recoleta"] → "Purísima 25 o Bellavista 77, Recoleta".
 */
export function joinPickupAddresses(addresses: readonly string[]): string {
  if (addresses.length < 2) return addresses.join("");
  const suffixOf = (address: string): string => {
    const index = address.lastIndexOf(",");
    return index === -1 ? "" : address.slice(index);
  };
  const suffix = suffixOf(addresses[0]!);
  const shared =
    suffix !== "" && addresses.every((a) => suffixOf(a) === suffix);
  if (!shared) return addresses.join(" o ");
  return (
    addresses.map((a) => a.slice(0, a.length - suffix.length)).join(" o ") +
    suffix
  );
}
