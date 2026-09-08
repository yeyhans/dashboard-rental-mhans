/**
 * The business day is Chile's, not the server's (R3-104).
 *
 * The dashboard runs on Vercel, whose clock is UTC. `new Date().getDate()` there rolls over at
 * 20:00–21:00 in Santiago, so "movimientos hoy", "retiros de mañana" and every other calendar
 * question answered with the server's local getters would be wrong for the last three or four
 * hours of each working day — the hours the garage is busiest. This module names the zone once
 * and derives the calendar day from it with `Intl`, which carries the tz database (including
 * Chile's DST switches) so no offset is hard-coded.
 *
 * `date` columns (`order_fecha_inicio`, …) are already calendar days and are never parsed here;
 * only instants (`checked_at`, `now`) go through `businessDay`.
 */

export const BUSINESS_TIME_ZONE = 'America/Santiago';

const dayFormatter = new Map<string, Intl.DateTimeFormat>();
const partsFormatter = new Map<string, Intl.DateTimeFormat>();

function dayFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = dayFormatter.get(timeZone);
  if (!formatter) {
    // en-CA prints ISO order: YYYY-MM-DD.
    formatter = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' });
    dayFormatter.set(timeZone, formatter);
  }
  return formatter;
}

function partsFormatterFor(timeZone: string): Intl.DateTimeFormat {
  let formatter = partsFormatter.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('en-US', {
      timeZone,
      hourCycle: 'h23',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
    partsFormatter.set(timeZone, formatter);
  }
  return formatter;
}

/** The calendar day (`YYYY-MM-DD`) of an instant in the business zone. */
export function businessDay(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  return dayFormatterFor(timeZone).format(instant);
}

/** Zone offset at `instant`, in minutes (local − UTC). Negative for Chile. */
function zoneOffsetMinutes(instant: Date, timeZone: string): number {
  const parts = Object.fromEntries(
    partsFormatterFor(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  ) as Record<string, number>;
  const asUtc = Date.UTC(
    parts.year ?? 1970,
    (parts.month ?? 1) - 1,
    parts.day ?? 1,
    parts.hour ?? 0,
    parts.minute ?? 0,
    parts.second ?? 0
  );
  return Math.round((asUtc - instant.getTime()) / 60_000);
}

/**
 * The first instant of `instant`'s business day, as an ISO string — what `checked_at >= ?`
 * compares against. On the night DST starts (Chile: first Saturday of September, 24:00 → 01:00)
 * local midnight does not exist; the day then begins at the first instant that formats to that
 * day, which is what the candidate check below selects.
 */
export function startOfBusinessDay(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  const day = businessDay(instant, timeZone);
  const [y, m, d] = day.split('-').map(Number);
  const naiveMidnightUtc = Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1);

  // The offset may differ between the naive guess and the real midnight (DST edge), so try the
  // offset measured at each and keep the earliest candidate that still lands on `day`.
  const firstOffset = zoneOffsetMinutes(new Date(naiveMidnightUtc), timeZone);
  const firstCandidate = naiveMidnightUtc - firstOffset * 60_000;
  const secondOffset = zoneOffsetMinutes(new Date(firstCandidate), timeZone);
  const secondCandidate = naiveMidnightUtc - secondOffset * 60_000;

  const candidates = [firstCandidate, secondCandidate]
    .filter((candidate) => businessDay(new Date(candidate), timeZone) === day)
    .sort((a, b) => a - b);

  return new Date(candidates[0] ?? firstCandidate).toISOString();
}

const EMPTY_TIME = '—';

/**
 * Wall-clock fields of an instant in the business zone, zero-padded, or `null` when the input
 * does not parse. Every rendered time goes through here so the server (UTC on Vercel) and the
 * browser (wherever the operator is) print byte-identical strings — a `toLocaleString` without
 * `timeZone` hydrated "13:58" against "10:58 a. m." on /inventory/movements. The pieces are
 * assembled by hand rather than taken from `format()` so ICU punctuation differences between
 * Node and Chrome cannot leak into the markup either.
 */
function wallClock(iso: string, timeZone: string): Record<'year' | 'month' | 'day' | 'hour' | 'minute', string> | null {
  const instant = new Date(iso);
  if (Number.isNaN(instant.getTime())) return null;
  const parts = Object.fromEntries(
    partsFormatterFor(timeZone)
      .formatToParts(instant)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  ) as Record<string, string>;
  return {
    year: parts.year ?? '',
    month: parts.month ?? '',
    day: parts.day ?? '',
    hour: parts.hour ?? '',
    minute: parts.minute ?? '',
  };
}

/** `HH:mm` in the business zone, 24-hour clock; `—` when `iso` does not parse. */
export function formatBusinessTime(iso: string, timeZone: string = BUSINESS_TIME_ZONE): string {
  const wall = wallClock(iso, timeZone);
  return wall ? `${wall.hour}:${wall.minute}` : EMPTY_TIME;
}

/** `dd-mm HH:mm` in the business zone; `—` when `iso` does not parse. */
export function formatBusinessDateTime(iso: string, timeZone: string = BUSINESS_TIME_ZONE): string {
  const wall = wallClock(iso, timeZone);
  return wall ? `${wall.day}-${wall.month} ${wall.hour}:${wall.minute}` : EMPTY_TIME;
}

/** `dd-mm-yyyy` in the business zone; `—` when `iso` does not parse. */
export function formatBusinessDate(iso: string, timeZone: string = BUSINESS_TIME_ZONE): string {
  const wall = wallClock(iso, timeZone);
  return wall ? `${wall.day}-${wall.month}-${wall.year}` : EMPTY_TIME;
}

const dayLabelFormatter = new Map<string, Intl.DateTimeFormat>();

/**
 * The /bodega heading: "Martes, 8 de septiembre" for the business day of `instant`. Only the
 * first character is capitalised — Spanish keeps "de" and month names lower-case, so a CSS
 * `capitalize` (which title-cases every word) is wrong here.
 */
export function formatBusinessDayLabel(instant: Date, timeZone: string = BUSINESS_TIME_ZONE): string {
  let formatter = dayLabelFormatter.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat('es-CL', { timeZone, weekday: 'long', day: 'numeric', month: 'long' });
    dayLabelFormatter.set(timeZone, formatter);
  }
  const label = formatter.format(instant);
  return label.charAt(0).toUpperCase() + label.slice(1);
}
