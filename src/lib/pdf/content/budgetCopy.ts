/**
 * Constant copy of the budget / processing PDFs. Business values (bank, acceptance text, footer)
 * come from `SiteSettings` through the document data; only the structural labels live here.
 */

export const DOCUMENT_LABEL = "Presupuesto de arriendo";

/**
 * Fills the `{reserva}` placeholder of the acceptance template.
 * "Reserva 25%" → "reserva 25%"; fixed reserves ("Reserva") → "reserva".
 */
export function acceptanceTerms(
  template: string,
  reserveLabelText: string,
): string {
  const reserve = reserveLabelText.trim().toLowerCase() || "reserva";
  return template.replaceAll("{reserva}", reserve);
}
