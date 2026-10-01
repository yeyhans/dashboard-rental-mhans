import { describe, expect, it } from "vitest";
import { buildCsvBlob, csvEscape, rowsToCsv, CSV_BOM } from "../csv";

describe("csvEscape", () => {
  it("returns a plain value unchanged", () => {
    expect(csvEscape("Ana Pérez")).toBe("Ana Pérez");
  });

  it("quotes a value containing a comma", () => {
    expect(csvEscape("Pérez, Ana")).toBe('"Pérez, Ana"');
  });

  it("doubles an embedded double quote", () => {
    expect(csvEscape('Sesión "producto"')).toBe('"Sesión ""producto"""');
  });

  it("quotes a value containing a newline or bare carriage return", () => {
    expect(csvEscape("Ana\nPérez")).toBe('"Ana\nPérez"');
    expect(csvEscape("Ana\rPérez")).toBe('"Ana\rPérez"');
  });
});

describe("rowsToCsv", () => {
  it("joins the header and escaped rows with newlines", () => {
    const csv = rowsToCsv(
      ["Mes", "Ingresos"],
      [
        ["2026-01", "100000"],
        ["2026-02, nota", "200000"],
      ],
    );
    expect(csv).toBe('Mes,Ingresos\n2026-01,100000\n"2026-02, nota",200000');
  });

  it("renders only the header for an empty row set", () => {
    expect(rowsToCsv(["A", "B"], [])).toBe("A,B");
  });
});

describe("buildCsvBlob", () => {
  it("prefixes the CSV with a UTF-8 BOM", () => {
    const content = buildCsvBlob("a,b\n1,2");
    expect(content.charCodeAt(0)).toBe(0xfeff);
    expect(content.slice(1)).toBe("a,b\n1,2");
  });

  it("exports the BOM constant used by both boards", () => {
    expect(CSV_BOM).toBe("﻿");
  });
});
