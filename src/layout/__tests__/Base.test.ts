import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * D-21 (01f): the canonical topbar — date/time, notification bell, help, admin avatar — must be
 * implemented once in the shared shell (`Base.astro`), not per module page. Source-level
 * assertions (same pattern as `theme-tokens.test.ts`) because Astro SSR output for this file
 * needs a live admin session, which is out of scope for a unit test here.
 */
const source = readFileSync(
  fileURLToPath(new URL("../Base.astro", import.meta.url)),
  "utf8",
);

describe("Base.astro topbar (D-21, 01f)", () => {
  it("renders a topbar element inside the shared shell", () => {
    expect(source).toMatch(/id="topbar"/);
  });

  it("uses the shared date/time formatter instead of a hardcoded clock", () => {
    expect(source).toContain("formatTopbarDateTime");
    expect(source).toContain('from "../lib/topbarDateTime"');
  });

  it("renders an accessible notification bell with an empty-state panel (no fabricated count)", () => {
    expect(source).toMatch(/id="topbar-bell-btn"/);
    expect(source).toMatch(/aria-label="Notificaciones"/);
    expect(source).toMatch(/id="topbar-bell-panel"/);
    expect(source).toMatch(/No hay notificaciones/);
    // No invented badge count next to the bell button — the canon's "3" is sample data, not a
    // real alert source. `alertCount` already exists for the sidebar bell and is not reused here.
    expect(source).not.toMatch(/topbar-bell-btn[^>]*>[\s\S]{0,300}alertCount/);
  });

  it("renders an accessible help link to WhatsApp", () => {
    expect(source).toMatch(/aria-label="Ayuda/);
    expect(source).toContain("https://wa.me/56990818976");
  });

  it("renders the admin avatar with derived initials, not a hardcoded 'HS'", () => {
    const topbarBlock = source.slice(source.indexOf('id="topbar"'));
    const avatarBlock = topbarBlock.slice(
      0,
      topbarBlock.indexOf("</header>") === -1
        ? undefined
        : topbarBlock.indexOf("</header>"),
    );
    expect(avatarBlock).toContain("adminInitials");
    expect(avatarBlock).not.toMatch(/topbar-avatar"[^>]*>\s*HS\s*</);
  });

  it("gives every topbar icon button a keyboard-visible focus state", () => {
    expect(source).toMatch(/\.topbar[\s\S]*?:focus-visible/);
  });
});
