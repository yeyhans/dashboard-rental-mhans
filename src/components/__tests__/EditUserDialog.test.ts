import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  join(__dirname, "..", "EditUserDialog.tsx"),
  "utf8",
);

describe("EditUserDialog RUT validation", () => {
  it("uses the shared RUT field helpers", () => {
    expect(source).toMatch(/rutFieldError/);
    expect(source).toMatch(/rutFieldDisplayValue/);
    expect(source).toMatch(/RUT_ERROR_MESSAGE/);
  });

  it.each(["rut", "empresa_rut"])(
    "wires blur, aria-invalid and aria-describedby on %s",
    (id) => {
      const start = source.indexOf(`id="${id}"`);
      expect(start).toBeGreaterThan(-1);
      const block = source.slice(start, start + 600);
      expect(block).toMatch(/onBlur=/);
      expect(block).toMatch(/aria-invalid=/);
      expect(block).toMatch(/aria-describedby=/);
      expect(source).toContain(`id="${id}-error"`);
    },
  );

  it("blocks submit and focuses the first invalid field", () => {
    expect(source).toMatch(/\.focus\(\)/);
    const submit = source.slice(source.indexOf("const handleSubmit"));
    expect(submit.indexOf("rutFieldError")).toBeGreaterThan(-1);
    expect(submit.indexOf("rutFieldError")).toBeLessThan(
      submit.indexOf("fetch(`/api/users/"),
    );
  });

  it("shows a server RUT error on the field", () => {
    expect(source).toMatch(/=== RUT_ERROR_MESSAGE/);
  });
});
