import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FetchTimeoutError, fetchWithTimeout } from "../fetchWithTimeout";
import { apiErrorMessage } from "../apiError";

/**
 * D-4 (A-03). Saving the status "Completado" hung the tab on "Guardando...": the order update
 * route awaits an internal email request that itself awaits a worker request, and none of the
 * three hops had a timeout, so a slow or dead hop meant the browser waited for ever.
 */
function hangingFetch() {
  return vi.fn((_url: string, init?: RequestInit) => {
    return new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () =>
        reject(init.signal?.reason ?? new Error("aborted")),
      );
    });
  });
}

describe("fetchWithTimeout", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("rejects with FetchTimeoutError when the request never answers", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const pending = fetchWithTimeout(
      "https://example.test/x",
      { method: "POST" },
      5_000,
    );
    const assertion = expect(pending).rejects.toBeInstanceOf(FetchTimeoutError);

    await vi.advanceTimersByTimeAsync(5_000);
    await assertion;
  });

  it("does not abort before the deadline", async () => {
    const fetchMock = hangingFetch();
    vi.stubGlobal("fetch", fetchMock);
    let settled = false;
    fetchWithTimeout("https://example.test/x", {}, 5_000).catch(() => {
      settled = true;
    });

    await vi.advanceTimersByTimeAsync(4_999);
    expect(settled).toBe(false);
  });

  it("returns the response and leaves no timer behind when the request answers in time", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("ok", { status: 200 })),
    );
    const response = await fetchWithTimeout(
      "https://example.test/x",
      {},
      5_000,
    );

    expect(response.status).toBe(200);
    expect(vi.getTimerCount()).toBe(0);
  });

  it("propagates a network error unchanged and clears the timer", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => Promise.reject(new TypeError("network down"))),
    );

    await expect(
      fetchWithTimeout("https://example.test/x", {}, 5_000),
    ).rejects.toThrow("network down");
    expect(vi.getTimerCount()).toBe(0);
  });

  it("honours a caller signal that aborts first", async () => {
    vi.stubGlobal("fetch", hangingFetch());
    const controller = new AbortController();
    const pending = fetchWithTimeout(
      "https://example.test/x",
      { signal: controller.signal },
      5_000,
    );
    const assertion =
      expect(pending).rejects.not.toBeInstanceOf(FetchTimeoutError);

    controller.abort(new Error("caller gave up"));
    await assertion;
  });
});

describe("apiErrorMessage", () => {
  it("prefers `error`, then `message`, then the fallback", () => {
    expect(apiErrorMessage({ error: "a", message: "b" }, "f")).toBe("a");
    expect(apiErrorMessage({ message: "b" }, "f")).toBe("b");
    expect(apiErrorMessage({}, "f")).toBe("f");
    expect(apiErrorMessage(null, "f")).toBe("f");
    expect(apiErrorMessage({ error: "  " }, "f")).toBe("f");
    expect(apiErrorMessage({ error: 42 }, "f")).toBe("f");
  });
});
