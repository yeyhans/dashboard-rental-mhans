import { describe, expect, it } from 'vitest';

import { BUSINESS_TIME_ZONE, businessDay, startOfBusinessDay } from '../businessDay';

/**
 * R3-104: the business day is Santiago's. The server (Vercel) is UTC, so every case below is
 * written as a UTC instant and asserted against the Chilean calendar — the exact discrepancy the
 * server's local getters would produce is noted next to each.
 *
 * Chile 2026: DST (UTC-3) from Sunday 6 September 00:00 → 01:00, back to UTC-4 on Sunday
 * 5 April 00:00 → 23:00 (Saturday). Node's ICU carries these; nothing is hard-coded.
 */
describe('businessDay', () => {
  it('is America/Santiago', () => {
    expect(BUSINESS_TIME_ZONE).toBe('America/Santiago');
  });

  it('23:30 in Santiago is still that day, even though UTC has moved on', () => {
    // 2026-09-08T23:30:00-03:00 — server-UTC getters would say 09-09.
    expect(businessDay(new Date('2026-09-09T02:30:00Z'))).toBe('2026-09-08');
  });

  it('flips exactly at the 03:00 UTC boundary (UTC-3 in September)', () => {
    expect(businessDay(new Date('2026-09-09T02:59:59Z'))).toBe('2026-09-08');
    expect(businessDay(new Date('2026-09-09T03:00:00Z'))).toBe('2026-09-09');
  });

  it('flips at 04:00 UTC in winter (UTC-4 in June)', () => {
    expect(businessDay(new Date('2026-06-10T03:59:59Z'))).toBe('2026-06-09');
    expect(businessDay(new Date('2026-06-10T04:00:00Z'))).toBe('2026-06-10');
  });

  it('honours an explicit zone', () => {
    expect(businessDay(new Date('2026-09-09T02:30:00Z'), 'UTC')).toBe('2026-09-09');
  });
});

describe('startOfBusinessDay', () => {
  it('is Santiago midnight as a UTC instant, for any time in that day', () => {
    expect(startOfBusinessDay(new Date('2026-09-09T02:30:00Z'))).toBe('2026-09-08T03:00:00.000Z'); // 23:30 -03
    expect(startOfBusinessDay(new Date('2026-09-08T03:00:00Z'))).toBe('2026-09-08T03:00:00.000Z'); // 00:00 -03
    expect(startOfBusinessDay(new Date('2026-09-08T15:00:00Z'))).toBe('2026-09-08T03:00:00.000Z'); // 12:00 -03
  });

  it('uses the winter offset in June', () => {
    expect(startOfBusinessDay(new Date('2026-06-10T12:00:00Z'))).toBe('2026-06-10T04:00:00.000Z');
  });

  it('on the DST-start day (6 Sep 2026, no local midnight) begins at 01:00 -03 = 04:00 UTC', () => {
    // 03:30Z is still Saturday 5 Sep 23:30 -04; 04:00Z is Sunday 6 Sep 01:00 -03.
    expect(businessDay(new Date('2026-09-06T03:30:00Z'))).toBe('2026-09-05');
    expect(businessDay(new Date('2026-09-06T04:00:00Z'))).toBe('2026-09-06');
    expect(startOfBusinessDay(new Date('2026-09-06T12:00:00Z'))).toBe('2026-09-06T04:00:00.000Z');
  });

  it('on the DST-end day (5 Apr 2026) begins at 00:00 -04 = 04:00 UTC, after the repeated hour', () => {
    // Saturday 4 Apr 23:00–23:59 happens twice (once -03, once -04); Sunday starts at 04:00Z.
    expect(businessDay(new Date('2026-04-05T03:59:59Z'))).toBe('2026-04-04');
    expect(businessDay(new Date('2026-04-05T04:00:00Z'))).toBe('2026-04-05');
    expect(startOfBusinessDay(new Date('2026-04-05T12:00:00Z'))).toBe('2026-04-05T04:00:00.000Z');
  });

  it('is idempotent — the start of the start is itself', () => {
    const start = startOfBusinessDay(new Date('2026-09-08T20:00:00Z'));
    expect(startOfBusinessDay(new Date(start))).toBe(start);
  });
});
