import { describe, expect, it, vi } from 'vitest';
import { getBudgetEmailRequestId, logBudgetEmailFailure } from '../generate-budget-pdf';

describe('budget email delivery helpers', () => {
  it('uses the inbound request ID when present', () => {
    const request = new Request('https://dashboard.mariohans.cl/api/order/generate-budget-pdf', {
      headers: { 'X-Request-ID': 'req-dashboard-boundary' },
    });

    expect(getBudgetEmailRequestId(request)).toBe('req-dashboard-boundary');
  });

  it('logs only requestId and normalized delivery failure metadata', () => {
    const warn = vi.fn();
    const logger = { warn };

    logBudgetEmailFailure(logger, 'req-sanitized', 'budget_customer_email', 'worker_delivery_exception');

    expect(warn).toHaveBeenCalledWith('⚠️ Budget email delivery failed (non-critical)', {
      requestId: 'req-sanitized',
      event: 'budget_customer_email',
      failureClass: 'worker_delivery_exception',
    });
    expect(JSON.stringify(warn.mock.calls)).not.toContain('cliente@example.com');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('pdf_url');
    expect(JSON.stringify(warn.mock.calls)).not.toContain('Authorization');
  });
});
