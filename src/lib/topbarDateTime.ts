const WEEKDAYS = [
  "Domingo",
  "Lunes",
  "Martes",
  "Miércoles",
  "Jueves",
  "Viernes",
  "Sábado",
];

const MONTHS = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

export interface TopbarDateTime {
  /** e.g. "Miércoles, 10 de Junio de 2026" — canon `.topbar-meta .date`. */
  date: string;
  /** 24h `HH:MM`, e.g. "10:42" — canon `.topbar-meta .time`. */
  time: string;
}

/**
 * Formats the topbar clock (D-21, 01f) in es-CL from a local `Date`. Pure and manual (no
 * `Intl`/`toLocaleDateString`) so it is deterministic in tests and consistent with the rest of
 * the codebase's date helpers (see `OperationalAgenda.astro`'s `dayLabel`), instead of depending
 * on the runtime's ICU data or default locale.
 *
 * Takes local time on purpose: this renders client-side in the admin's own browser, not
 * server-side, so there is no SSR/hydration mismatch and no need to pin a timezone.
 */
export function formatTopbarDateTime(now: Date): TopbarDateTime {
  const weekday = WEEKDAYS[now.getDay()];
  const month = MONTHS[now.getMonth()];
  const date = `${weekday}, ${now.getDate()} de ${month} de ${now.getFullYear()}`;

  const hours = String(now.getHours()).padStart(2, "0");
  const minutes = String(now.getMinutes()).padStart(2, "0");
  const time = `${hours}:${minutes}`;

  return { date, time };
}

/**
 * D-27 (R3-source-only-behavior-tests, follow-up to R3-topbar-clock-drift): the delay, in
 * milliseconds, until the next wall-clock minute boundary — extracted out of `Base.astro`'s
 * inline script so the computation itself has a real, deterministic test instead of only a grep
 * for `getSeconds`/`getMilliseconds` in the source. Always in `(0, 60000]`: exactly `60000` when
 * called precisely on the boundary, so the schedule never fires immediately again.
 */
export function msUntilNextMinute(now: Date): number {
  return 60000 - (now.getSeconds() * 1000 + now.getMilliseconds());
}
