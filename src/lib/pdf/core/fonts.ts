import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { Font } from "@react-pdf/renderer";

/**
 * PDF typography: static TTFs (OFL, Google Fonts) shipped under `src/lib/pdf/fonts/`.
 * react-pdf cannot take woff2 or variable fonts, hence one file per weight.
 */
export const FONT_FAMILIES = {
  display: "Archivo",
  body: "Montserrat",
  mono: "IBM Plex Mono",
} as const;

export const FONT_SIZES = {
  small: 9,
  normal: 12,
  medium: 14,
  large: 17,
  xlarge: 20,
  xxlarge: 24,
  huge: 32,
} as const;

/**
 * Resolves a bundled asset to an absolute path. The module-relative URL works in vitest and dev;
 * once Astro bundles the server into one chunk `import.meta.url` no longer sits next to the asset
 * folders, so the project-root candidates (Vercel runs functions from the project root, and
 * `vercel.json`/adapter `includeFiles` copies the files there) are tried next.
 */
export function resolveAssetPath(
  folder: "fonts" | "assets",
  file: string,
): string {
  const candidates: string[] = [];
  try {
    candidates.push(
      fileURLToPath(new URL(`../${folder}/${file}`, import.meta.url)),
    );
  } catch {
    // import.meta.url may not be a file: URL in some bundles; fall through to cwd candidates.
  }
  candidates.push(path.join(process.cwd(), "src", "lib", "pdf", folder, file));
  candidates.push(path.join(process.cwd(), "lib", "pdf", folder, file));
  return (
    candidates.find((candidate) => existsSync(candidate)) ?? candidates[0]!
  );
}

export interface FontFile {
  family: string;
  weight: number;
  path: string;
}

const FONT_SPEC: ReadonlyArray<readonly [string, string, readonly number[]]> = [
  [FONT_FAMILIES.display, "Archivo", [700, 800, 900]],
  [FONT_FAMILIES.body, "Montserrat", [400, 500, 600, 700, 800]],
  [FONT_FAMILIES.mono, "IBMPlexMono", [400, 500, 600]],
];

export const FONT_FILES: FontFile[] = FONT_SPEC.flatMap(
  ([family, filePrefix, weights]) =>
    weights.map((weight) => ({
      family,
      weight,
      path: resolveAssetPath("fonts", `${filePrefix}-${weight}.ttf`),
    })),
);

export const LOGO_PATH = resolveAssetPath("assets", "logo-mariohans.png");

let logoSource: { data: Buffer; format: 'png' } | undefined;

/** Logo as an in-memory buffer: react-pdf fetches string sources as URLs, so a path would fail. */
export function getLogoSource(): { data: Buffer; format: 'png' } {
  logoSource ??= { data: readFileSync(LOGO_PATH), format: 'png' };
  return logoSource;
}

let registered = false;

/** Idempotent: registers every family once per process. Called on import below. */
export function registerFonts(): void {
  if (registered) return;
  registered = true;

  for (const [family] of FONT_SPEC) {
    Font.register({
      family,
      fonts: FONT_FILES.filter((file) => file.family === family).map(
        (file) => ({
          src: file.path,
          fontWeight: file.weight,
        }),
      ),
    });
  }

  // Spanish words must never be split with a hyphen: keep each word whole.
  Font.registerHyphenationCallback((word) => [word]);
}

registerFonts();
