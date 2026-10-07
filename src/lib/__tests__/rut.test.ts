import { describe, expect, it } from "vitest";
import {
  RUT_ERROR_MESSAGE,
  cleanRut,
  computeRutCheckDigit,
  formatRut,
  isValidRut,
  rutFieldError,
  rutFieldDisplayValue,
  rutValidationError,
} from "../rut";

describe("cleanRut", () => {
  it("quita puntos, guion y espacios y pasa la K a mayúscula", () => {
    expect(cleanRut(" 12.345.678-5 ")).toBe("123456785");
    expect(cleanRut("7.654.321-k")).toBe("7654321K");
  });
});

describe("computeRutCheckDigit", () => {
  it.each([
    ["12345678", "5"],
    ["11111111", "1"],
    ["7654321", "6"],
    ["76086428", "5"],
    ["10000013", "K"],
    ["10000004", "0"],
  ])("cuerpo %s -> %s", (body, dv) => {
    expect(computeRutCheckDigit(body)).toBe(dv);
  });
});

describe("isValidRut", () => {
  it.each([
    "12.345.678-5",
    "12345678-5",
    "123456785",
    "11.111.111-1",
    "10.000.013-K",
    "10.000.013-k",
  ])("acepta %s", (rut) => expect(isValidRut(rut)).toBe(true));

  it.each([
    "12.345.678-4",
    "11.111.111-2",
    "10.000.013-0",
    "",
    "   ",
    "-",
    "K",
    "1",
    "abc",
    "12.345.678-",
    "12.34a.678-5",
    "123456789012-3",
  ])("rechaza %j", (rut) => expect(isValidRut(rut)).toBe(false));

  it("rechaza valores que no son texto", () => {
    expect(isValidRut(null)).toBe(false);
    expect(isValidRut(undefined)).toBe(false);
  });
});

describe("formatRut", () => {
  it("da formato con puntos y guion", () => {
    expect(formatRut("123456785")).toBe("12.345.678-5");
    expect(formatRut("7654321k")).toBe("7.654.321-K");
    expect(formatRut("12.345.678-5")).toBe("12.345.678-5");
  });

  it("formatea mientras se escribe, sin romper entradas cortas", () => {
    expect(formatRut("")).toBe("");
    expect(formatRut("1")).toBe("1");
    expect(formatRut("12")).toBe("1-2");
  });
});

describe("rutValidationError", () => {
  it("no se queja cuando no hay RUT en el payload", () => {
    expect(rutValidationError({})).toBeNull();
    expect(rutValidationError({ rut: null, empresa_rut: "" })).toBeNull();
    expect(rutValidationError({ rut: "   " })).toBeNull();
  });

  it("acepta RUT válidos", () => {
    expect(
      rutValidationError({ rut: "12.345.678-5", empresa_rut: "76.086.428-5" }),
    ).toBeNull();
  });

  it("rechaza un RUT con dígito verificador incorrecto", () => {
    expect(rutValidationError({ rut: "12.345.678-4" })).toBe(RUT_ERROR_MESSAGE);
    expect(RUT_ERROR_MESSAGE).toBe(
      "El RUT no es válido. Revisa el dígito verificador.",
    );
  });

  it("también valida el RUT de la empresa", () => {
    expect(
      rutValidationError({ rut: "12.345.678-5", empresa_rut: "76.086.428-0" }),
    ).toBe(RUT_ERROR_MESSAGE);
  });
});

describe("rutFieldError", () => {
  it("trata un campo vacío o en blanco como válido (opcional)", () => {
    expect(rutFieldError("")).toBeNull();
    expect(rutFieldError("   ")).toBeNull();
    expect(rutFieldError(null)).toBeNull();
    expect(rutFieldError(undefined)).toBeNull();
  });

  it("acepta RUT válidos con o sin formato", () => {
    expect(rutFieldError("12.345.678-5")).toBeNull();
    expect(rutFieldError("123456785")).toBeNull();
  });

  it("devuelve el mensaje en español para un RUT inválido", () => {
    expect(rutFieldError("12.345.678-4")).toBe(RUT_ERROR_MESSAGE);
    expect(rutFieldError("abc")).toBe(RUT_ERROR_MESSAGE);
  });
});

describe("rutFieldDisplayValue", () => {
  it("formatea un RUT válido", () => {
    expect(rutFieldDisplayValue("123456785")).toBe("12.345.678-5");
  });

  it("deja tal cual un RUT inválido o vacío", () => {
    expect(rutFieldDisplayValue("12.345.678-4")).toBe("12.345.678-4");
    expect(rutFieldDisplayValue("")).toBe("");
  });
});
