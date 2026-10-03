/**
 * The user-facing message of a failed API response. Dashboard endpoints answer `{ error }`
 * (project convention) but older ones answer `{ message }`; the UI must show whichever is there and
 * never "undefined".
 */
export function apiErrorMessage(body: unknown, fallback: string): string {
  if (body && typeof body === "object") {
    const { error, message } = body as { error?: unknown; message?: unknown };
    for (const candidate of [error, message]) {
      if (typeof candidate === "string" && candidate.trim())
        return candidate.trim();
    }
  }
  return fallback;
}
