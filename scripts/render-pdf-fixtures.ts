/**
 * Renders every budget fixture to tmp/pdf/budget-<name>.pdf for visual inspection.
 * Run: pnpm exec tsx scripts/render-pdf-fixtures.ts
 */
import { mkdirSync, writeFileSync } from "node:fs";
import path from "node:path";
import React from "react";
import { BudgetDocument } from "../src/lib/pdf/components/budget/BudgetDocument";
import { ProcessingDocument } from "../src/lib/pdf/components/processing/ProcessingDocument";
import { UserContractDocument } from "../src/lib/pdf/components/contract/UserContractDocument";
import {
  budgetFixtures,
  budgetOverride,
  contractFixtures,
  contractOverride,
  processingFixtures,
  processingOverride,
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

for (const [name, data] of Object.entries(processingFixtures)) {
  const buffer = await renderToBufferForTest(
    React.createElement(ProcessingDocument, { data }),
  );
  const file = path.join(outDir, `processing-${name}.pdf`);
  writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.byteLength} bytes)`);
}

for (const [name, data] of Object.entries(contractFixtures)) {
  const buffer = await renderToBufferForTest(
    React.createElement(UserContractDocument, { data }),
  );
  const file = path.join(outDir, `contract-${name}.pdf`);
  writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.byteLength} bytes)`);
}

// Same documents built from the `settingsOverride` fixture (different bank, representative,
// pickup addresses and reserve), to check visually that the settings reach every block.
const overrides = [
  ["budget-override", BudgetDocument, budgetOverride],
  ["processing-override", ProcessingDocument, processingOverride],
  ["contract-override", UserContractDocument, contractOverride],
] as const;

for (const [name, component, data] of overrides) {
  const buffer = await renderToBufferForTest(
    React.createElement(component as React.FC<{ data: unknown }>, { data }),
  );
  const file = path.join(outDir, `${name}.pdf`);
  writeFileSync(file, buffer);
  console.log(`wrote ${file} (${buffer.byteLength} bytes)`);
}
