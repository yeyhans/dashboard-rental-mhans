import type { DataQualityReport, IntakeProgress } from '../../types/inventory';

/**
 * Data loading for `/inventory` (R4-001/R4-002): the intake form must render even when the two
 * side panels cannot. `getDataQualityReport()` reads the 0010 columns, so on an instance where
 * that migration is not applied yet it fails with `42703` — and before this helper that single
 * failure 500'd the whole page, form included. Each panel now degrades to a Spanish message on
 * its own; the form never waits on them.
 *
 * Pure apart from the logger, so the settle-and-degrade logic is unit-tested without Astro.
 */
export const INTAKE_PROGRESS_ERROR = 'No se pudo calcular el avance del conteo. El formulario sigue disponible.';
export const DATA_QUALITY_ERROR = 'No se pudo cargar la revisión de datos. El formulario sigue disponible.';

export const EMPTY_PROGRESS: IntakeProgress = {
  published_products: 0,
  products_with_assets: 0,
  total_assets: 0,
  completion_percentage: 0,
};

export const EMPTY_REPORT: DataQualityReport = { total: 0, incomplete: 0, products: [] };

export interface IntakeSidecars {
  progress: IntakeProgress;
  progressError: string | null;
  report: DataQualityReport;
  reportError: string | null;
}

export interface IntakeSidecarLoaders {
  progress: () => Promise<IntakeProgress>;
  report: () => Promise<DataQualityReport>;
}

type Logger = (message: string, context: Record<string, unknown>) => void;

/** Settles both loaders; a rejection becomes an empty panel plus its message, never a throw. */
export async function loadIntakeSidecars(
  loaders: IntakeSidecarLoaders,
  context: Record<string, unknown> = {},
  log: Logger = console.error
): Promise<IntakeSidecars> {
  const [progress, report] = await Promise.allSettled([loaders.progress(), loaders.report()]);

  const result: IntakeSidecars = {
    progress: EMPTY_PROGRESS,
    progressError: null,
    report: EMPTY_REPORT,
    reportError: null,
  };

  if (progress.status === 'fulfilled') {
    result.progress = progress.value;
  } else {
    log('[inventory] Error al calcular el avance del conteo:', { ...context, error: progress.reason });
    result.progressError = INTAKE_PROGRESS_ERROR;
  }

  if (report.status === 'fulfilled') {
    result.report = report.value;
  } else {
    log('[inventory] Error al construir el reporte de calidad de datos:', { ...context, error: report.reason });
    result.reportError = DATA_QUALITY_ERROR;
  }

  return result;
}
