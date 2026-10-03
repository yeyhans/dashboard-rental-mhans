import { describe, expect, it } from "vitest";
import { budgetUploadFields } from "../budgetUpload";

/**
 * D-6 (A-05). `POST /api/order/generate-budget-pdf` uploaded the budget to the worker's
 * `/upload-pdf-only` without a `filePath`; the worker then falls back to
 * `contracts/contract_<userId>_<date>_<ts>.pdf`, so the budget was stored (and later linked in
 * `orders.new_pdf_on_hold_url`) as a contract. The worker accepts a caller `filePath` under
 * `budgets/` when the file name contains `_<userId>_` and matches `^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$`.
 */
const SAFE_FILENAME = /^[A-Za-z0-9][A-Za-z0-9._-]{0,199}$/;
const NOW = new Date("2026-10-02T15:30:00Z");

describe("budgetUploadFields", () => {
  it("names the file as a budget under budgets/, never as a contract", () => {
    const fields = budgetUploadFields({ customerId: 462, now: NOW });

    expect(fields.fileName).toMatch(/^budget_462_20261002_\d+\.pdf$/);
    expect(fields.filePath).toBe(`budgets/${fields.fileName}`);
    expect(fields.documentType).toBe("budget");
    expect(fields.userId).toBe("462");
    expect(fields.filePath).not.toMatch(/contract/i);
  });

  it("satisfies the worker rules: safe filename, userId embedded between underscores, .pdf", () => {
    const fields = budgetUploadFields({
      customerId: "3f2a9c1e-77b4-4d0e-9c1a-5a1d2b3c4e5f",
      now: NOW,
    });

    expect(SAFE_FILENAME.test(fields.fileName)).toBe(true);
    expect(fields.fileName).toContain(`_${fields.userId}_`);
    expect(fields.fileName.endsWith(".pdf")).toBe(true);
  });

  it("uses the business day (Santiago), not the UTC day", () => {
    // 02:30 UTC on the 3rd is still 23:30 on the 2nd in Santiago.
    const fields = budgetUploadFields({
      customerId: 7,
      now: new Date("2026-10-03T02:30:00Z"),
    });
    expect(fields.fileName).toContain("_20261002_");
  });

  it("keeps two uploads in the same second apart through the timestamp", () => {
    const a = budgetUploadFields({ customerId: 7, now: NOW });
    const b = budgetUploadFields({
      customerId: 7,
      now: new Date(NOW.getTime() + 1),
    });
    expect(a.fileName).not.toBe(b.fileName);
  });

  it("sanitises an unexpected customer id instead of building an unsafe key", () => {
    const fields = budgetUploadFields({
      customerId: "../etc/passwd",
      now: NOW,
    });
    expect(SAFE_FILENAME.test(fields.fileName)).toBe(true);
    expect(fields.fileName).not.toContain("/");
    expect(fields.fileName).toContain(`_${fields.userId}_`);
  });
});
