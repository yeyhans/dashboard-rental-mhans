import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

/**
 * The dashboard theme must be the client's design system, not shadcn's stock zinc palette.
 *
 * Source: `CONSOLIDADO WEB YEYSON/Diseño/MarioHans OS Design System/tokens/colors.css`, which
 * documents its own reconciliation of three earlier brand sources and resolves to: white-first
 * surface, `#0A0A0A` ink for screen text, pure-neutral gray ramp anchored on the brand grays
 * `#333 / #999 / #E2E2E2 / #F4F4F4`, pure `#000` reserved for the logo mark, and chromatic colour
 * used only as functional status language.
 *
 * Why assert the numbers rather than eyeball the screen: shadcn's default palette is zinc, whose
 * neutrals carry a 240° blue hue. Against the brand's pure-neutral grays the difference is a cool
 * cast across every surface — easy to miss in review, and wrong on every screen at once.
 *
 * Hue is the assertion that matters most. Every brand gray is `hsl(0 0% L)`; any non-zero hue or
 * saturation means a stock value survived the conversion.
 */
const css = readFileSync(
  fileURLToPath(new URL('../globals.css', import.meta.url)),
  'utf8'
);

/** Reads a custom property out of the `:root` block. */
function token(name: string): string {
  const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
  const value = root.match(new RegExp(`--${name}\\s*:\\s*([^;]+);`))?.[1];
  return (value ?? '').trim();
}

/** Brand ramp, converted from the hexes in the design system's colors.css. */
const BRAND = {
  white: '0 0% 100%',
  ink: '0 0% 3.9%', //     #0A0A0A
  gray700: '0 0% 20%', //  #333333
  gray500: '0 0% 40%', //  #666666
  gray300: '0 0% 60%', //  #999999
  gray200: '0 0% 88.6%', //#E2E2E2
  gray100: '0 0% 95.7%', //#F4F4F4
  gray50: '0 0% 98%', //   #FAFAFA
} as const;

describe('dashboard theme tokens', () => {
  it('paints surfaces white and text in brand ink', () => {
    expect(token('background')).toBe(BRAND.white);
    expect(token('foreground')).toBe(BRAND.ink);
    expect(token('card')).toBe(BRAND.white);
    expect(token('card-foreground')).toBe(BRAND.ink);
    expect(token('popover')).toBe(BRAND.white);
    expect(token('popover-foreground')).toBe(BRAND.ink);
  });

  it('uses ink for primary, not a chromatic accent', () => {
    // The design system explicitly DROPPED the master doc's #FF4500 accent: it conflicts with a
    // monochrome brand and reads as a false warning.
    expect(token('primary')).toBe(BRAND.ink);
    expect(token('primary-foreground')).toBe(BRAND.white);
  });

  it('anchors the secondary and muted surfaces on the brand grays', () => {
    expect(token('secondary')).toBe(BRAND.gray100);
    expect(token('secondary-foreground')).toBe(BRAND.gray700);
    expect(token('muted')).toBe(BRAND.gray100);
    expect(token('muted-foreground')).toBe(BRAND.gray500);
    expect(token('accent')).toBe(BRAND.gray100);
    expect(token('accent-foreground')).toBe(BRAND.gray700);
  });

  it('draws hairlines in gray-200, the design system default border', () => {
    expect(token('border')).toBe(BRAND.gray200);
    expect(token('input')).toBe(BRAND.gray200);
  });

  it('keeps the focus ring monochrome', () => {
    expect(token('ring')).toBe(BRAND.ink);
  });

  it('carries no blue-tinted zinc neutrals anywhere in :root', () => {
    // The single highest-value assertion in this file. Stock shadcn writes `240 5.9% 10%`; every
    // brand neutral is hue 0, saturation 0. A leftover 240 is a cool cast on that surface.
    const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const neutrals = [...root.matchAll(/--([a-z-]+)\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%/g)];
    expect(neutrals.length).toBeGreaterThan(10);

    const tinted = neutrals
      .filter(([, name]) => !name.startsWith('chart-') && !name.startsWith('destructive'))
      .filter(([, , hue, sat]) => Number(hue) !== 0 || Number(sat) !== 0)
      .map(([, name]) => name);

    expect(tinted).toEqual([]);
  });

  it('reserves chromatic colour for functional status only', () => {
    // `destructive` is the one non-neutral in the core set, and it must be the design system's
    // danger red (#DC2626), not shadcn's stock 0 84.2% 60.2%.
    expect(token('destructive')).toBe('0 72.2% 50.6%');
    expect(token('destructive-foreground')).toBe(BRAND.white);
  });

  it('gives the sidebar the canvas gray, not a white-on-white surface', () => {
    expect(token('sidebar-background')).toBe(BRAND.gray50);
    expect(token('sidebar-foreground')).toBe(BRAND.gray700);
    expect(token('sidebar-border')).toBe(BRAND.gray200);
  });

  it('carries no dark theme at all', () => {
    // white-first is a non-negotiable of the design system (`SKILL.md`). The dark block was dead
    // code — nothing applied the `.dark` class and the components use zero `dark:` utilities — but
    // leaving it invites someone to re-enable a theme the brand forbids.
    expect(css).not.toMatch(/\.dark\s*\{/);
  });
});
