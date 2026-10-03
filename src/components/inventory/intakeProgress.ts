import type { IntakeProgress } from "../../types/inventory";
import { apiErrorMessage } from "../../lib/apiError";

/**
 * Keeping the intake progress card honest after a unit is registered (A-17). Pure helpers so the
 * dashboard component stays a thin shell.
 */
export async function fetchIntakeProgress(
  fetchImpl: typeof fetch = fetch,
): Promise<IntakeProgress> {
  const response = await fetchImpl("/api/inventory/progress");
  const body = await response.json().catch(() => null);
  if (!response.ok || !body?.success || !body.data) {
    throw new Error(
      apiErrorMessage(body, "No se pudo actualizar el avance del inventario"),
    );
  }
  return body.data as IntakeProgress;
}

/** The only part of the summary a new unit changes for sure; the rest is re-read from the server. */
export function bumpTotalAssets(progress: IntakeProgress): IntakeProgress {
  return { ...progress, total_assets: progress.total_assets + 1 };
}

/** Sequence guard: only the newest request may write its answer into state. */
export function createLatestGate() {
  let latest = 0;
  return {
    next: () => ++latest,
    isLatest: (ticket: number) => ticket === latest,
  };
}
