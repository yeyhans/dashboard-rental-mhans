/**
 * Chilean RUT helpers (pure, no I/O).
 *
 * A RUT is a numeric body plus a check digit (DV) computed with modulo 11 over the body digits,
 * read right to left with the weights 2,3,4,5,6,7 repeating. DV 11 -> "0", 10 -> "K".
 * Bodies of 7 or 8 digits are accepted (1.000.000 up to 99.999.999, which covers people and
 * companies).
 */

export const RUT_ERROR_MESSAGE =
  "El RUT no es válido. Revisa el dígito verificador.";

/** Digits and the optional K only, upper-cased: "12.345.678-5" -> "123456785". */
export function cleanRut(value: string): string {
  return value.replace(/[^0-9kK]/g, "").toUpperCase();
}

/** Modulo-11 check digit for a numeric body: returns "0"-"9" or "K". */
export function computeRutCheckDigit(body: string): string {
  let sum = 0;
  let weight = 2;
  for (let i = body.length - 1; i >= 0; i--) {
    sum += Number(body[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const dv = 11 - (sum % 11);
  if (dv === 11) return "0";
  if (dv === 10) return "K";
  return String(dv);
}

export function isValidRut(value: string | null | undefined): boolean {
  if (typeof value !== "string") return false;
  // Anything besides digits, dots, hyphen, spaces and K is not a RUT (cleanRut would hide it).
  if (/[^0-9kK.\-\s]/.test(value)) return false;

  const clean = cleanRut(value);
  const body = clean.slice(0, -1);
  const dv = clean.slice(-1);
  if (!/^\d{7,8}$/.test(body)) return false;
  return computeRutCheckDigit(body) === dv;
}

/** "123456785" -> "12.345.678-5". Short input is returned as typed so it works while typing. */
export function formatRut(value: string): string {
  const clean = cleanRut(value);
  if (clean.length < 2) return clean;
  const body = clean.slice(0, -1).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${body}-${clean.slice(-1)}`;
}

/**
 * Error message for a payload that carries a RUT, or null when there is nothing to complain about.
 * Only RUTs that are present (non-blank) are checked: the field is optional.
 */
export function rutValidationError(payload: {
  rut?: string | null;
  empresa_rut?: string | null;
}): string | null {
  for (const value of [payload.rut, payload.empresa_rut]) {
    if (
      typeof value === "string" &&
      value.trim() !== "" &&
      !isValidRut(value)
    ) {
      return RUT_ERROR_MESSAGE;
    }
  }
  return null;
}
