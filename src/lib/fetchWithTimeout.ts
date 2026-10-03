/**
 * `fetch` with a deadline. A request that never answers rejects with `FetchTimeoutError` instead of
 * keeping the caller (a serverless function, or a browser tab on "Guardando...") waiting for ever.
 *
 * A caller-supplied `signal` still works: whichever aborts first wins, and only the deadline maps to
 * `FetchTimeoutError`.
 */
export class FetchTimeoutError extends Error {
  constructor(
    readonly url: string,
    readonly timeoutMs: number,
  ) {
    super(
      `La solicitud superó el tiempo máximo de ${Math.round(timeoutMs / 1000)} s`,
    );
    this.name = "FetchTimeoutError";
  }
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit = {},
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  const callerSignal = init.signal;
  const onCallerAbort = () => controller.abort(callerSignal?.reason);
  if (callerSignal) {
    if (callerSignal.aborted) onCallerAbort();
    else callerSignal.addEventListener("abort", onCallerAbort, { once: true });
  }

  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) throw new FetchTimeoutError(url, timeoutMs);
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener("abort", onCallerAbort);
  }
}
