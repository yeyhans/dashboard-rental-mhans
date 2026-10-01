/**
 * Check-In "Filtrar fecha" (D-22 03a/03b): a pure client-side filter over the list the page
 * already loaded — no new endpoint — plus the band title rule that depends on it.
 */

export interface ReturnDateLike {
  readonly endDate: string | null;
}

/**
 * Entries whose `endDate` equals `filterDay` exactly. All entries pass through (a fresh copy,
 * never the same reference) when `filterDay` is empty — the default view, which intentionally
 * mixes open and overdue returns regardless of day.
 */
export function filterByReturnDate<T extends ReturnDateLike>(
  entries: readonly T[],
  filterDay: string,
): T[] {
  if (!filterDay) return entries.slice();
  return entries.filter((entry) => entry.endDate === filterDay);
}

/**
 * "Devoluciones hoy" only when the filter narrows the list to exactly today's returns. The
 * default (no filter) mixes open + overdue returns — see `CheckInBoard.tsx`'s own docstring
 * (D-15) — so calling it "hoy" there would misdescribe what is actually shown, and so would
 * calling any other single day "hoy".
 */
export function checkInBandTitle(
  filterDay: string,
  todayIsoDay: string,
): string {
  return filterDay === todayIsoDay ? "Devoluciones hoy" : "Devoluciones";
}

/**
 * D-25 (R3-checkin-preselect-hidden-by-filter): the right panel used to keep showing whatever
 * was selected before "Filtrar fecha" ran, even once that entry dropped out of `visible` — so
 * the detail panel and the highlighted row disagreed about what was "selected". A pure derivation
 * instead of a separate effect: if the current selection is still in the visible list, keep it;
 * otherwise fall back to the first visible entry, or `null` when the filter leaves nothing.
 */
export function resolveVisibleSelection<T extends { id: number }>(
  visibleEntries: readonly T[],
  currentId: number | null,
): number | null {
  if (visibleEntries.some((entry) => entry.id === currentId)) return currentId;
  return visibleEntries[0]?.id ?? null;
}
