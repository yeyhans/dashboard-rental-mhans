/** Constant copy of the budget / processing PDFs, verbatim from the client's HTML template. */

export const COMPANY_NAME = "Hans Salinas SpA";

export const BANK_DETAILS = {
  razonSocial: "Hans Salinas SpA",
  rut: "77892569-9",
  banco: "Banco de Chile",
  tipoCuenta: "Cuenta Corriente",
  numeroCuenta: "8140915407",
  email: "rental.mariohans@gmail.com",
} as const;

export const DOCUMENT_LABEL = "Presupuesto de arriendo";

/** "Reserva 25%" → "reserva 25%"; fixed reserves ("Reserva") → "reserva". */
export function acceptanceTerms(reserveLabelText: string): string {
  const reserve = reserveLabelText.trim().toLowerCase() || "reserva";
  return `Al aceptar el valor del presupuesto y realizar el abono de ${reserve}, el arrendatario acepta plenamente todas las condiciones de arriendo y la política por daño.`;
}

export const FOOTER_POLICY =
  "Retiro el día anterior entre 15:00 y 20:00 hrs y devolución hasta las 13:00 hrs del día siguiente al término del arriendo, previa coordinación. Las devoluciones fuera del plazo acordado estarán sujetas al cobro de un día adicional de arriendo por cada día de retraso.";
