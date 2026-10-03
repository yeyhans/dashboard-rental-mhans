import { businessDay } from "./businessDay";

/**
 * Form fields for storing a budget PDF through the worker's `/upload-pdf-only`.
 *
 * Without `filePath` the worker stores the file as `contracts/contract_<userId>_...`, which is how
 * budgets ended up looking like contracts (A-05). With `filePath` under `budgets/` and a file name
 * that contains `_<userId>_` the worker keeps the key as sent (see the worker's `validatePdfPath`).
 * The URL is still stored in the same order column; only the file name changes.
 */
export interface BudgetUploadFields {
  fileName: string;
  filePath: string;
  userId: string;
  documentType: "budget";
}

/** The worker's `userId` check (`isSafeId`) and file-name rule only admit this alphabet. */
function safeSegment(value: string | number): string {
  const cleaned = String(value).replace(/[^A-Za-z0-9-]/g, "");
  return cleaned || "0";
}

export function budgetUploadFields(input: {
  customerId: string | number;
  now?: Date;
}): BudgetUploadFields {
  const now = input.now ?? new Date();
  const userId = safeSegment(input.customerId);
  const day = businessDay(now).replace(/-/g, "");
  const fileName = `budget_${userId}_${day}_${now.getTime()}.pdf`;
  return {
    fileName,
    filePath: `budgets/${fileName}`,
    userId,
    documentType: "budget",
  };
}
