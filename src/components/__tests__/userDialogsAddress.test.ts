import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) =>
  readFileSync(path.resolve(__dirname, "..", file), "utf8");

describe.each([
  ["EditUserDialog.tsx", ""],
  ["CreateUserDialog.tsx", "create-"],
])("%s address autocomplete wiring", (file, prefix) => {
  const source = read(file);

  it("imports AddressInput and its helpers", () => {
    expect(source).toMatch(
      /import \{[^}]*AddressInput[^}]*addressCity[^}]*\} from ["']\.\/ui\/AddressInput["']/,
    );
  });

  it("uses AddressInput for the personal and company address, keeping ids", () => {
    expect(source).toMatch(
      new RegExp(`<AddressInput[\\s\\S]{0,60}id="${prefix}direccion"`),
    );
    expect(source).toMatch(
      new RegExp(`<AddressInput[\\s\\S]{0,60}id="${prefix}empresa_direccion"`),
    );
  });

  it("fills ciudad and pais from the selection without changing field names", () => {
    const compact = source.replace(/\s+/g, "").replace(/,\)/g, ")");
    for (const call of [
      'handleInputChange("direccion",addressLine(address))',
      'handleInputChange("ciudad",city)',
      'handleInputChange("pais",address.country)',
      'handleInputChange("empresa_direccion",addressLine(address))',
      'handleInputChange("empresa_ciudad",city)',
    ]) {
      expect(compact).toContain(call);
    }
  });

  it("no longer renders the plain Textarea for direccion", () => {
    expect(source).not.toMatch(/<Textarea[\s\S]{0,40}id="(create-)?direccion"/);
  });
});
