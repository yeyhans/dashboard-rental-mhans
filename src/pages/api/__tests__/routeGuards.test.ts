import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * B-2 (PG-01 / S-04 / UI-01, audit 2026-10-14): handlers that answered without any session.
 *
 * - `POST /api/orders/check-conflicts` returned the conflicting orders with customer names,
 *   e-mails and phones to anyone who POSTed a product id and a date range.
 * - `GET|POST /api/coupons/validate/[code]` let anyone probe coupon codes and per-customer usage.
 * - `GET /api/products/search` returned `products.*` (internal fields included); nothing calls it.
 *
 * Every caller is a dashboard island fetching same-origin with the admin cookies, so wrapping the
 * handlers in `withAuth` keeps them working.
 */
const resolveAdminSession = vi.fn();
const adminFrom = vi.fn();
const validateCoupon = vi.fn();
const searchProducts = vi.fn();

vi.mock("../../../lib/supabase", () => ({
  resolveAdminSession: (...args: unknown[]) => resolveAdminSession(...args),
  supabaseAdmin: { from: (...args: unknown[]) => adminFrom(...args) },
}));

vi.mock("../../../services/couponService", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  CouponService: {
    validateCoupon: (...args: unknown[]) => validateCoupon(...args),
  },
}));

vi.mock("../../../services/productService", async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  ProductService: {
    searchProducts: (...args: unknown[]) => searchProducts(...args),
  },
}));

function context(
  method: string,
  path: string,
  body?: unknown,
  params: Record<string, string> = {},
) {
  const href = `https://dash.test${path}`;
  return {
    params,
    url: new URL(href),
    request: new Request(href, {
      method,
      headers: { "Content-Type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    }),
    cookies: { get: () => undefined, set: () => {}, delete: () => {} },
    locals: {},
  };
}

beforeEach(() => {
  resolveAdminSession.mockReset();
  resolveAdminSession.mockResolvedValue({ session: null, inactive: false });
  adminFrom.mockReset();
  validateCoupon.mockReset();
  searchProducts.mockReset();
});

describe("unauthenticated requests are refused before any read", () => {
  it("POST /api/orders/check-conflicts", async () => {
    const { POST } = await import("../orders/check-conflicts");
    const response = await POST(
      context("POST", "/api/orders/check-conflicts", {
        currentOrderId: 1,
        productIds: [1],
        startDate: "2026-10-20",
        endDate: "2026-10-21",
      }) as never,
    );

    expect(response.status).toBe(401);
    expect(adminFrom).not.toHaveBeenCalled();
  });

  it("GET /api/coupons/validate/[code]", async () => {
    const { GET } = await import("../coupons/validate/[code]");
    const response = await GET(
      context(
        "GET",
        "/api/coupons/validate/PROMO?subtotal=1000&userId=5",
        undefined,
        { code: "PROMO" },
      ) as never,
    );

    expect(response.status).toBe(401);
    expect(validateCoupon).not.toHaveBeenCalled();
  });

  it("POST /api/coupons/validate/[code]", async () => {
    const { POST } = await import("../coupons/validate/[code]");
    const response = await POST(
      context(
        "POST",
        "/api/coupons/validate/PROMO",
        { userId: 5, cartTotal: 1000 },
        { code: "PROMO" },
      ) as never,
    );

    expect(response.status).toBe(401);
    expect(validateCoupon).not.toHaveBeenCalled();
  });

  it("GET /api/products/search", async () => {
    const { GET } = await import("../products/search");
    const response = await GET(
      context("GET", "/api/products/search?search=canon") as never,
    );

    expect(response.status).toBe(401);
    expect(searchProducts).not.toHaveBeenCalled();
  });
});

describe("POST /api/orders/check-conflicts — failures do not leak internals", () => {
  it("returns a generic message on an internal error", async () => {
    resolveAdminSession.mockResolvedValue({
      session: {
        user: { id: "auth-uid", email: "a@test.cl" },
        admin: {
          id: 1,
          user_id: "auth-uid",
          email: "a@test.cl",
          role: "admin",
          is_active: true,
          created_at: "",
        },
      },
      inactive: false,
    });
    adminFrom.mockImplementation(() => {
      throw new Error('relation "orders" does not exist');
    });

    const { POST } = await import("../orders/check-conflicts");
    const response = await POST(
      context("POST", "/api/orders/check-conflicts", {
        currentOrderId: 1,
        productIds: [1],
        startDate: "2026-10-20",
        endDate: "2026-10-21",
      }) as never,
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(JSON.stringify(body)).not.toContain('relation "orders"');
  });
});
