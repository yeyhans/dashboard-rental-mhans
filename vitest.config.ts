import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: [
      ...configDefaults.exclude,
      // Not a vitest suite: a manual browser-console script against
      // /api/orders/check-conflicts that only matches the `*.test.js` glob by accident. Vitest
      // collects it, finds no `describe`/`it`, and fails the run — which would make the new CI
      // job red on every commit regardless of the real suite. Excluded rather than deleted
      // because the script is still used by hand.
      'src/tests/conflict-detection.test.js',
    ],
  },
});
