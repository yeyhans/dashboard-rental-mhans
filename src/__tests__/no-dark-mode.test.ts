import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * D10 (auditoría de navegador 2026-09-01): el sistema de diseño del cliente exige tema único,
 * blanco primero, sin seguir `prefers-color-scheme`. Hubo un incidente real donde
 * `<html class="dark">` quedaba pegada y volvía ilegible el banner de "Acceso Solo para
 * Administradores" por contraste roto. El mecanismo de alternancia (`ModeToggle`) y las clases
 * `dark:` de Tailwind son la superficie que reintroduce ese riesgo — no deben sobrevivir.
 */
const SRC_DIR = fileURLToPath(new URL('../..', import.meta.url));

function listSourceFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '__tests__') continue;
    const full = join(dir, entry);
    const stats = statSync(full);
    if (stats.isDirectory()) {
      listSourceFiles(full, out);
    } else if (/\.(astro|tsx|ts)$/.test(entry) && !entry.endsWith('.test.ts') && !entry.endsWith('.test.tsx')) {
      out.push(full);
    }
  }
  return out;
}

const files = listSourceFiles(join(SRC_DIR, 'src'));

describe('single-theme enforcement (no dark mode)', () => {
  it('has no ModeToggle component left to mount', () => {
    const stillExists = files.some((f) => f.endsWith(join('components', 'ModeToggle.tsx')));
    expect(stillExists).toBe(false);
  });

  it('never imports or renders ModeToggle', () => {
    const offenders = files.filter((f) => readFileSync(f, 'utf8').includes('ModeToggle'));
    expect(offenders).toEqual([]);
  });

  it('never uses a Tailwind dark: variant', () => {
    const offenders = files
      .filter((f) => /(?:^|[\s"'`{])dark:/.test(readFileSync(f, 'utf8')))
      .map((f) => f.slice(SRC_DIR.length));
    expect(offenders).toEqual([]);
  });
});
