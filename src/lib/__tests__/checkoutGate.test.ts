import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_ALLOWED_ORDER_STATUSES,
  CHECKOUT_ORDER_ERRORS,
  validateCheckoutOrderStatus,
} from '../assetMovements';

describe('validateCheckoutOrderStatus (Salida gate)', () => {
  it.each(['confirmed', 'preparation', 'in-rental'])('allows a checkout on a %s order', (status) => {
    expect(validateCheckoutOrderStatus(status)).toEqual({ valid: true });
  });

  it.each(['request', 'evaluation', 'return', 'completed', 'cancelled'])(
    'blocks a checkout on a %s order with a Spanish error',
    (status) => {
      const result = validateCheckoutOrderStatus(status);
      expect(result.valid).toBe(false);
      expect(result.error).toBe(CHECKOUT_ORDER_ERRORS.NOT_CONFIRMED);
      expect(result.error).toMatch(/confirm/i);
    }
  );

  it.each([null, undefined, '', 'pending', 'unknown'])('fails closed on %s', (status) => {
    expect(validateCheckoutOrderStatus(status as never).valid).toBe(false);
  });

  it('exposes exactly the three owner-approved statuses', () => {
    expect([...CHECKOUT_ALLOWED_ORDER_STATUSES].sort()).toEqual(['confirmed', 'in-rental', 'preparation']);
  });
});
