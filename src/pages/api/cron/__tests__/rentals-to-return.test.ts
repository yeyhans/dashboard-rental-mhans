import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * The contract a Cloudflare Worker calls hourly: `POST` with `Authorization: Bearer <CRON_SECRET>`.
 * The route does its own auth; there is no admin session on a cron call.
 */
const moveExpiredRentalsToReturn = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/orderService", () => ({
  OrderService: { moveExpiredRentalsToReturn },
}));

function cronRequest(authorization?: string) {
  return new Request("https://dash.example.cl/api/cron/rentals-to-return", {
    method: "POST",
    headers: authorization ? { Authorization: authorization } : {},
  });
}

describe("POST /api/cron/rentals-to-return", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
  });

  it("answers 503 when CRON_SECRET is not configured", async () => {
    vi.stubEnv("CRON_SECRET", "");
    const { POST } = await import("../rentals-to-return");

    const response = await POST({ request: cronRequest("Bearer x") } as never);

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({
      success: false,
      error: "Cron no configurado",
    });
    expect(moveExpiredRentalsToReturn).not.toHaveBeenCalled();
  });

  it("answers 401 with a wrong token", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const { POST } = await import("../rentals-to-return");

    const response = await POST({
      request: cronRequest("Bearer not-the-secret"),
    } as never);

    expect(response.status).toBe(401);
    expect(moveExpiredRentalsToReturn).not.toHaveBeenCalled();
  });

  it("answers 401 without an Authorization header", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    const { POST } = await import("../rentals-to-return");

    const response = await POST({ request: cronRequest() } as never);

    expect(response.status).toBe(401);
    expect(moveExpiredRentalsToReturn).not.toHaveBeenCalled();
  });

  it("moves expired rentals using today's date in Chile and returns the result", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.useFakeTimers();
    // 02:30 UTC on Oct 14 is still Oct 13 in Santiago (UTC-3).
    vi.setSystemTime(new Date("2026-10-14T02:30:00Z"));
    moveExpiredRentalsToReturn.mockResolvedValue({ moved: 2, ids: [7, 9] });
    const { POST } = await import("../rentals-to-return");

    const response = await POST({
      request: cronRequest("Bearer cron-secret"),
    } as never);
    vi.useRealTimers();

    expect(response.status).toBe(200);
    expect(moveExpiredRentalsToReturn).toHaveBeenCalledWith("2026-10-13");
    await expect(response.json()).resolves.toEqual({
      success: true,
      data: { moved: 2, ids: [7, 9] },
    });
  });

  it("answers 500 with a generic message when the service fails", async () => {
    vi.stubEnv("CRON_SECRET", "cron-secret");
    vi.spyOn(console, "error").mockImplementation(() => {});
    moveExpiredRentalsToReturn.mockRejectedValue(new Error("db down"));
    const { POST } = await import("../rentals-to-return");

    const response = await POST({
      request: cronRequest("Bearer cron-secret"),
    } as never);

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain("db down");
  });
});
