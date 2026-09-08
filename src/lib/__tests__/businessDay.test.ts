import { describe, expect, it } from 'vitest';

import {
  BUSINESS_TIME_ZONE,
  businessDay,
  formatBusinessDate,
  formatBusinessDateTime,
  formatBusinessDayLabel,
  formatBusinessTime,
  startOfBusinessDay,
} from '../businessDay';

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

// Hydration (live defect on dash-consolidado): the server renders on UTC, the browser in Chile.
// Rendered times must be the same string on both, so the formatters take the zone from
// BUSINESS_TIME_ZONE and never from the process, and assemble the string from parts so ICU
// punctuation differences between Node and Chrome cannot leak in either.
describe('formatBusinessTime / formatBusinessDateTime / formatBusinessDate', () => {
  it('formats a September instant (UTC-3) in Santiago, 24-hour clock', () => {
    expect(formatBusinessTime('2026-09-08T16:58:00Z')).toBe('13:58');
    expect(formatBusinessDateTime('2026-09-08T16:58:00Z')).toBe('08-09 13:58');
    expect(formatBusinessDate('2026-09-08T16:58:00Z')).toBe('08-09-2026');
  });

  it('formats a June instant (UTC-4) and rolls the day back when Santiago is still on the 9th', () => {
    expect(formatBusinessTime('2026-06-10T03:30:00Z')).toBe('23:30');
    expect(formatBusinessDateTime('2026-06-10T03:30:00Z')).toBe('09-06 23:30');
    expect(formatBusinessDate('2026-06-10T03:30:00Z')).toBe('09-06-2026');
  });

  it('prints midnight as 00, never 24 or 12 a. m.', () => {
    expect(formatBusinessTime('2026-09-09T03:00:00Z')).toBe('00:00');
  });

  it('returns an em dash for an unparseable instant', () => {
    expect(formatBusinessTime('ayer')).toBe('—');
    expect(formatBusinessDateTime('')).toBe('—');
    expect(formatBusinessDate('nope')).toBe('—');
  });
});

describe('formatBusinessDayLabel', () => {
  it('is the Spanish long date with only the first character capitalised', () => {
    // Not "Martes, 8 De Septiembre": Spanish keeps "de" and month names lower-case.
    expect(formatBusinessDayLabel(new Date('2026-09-08T16:58:00Z'))).toBe('Martes, 8 de septiembre');
  });

  it('names the Santiago day, not the UTC one', () => {
    // 23:30 -03 on Tuesday 8 Sep; UTC is already Wednesday.
    expect(formatBusinessDayLabel(new Date('2026-09-09T02:30:00Z'))).toBe('Martes, 8 de septiembre');
    expect(formatBusinessDayLabel(new Date('2026-09-09T03:00:00Z'))).toBe('Miércoles, 9 de septiembre');
  });
});
