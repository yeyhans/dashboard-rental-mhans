import { existsSync, readFileSync, statSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { FONT_FAMILIES, FONT_FILES, LOGO_PATH } from "../core/fonts";

describe("PDF font assets", () => {
  it("exposes the three families", () => {
    expect(FONT_FAMILIES).toEqual({
      display: "Archivo",
      body: "Montserrat",
      mono: "IBM Plex Mono",
    });
  });

  it("ships every TTF as a TrueType file under 400 KB", () => {
    expect(FONT_FILES.length).toBe(11);
    for (const file of FONT_FILES) {
      expect(existsSync(file.path), file.path).toBe(true);
      expect(statSync(file.path).size).toBeLessThan(400 * 1024);
      expect(
        readFileSync(file.path).subarray(0, 4).toString("hex"),
        file.path,
      ).toBe("00010000");
    }
  });

  it("resolves the local logo PNG", () => {
    expect(existsSync(LOGO_PATH)).toBe(true);
    expect(readFileSync(LOGO_PATH).subarray(1, 4).toString("latin1")).toBe(
      "PNG",
    );
  });
});
