import { readFileSync } from "fs";
import path from "path";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createShippingLine,
  fetchEnabledShippingMethods,
  validateShippingMethod,
  type ShippingMethod,
} from "../orderShipping";

const method: ShippingMethod = {
  id: 7,
  name: "Despacho Santiago",
  description: null,
  cost: "15000",
  shipping_type: "flat_rate",
  enabled: true,
  min_amount: "50000",
  max_amount: null,
  estimated_days_min: "1",
  estimated_days_max: "2",
  requires_address: true,
  requires_phone: false,
  metadata: {},
  created_at: "2026-10-01T00:00:00Z",
  updated_at: "2026-10-01T00:00:00Z",
  created_by: null,
};

describe("orderShipping (T-05)", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("loads enabled methods through the protected API with the session cookie", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ shippingMethods: [method], total: 1 }), {
          status: 200,
        }),
    );
    vi.stubGlobal("fetch", fetchMock);

    const methods = await fetchEnabledShippingMethods();

    expect(methods).toEqual([method]);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [
      string,
      RequestInit,
    ];
    expect(url).toBe("/api/shipping/methods?enabled=true&page=1&limit=100");
    expect(init.credentials).toBe("include");
  });

  it("fails with a Spanish message when the API rejects the request", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("{}", { status: 401 })),
    );

    await expect(fetchEnabledShippingMethods()).rejects.toThrow(
      "No se pudieron cargar los métodos de envío",
    );
  });

  it("keeps the shipping line and validation rules", () => {
    expect(createShippingLine(method)).toMatchObject({
      method_id: 7,
      method_title: "Despacho Santiago",
      total: "15000",
      meta_data: { estimated_delivery: "1-2 días", tracking_number: null },
    });
    expect(validateShippingMethod(method, 10000).isValid).toBe(false);
    expect(validateShippingMethod(method, 60000).isValid).toBe(true);
  });

  it("is safe for the browser: no Supabase client", () => {
    const source = readFileSync(
      path.resolve(__dirname, "../orderShipping.ts"),
      "utf8",
    );
    expect(source).not.toMatch(/supabase/i);
  });
});
