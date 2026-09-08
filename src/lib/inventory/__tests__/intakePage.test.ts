import { describe, expect, it, vi } from 'vitest';

import { DATA_QUALITY_ERROR, EMPTY_PROGRESS, EMPTY_REPORT, INTAKE_PROGRESS_ERROR, loadIntakeSidecars } from '../intakePage';

/**
 * R4-001 / R4-002: one failing side panel must not take the intake form down with it. The
 * report query reads the 0010 columns, so on an instance without that migration it rejects with
 * `42703` — exactly the case simulated here.
 */
const progress = { published_products: 10, products_with_assets: 4, total_assets: 9, completion_percentage: 40 };
const report = { total: 10, incomplete: 2, products: [] };

describe('loadIntakeSidecars', () => {
  it('passes both panels through when both loaders resolve', async () => {
    const log = vi.fn();
    const result = await loadIntakeSidecars({ progress: async () => progress, report: async () => report }, {}, log);
    expect(result).toEqual({ progress, progressError: null, report, reportError: null });
    expect(log).not.toHaveBeenCalled();
  });

  it('degrades the report to empty + message when its query fails (0010 not applied), keeping progress', async () => {
    const log = vi.fn();
    const undefinedColumn = Object.assign(new Error('column products.declared_quantity does not exist'), { code: '42703' });
    const result = await loadIntakeSidecars(
      { progress: async () => progress, report: async () => Promise.reject(undefinedColumn) },
      { admin: 'a@x.cl' },
      log
    );
    expect(result.progress).toEqual(progress);
    expect(result.progressError).toBeNull();
    expect(result.report).toEqual(EMPTY_REPORT);
    expect(result.reportError).toBe(DATA_QUALITY_ERROR);
    expect(log).toHaveBeenCalledWith(expect.stringContaining('reporte de calidad'), { admin: 'a@x.cl', error: undefinedColumn });
  });

  it('degrades progress independently', async () => {
    const log = vi.fn();
    const result = await loadIntakeSidecars(
      { progress: async () => Promise.reject(new Error('timeout')), report: async () => report },
      {},
      log
    );
    expect(result.progress).toEqual(EMPTY_PROGRESS);
    expect(result.progressError).toBe(INTAKE_PROGRESS_ERROR);
    expect(result.report).toEqual(report);
    expect(result.reportError).toBeNull();
  });

  it('never throws, even when both fail', async () => {
    const result = await loadIntakeSidecars(
      { progress: async () => Promise.reject(new Error('a')), report: async () => Promise.reject(new Error('b')) },
      {},
      vi.fn()
    );
    expect(result.progressError).toBe(INTAKE_PROGRESS_ERROR);
    expect(result.reportError).toBe(DATA_QUALITY_ERROR);
  });
});
