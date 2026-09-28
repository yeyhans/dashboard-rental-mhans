import path from "node:path";
import { configDefaults, defineConfig } from "vitest/config";

export default defineConfig({
  // D-03 (revisiones-cliente): the shared component tests render .tsx files with
  // `react-dom/server` (no jsdom / testing-library in this project — see the note on
  // `statusBadgeClass` in `src/lib/orderStatus.ts`). `tsconfig.json` sets `"jsx": "preserve"`,
  // which esbuild otherwise reads as the classic transform and compiles JSX to bare
  // `React.createElement` calls with no import for it. Astro's own build already handles this via
  // `@astrojs/react`; vitest does not go through that plugin, so it needs telling directly.
  esbuild: {
    jsx: "automatic",
  },
  resolve: {
    // Same `@/*` alias as tsconfig.json's `paths`. shadcn/ui primitives (e.g.
    // `src/components/ui/dropdown-menu.tsx`) import via this alias; without it here, any test
    // that pulls one in (directly or transitively) fails to resolve, not just tests written
    // against the alias themselves.
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      // Not a vitest suite: a manual browser-console script against
      // /api/orders/check-conflicts that only matches the `*.test.js` glob by accident. Vitest
      // collects it, finds no `describe`/`it`, and fails the run — which would make the new CI
      // job red on every commit regardless of the real suite. Excluded rather than deleted
      // because the script is still used by hand.
      "src/tests/conflict-detection.test.js",
    ],
  },
});
