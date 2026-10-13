/**
 * T-19 (c): the document title shown in the browser tab, minus any email-shaped segment.
 *
 * Most pages build their title as `"<Módulo> | <admin email>"`. The tab (and screenshots, shared
 * screens, browser history) must not expose who is signed in, so the shared layout drops every
 * `|`-separated segment that looks like an email address.
 */
const FALLBACK_TITLE = "Panel de Administración - Rental Mario Hans";
const EMAIL_SEGMENT = /^[^\s@|]+@[^\s@|]+\.[^\s@|]+$/;

export function documentTitle(title: string | null | undefined): string {
  const segments = (title ?? "")
    .split("|")
    .map((segment) => segment.trim())
    .filter((segment) => segment.length > 0 && !EMAIL_SEGMENT.test(segment));
  return segments.length > 0 ? segments.join(" | ") : FALLBACK_TITLE;
}
