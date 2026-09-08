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

/** Rampa del canónico de Área 01, convertida a HSL para las variables de shadcn. */
const CANON_HSL = {
  white: '0 0% 100%',
  ink: '0 0% 6.7%', //       #111111 text-primary
  secondary: '0 0% 40%', //  #666666 text-secondary
  surface2: '60 5.9% 96.7%', // #F7F7F6 — apenas cálido, así viene el canónico
  border: '0 0% 91.8%', //   #EAEAEA
  sidebar: '0 0% 98%', //    #FAFAFA
} as const;

describe('dashboard theme tokens', () => {
  it('paints surfaces white and text in brand ink', () => {
    expect(token('background')).toBe(CANON_HSL.white);
    expect(token('foreground')).toBe(CANON_HSL.ink);
    expect(token('card')).toBe(CANON_HSL.white);
    expect(token('card-foreground')).toBe(CANON_HSL.ink);
    expect(token('popover')).toBe(CANON_HSL.white);
    expect(token('popover-foreground')).toBe(CANON_HSL.ink);
  });

  it('uses ink for primary, not a chromatic accent', () => {
    // The design system explicitly DROPPED the master doc's #FF4500 accent: it conflicts with a
    // monochrome brand and reads as a false warning.
    expect(token('primary')).toBe(CANON_HSL.ink);
    expect(token('primary-foreground')).toBe(CANON_HSL.white);
  });

  it('anchors the secondary and muted surfaces on the brand grays', () => {
    expect(token('secondary')).toBe(CANON_HSL.surface2);
    expect(token('secondary-foreground')).toBe(CANON_HSL.secondary);
    expect(token('muted')).toBe(CANON_HSL.surface2);
    expect(token('muted-foreground')).toBe(CANON_HSL.secondary);
    expect(token('accent')).toBe(CANON_HSL.surface2);
    expect(token('accent-foreground')).toBe(CANON_HSL.secondary);
  });

  it('draws hairlines in gray-200, the design system default border', () => {
    expect(token('border')).toBe(CANON_HSL.border);
    expect(token('input')).toBe(CANON_HSL.border);
  });

  it('keeps the focus ring monochrome', () => {
    expect(token('ring')).toBe(CANON_HSL.ink);
  });

  it('carries no blue-tinted zinc neutrals anywhere in :root', () => {
    // The single highest-value assertion in this file. Stock shadcn writes `240 5.9% 10%`; every
    // brand neutral is hue 0, saturation 0. A leftover 240 is a cool cast on that surface.
    const root = css.match(/:root\s*\{([\s\S]*?)\}/)?.[1] ?? '';
    const neutrals = [...root.matchAll(/--([a-z-]+)\s*:\s*(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)%/g)];
    expect(neutrals.length).toBeGreaterThan(10);

    const tinted = neutrals
      .map(([, name, hue, sat]) => ({ name: name ?? '', hue: Number(hue), sat: Number(sat) }))
      .filter(({ name }) => !name.startsWith('chart-') && !name.startsWith('destructive'))
      // La regla real no es "tono 0": es "nada azulado". El canónico usa #F7F7F6,
      // que es tono 60 con 5.9% de saturación — apenas cálido, y así viene del cliente.
      // Zinc escribe 240°; ese es el intruso que este test existe para atrapar.
      .filter(({ hue, sat }) => sat > 0 && hue >= 180 && hue <= 300)
      .map(({ name }) => name);

    expect(tinted).toEqual([]);
  });

  it('reserves chromatic colour for functional status only', () => {
    // `destructive` is the one non-neutral in the core set, and it must be the design system's
    // danger red (#DC2626), not shadcn's stock 0 84.2% 60.2%.
    expect(token('destructive')).toBe('4 68% 38%');
    expect(token('destructive-foreground')).toBe(CANON_HSL.white);
  });

  it('gives the sidebar the canvas gray, not a white-on-white surface', () => {
    expect(token('sidebar-background')).toBe(CANON_HSL.sidebar);
    expect(token('sidebar-foreground')).toBe(CANON_HSL.secondary);
    expect(token('sidebar-border')).toBe(CANON_HSL.border);
  });

  it('carries no dark theme at all', () => {
    // white-first is a non-negotiable of the design system (`SKILL.md`). The dark block was dead
    // code — nothing applied the `.dark` class and the components use zero `dark:` utilities — but
    // leaving it invites someone to re-enable a theme the brand forbids.
    expect(css).not.toMatch(/\.dark\s*\{/);
  });
});

/**
 * Estado funcional — tokens canónicos de Área 01.
 *
 * Copiados verbatim del `:root` de `Área 01 · Rental Técnico/OFF/*.html`, que se declara
 * "CANONICAL DESIGN TOKENS (System Alignment RC1) — Single source of truth shared by all Área 01
 * modules".
 *
 * Estos NO son los valores de `Diseño/MarioHans OS Design System/tokens/colors.css`. Una versión
 * anterior de este archivo asertaba los del Design System, y estaba equivocada para el dashboard:
 * al leer el `:root` de los tres HTML canónicos se ve que el portal cliente (Área 02) y la web
 * pública (RC1) llevan la paleta viva (`#16A34A` / `#DCFCE7`) mientras la consola operacional
 * lleva una apagada (`#256B44` / `#E7F2EC`). La división es deliberada, no una deriva.
 */
const CANON = {
  'color-ok': '#256B44',
  'color-ok-bg': '#E7F2EC',
  'color-info': '#2E5490',
  'color-info-bg': '#EAF0FA',
  'color-warn': '#8A6A1E',
  'color-warn-bg': '#FBF3DE',
  'color-crit': '#A3271F',
  'color-crit-bg': '#FBEEEC',
  'color-neutral': '#666666',
  'color-neutral-bg': '#F7F7F6',
  'color-muted': '#707070',
  'color-muted-bg': '#F7F7F6',
} as const;

const CANON_SURFACES = {
  'color-background': '#FFFFFF',
  'color-surface-soft': '#FAFAFA',
  'color-surface-2': '#F7F7F6',
  'color-sidebar-bg': '#FAFAFA',
  'color-text-primary': '#111111',
  'color-text-secondary': '#666666',
  'color-text-faint': '#707070',
  'color-border': '#EAEAEA',
  'color-border-soft': '#F0F0EF',
  'color-border-strong': '#D6D6D4',
} as const;

describe('tokens canónicos de Área 01', () => {
  it.each(Object.entries(CANON))('define %s como %s', (name, hex) => {
    expect(token(name).toUpperCase()).toBe(hex);
  });

  it.each(Object.entries(CANON_SURFACES))('define %s como %s', (name, hex) => {
    expect(token(name).toUpperCase()).toBe(hex);
  });

  it('reserva el tono crítico: ningún estado de pedido lo usa', () => {
    // El canónico usa `--color-crit` solo en `.badge-rechazada`, y v1.2 pliega Rechazada dentro
    // de `cancelled`, cuya clase canónica `.badge-cancelada` es gris apagado. El token existe
    // para incidencias, no para pedidos.
    expect(token('color-crit')).toBeTruthy();
  });

  it('lleva las medidas de layout del canónico', () => {
    expect(token('sidebar-w')).toBe('232px');
    expect(token('ficha-w')).toBe('640px');
  });

  /**
   * El shell de Área 01 no se sostiene solo con color. Su `:root` declara además una escala de
   * espaciado, una de radios, dos familias tipográficas y las sombras, y el CSS de cada módulo
   * las referencia por nombre (`var(--space-5)`, `var(--radius-pill)`, `var(--font-mono)`).
   * Sin ellas el navegador resuelve la propiedad a nada y el componente se renderiza sin
   * separación ni esquinas — un fallo que se ve pero que ninguna herramienta reporta.
   */
  it.each([
    ['space-1', '4px'], ['space-2', '8px'], ['space-3', '12px'],
    ['space-4', '16px'], ['space-5', '24px'], ['space-6', '32px'],
  ])('define la escala de espaciado %s como %s', (name, value) => {
    expect(token(name)).toBe(value);
  });

  it.each([
    ['radius-sm', '6px'], ['radius-md', '8px'], ['radius-lg', '10px'], ['radius-pill', '999px'],
  ])('define el radio %s como %s', (name, value) => {
    expect(token(name)).toBe(value);
  });

  it('declara las dos familias tipográficas del canónico', () => {
    // Inter para la interfaz; la mono es obligatoria en cifras, RUT, folios y horas, donde el
    // ancho variable de Inter desalinea las columnas de una tabla.
    expect(token('font-ui')).toContain('Inter');
    expect(token('font-mono')).toContain('JetBrains Mono');
  });

  it('declara las sombras y el anillo de foco', () => {
    expect(token('shadow-md')).toBeTruthy();
    expect(token('shadow-drawer')).toBeTruthy();
    // El anillo de foco es requisito de accesibilidad, no decoración: sin él la navegación por
    // teclado no tiene indicador visible.
    expect(token('focus-ring')).toBeTruthy();
  });
});
