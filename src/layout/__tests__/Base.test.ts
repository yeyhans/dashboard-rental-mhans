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

  it("aligns the clock refresh to the minute boundary instead of drifting from load time (R3-topbar-clock-drift)", () => {
    expect(source).toContain("getSeconds");
    expect(source).toContain("getMilliseconds");
    // The periodic 60s refresh must start only once the alignment setTimeout fires, not immediately.
    const setTimeoutIndex = source.indexOf("setTimeout(() => {");
    const setIntervalIndex = source.indexOf(
      "setInterval(renderTopbarClock, 60000);",
    );
    expect(setTimeoutIndex).toBeGreaterThan(-1);
    expect(setIntervalIndex).toBeGreaterThan(setTimeoutIndex);
  });
});

describe("Base.astro mobile drawer and burger (D-25)", () => {
  it("renders a real hamburger button inside the topbar, not a fixed logo image outside it", () => {
    expect(source).not.toContain("mobile-logo-btn");
    expect(source).not.toContain("toggle-button-black.png");
    const topbarBlock = source.slice(
      source.indexOf('id="topbar"'),
      source.indexOf("</header>"),
    );
    expect(topbarBlock).toContain('id="mobile-menu-btn"');
    expect(topbarBlock).toContain("<Menu");
    expect(topbarBlock).toContain('aria-controls="sidebar"');
    expect(topbarBlock).toContain("md:hidden");
  });

  it("does not float the burger button above the mobile overlay (no `fixed` positioning)", () => {
    const btnBlock = source.slice(
      source.indexOf('id="mobile-menu-btn"') - 50,
      source.indexOf('id="mobile-menu-btn"') + 300,
    );
    expect(btnBlock).not.toMatch(/class="[^"]*\bfixed\b/);
  });

  it("syncs aria-expanded on the burger when the drawer opens and closes", () => {
    expect(source).toMatch(
      /openMobileSidebar[\s\S]*?mobile-menu-btn[\s\S]*?aria-expanded.*true/,
    );
    expect(source).toMatch(
      /closeMobileSidebar[\s\S]*?mobile-menu-btn[\s\S]*?aria-expanded.*false/,
    );
  });

  it("keeps the drawer header with the text brand lockup and a visible close button", () => {
    const asideBlock = source.slice(
      source.indexOf("<aside"),
      source.indexOf("</aside>"),
    );
    expect(asideBlock).toContain("MarioHans OS");
    expect(asideBlock).toContain("Rental Técnico");
    expect(asideBlock).toContain("Cerrar menú");
  });

  it("keeps the active nav item as a solid black fill with white text", () => {
    expect(source).toMatch(
      /\.sidebar-nav-item\.active\s*\{[^}]*background-color:\s*#111111/,
    );
    expect(source).toMatch(
      /\.sidebar-nav-item\.active\s*\{[^}]*color:\s*hsl\(0 0% 100%\)/,
    );
  });

  it("reduces sub-link indentation and row padding on mobile so the nav fits without its own scrollbar", () => {
    expect(source).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.sidebar-nav-item\s*\{[^}]*padding:/,
    );
    expect(source).toMatch(
      /@media \(max-width: 767px\)[\s\S]*?\.nav-sublinks\s*\{[^}]*padding-left:/,
    );
  });
});
