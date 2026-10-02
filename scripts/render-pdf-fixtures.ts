/**
 * Renders every budget fixture to tmp/pdf/budget-<name>.pdf for visual inspection.
 * Run: pnpm exec tsx scripts/render-pdf-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { BudgetDocument } from "../src/lib/pdf/components/budget/BudgetDocument";
import {
  budgetFixtures,
  renderToBufferForTest,
} from "../src/lib/pdf/__tests__/fixtures";

const outDir = path.resolve(process.cwd(), "tmp", "pdf");
mkdirSync(outDir, { recursive: true });

for (const [name, data] of Object.entries(budgetFixtures)) {
  const buffer = await renderToBufferForTest(
    React.createElement(BudgetDocument, { data }),
  );
  const file = path.join(outDir, `budget-${name}.pdf`);
  writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.byteLength} bytes)`);
}
