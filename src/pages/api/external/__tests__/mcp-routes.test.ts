import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryError, UNIT_ERRORS } from "../../../../lib/inventoryUnits";

const updateAsset = vi.fn();
const createUnit = vi.fn();
const updateDescription = vi.fn();

vi.mock("../../../../services/serialisedAssetService", () => ({
  SerialisedAssetService: { updateAsset, createUnit },
}));
vi.mock("../../../../services/productService", () => ({
  ProductService: { updateDescription },
}));

const SECRET = "mcp-secret";

function req(
  method: string,
  url: string,
  apiKey: string | null,
  body?: unknown,
): Request {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey !== null) headers["X-API-Key"] = apiKey;
  return new Request(`https://dashboard.mariohans.cl${url}`, {
    method,
    headers,
    body:
      body === undefined
        ? undefined
        : typeof body === "string"
          ? body
          : JSON.stringify(body),
  });
}

type Handler = (ctx: never) => Promise<Response>;

const routes = {
  description: {
    file: "products/[id]/description.ts",
    load: async () =>
      (await import("../products/[id]/description")).PUT as Handler,
    url: "/api/external/products/16/description",
    method: "PUT",
    params: { id: "16" },
    validBody: {
      short_description: "Cámara <b>full frame</b>",
      description: "Detalle largo",
    },
    service: updateDescription,
  },
  unitUpdate: {
    file: "inventory/units/[id].ts",
    load: async () => (await import("../inventory/units/[id]")).PUT as Handler,
    url: "/api/external/inventory/units/5",
    method: "PUT",
    params: { id: "5" },
    validBody: {
      row_version: 4,
      acquisition_cost: 900000,
      purchase_date: "2026-01-15",
    },
    service: updateAsset,
  },
  unitCreate: {
    file: "inventory/units/index.ts",
    load: async () =>
      (await import("../inventory/units/index")).POST as Handler,
    url: "/api/external/inventory/units",
    method: "POST",
    params: {},
    validBody: { product_id: 16, serial_number: "SN-1", location_id: "loc-1" },
    service: createUnit,
  },
} as const;

async function call(
  name: keyof typeof routes,
  apiKey: string | null,
  body: unknown = routes[name].validBody,
  params: Record<string, string> = routes[name].params,
) {
  const route = routes[name];
  const handler = await route.load();
  return handler({
    request: req(route.method, route.url, apiKey, body),
    params,
  } as never);
}

beforeEach(() => {
  vi.stubEnv("MCP_API_SECRET", SECRET);
  vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
  updateDescription.mockResolvedValue({
    id: 16,
    short_description: "Cámara full frame",
  });
  updateAsset.mockResolvedValue({ id: 5, row_version: 5 });
  createUnit.mockResolvedValue({ id: 9, row_version: 1 });
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe.each(Object.keys(routes) as Array<keyof typeof routes>)(
  "MCP route %s",
  (name) => {
    const route = routes[name];

    it("answers 401 without a key and never calls the Service", async () => {
      const response = await call(name, null);
      expect(response.status).toBe(401);
      expect(await response.json()).toEqual({
        success: false,
        error: "No autorizado",
      });
      expect(route.service).not.toHaveBeenCalled();
    });

    it("answers 401 with a wrong key, with the same body as a missing key", async () => {
      const missing = await (await call(name, null)).text();
      const response = await call(name, "wrong-key");
      expect(response.status).toBe(401);
      expect(await response.text()).toBe(missing);
      expect(route.service).not.toHaveBeenCalled();
    });

    it("rejects the FRONTEND_API_SECRET", async () => {
      const response = await call(name, "frontend-secret");
      expect(response.status).toBe(401);
      expect(route.service).not.toHaveBeenCalled();
    });

    it("answers 200/201 with { success, data } for the right key and writes through the Service", async () => {
      const response = await call(name, SECRET);
      expect([200, 201]).toContain(response.status);
      const json = await response.json();
      expect(json.success).toBe(true);
      expect(json.data).toBeDefined();
      expect(route.service).toHaveBeenCalledTimes(1);
    });

    it("answers 400 for malformed JSON", async () => {
      const response = await call(name, SECRET, "{not json");
      expect(response.status).toBe(400);
      expect((await response.json()).success).toBe(false);
      expect(route.service).not.toHaveBeenCalled();
    });

    it("contains no direct .from( query in the route source", () => {
      const source = readFileSync(resolve(__dirname, "..", route.file), "utf8");
      expect(source).not.toContain(".from(");
      expect(source).not.toContain("supabaseAdmin");
    });
  },
);

describe("PUT /api/external/products/[id]/description", () => {
  it("passes both fields to ProductService and returns the product", async () => {
    const response = await call("description", SECRET);
    expect(updateDescription).toHaveBeenCalledWith(16, {
      short_description: "Cámara <b>full frame</b>",
      description: "Detalle largo",
    });
    expect((await response.json()).data).toEqual({
      id: 16,
      short_description: "Cámara full frame",
    });
  });

  it.each([
    ["non-numeric id", { short_description: "x" }, { id: "abc" }],
    ["zero id", { short_description: "x" }, { id: "0" }],
    ["no fields", {}, { id: "16" }],
    ["non-string field", { description: 42 }, { id: "16" }],
    ["unknown field only", { name: "hack" }, { id: "16" }],
  ])("answers 400 for %s", async (_label, body, params) => {
    const response = await call("description", SECRET, body, params);
    expect(response.status).toBe(400);
    expect(updateDescription).not.toHaveBeenCalled();
  });

  it("answers 404 when the product does not exist", async () => {
    updateDescription.mockResolvedValue(null);
    const response = await call("description", SECRET);
    expect(response.status).toBe(404);
  });

  it("answers a generic 500 without leaking the internal error", async () => {
    updateDescription.mockRejectedValue(
      new Error('relation "products" secret detail'),
    );
    const response = await call("description", SECRET);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "secret detail",
    );
  });
});

describe("PUT /api/external/inventory/units/[id]", () => {
  it("forwards the patch and the expected row_version to the Service", async () => {
    await call("unitUpdate", SECRET);
    expect(updateAsset).toHaveBeenCalledWith(
      5,
      { acquisition_cost: 900000, purchase_date: "2026-01-15" },
      4,
    );
  });

  it.each([
    ["bad id", { row_version: 1, notes: "x" }, { id: "x" }],
    ["missing row_version", { notes: "x" }, { id: "5" }],
    ["non-integer row_version", { row_version: 1.5, notes: "x" }, { id: "5" }],
    ["no editable field", { row_version: 1 }, { id: "5" }],
    ["location change", { row_version: 1, location_id: "loc-2" }, { id: "5" }],
  ])("answers 400 for %s", async (_label, body, params) => {
    const response = await call("unitUpdate", SECRET, body, params);
    expect(response.status).toBe(400);
    expect(updateAsset).not.toHaveBeenCalled();
  });

  it("answers 409 when the Service reports a version conflict", async () => {
    updateAsset.mockRejectedValue(
      new InventoryError(UNIT_ERRORS.CONFLICT, 409),
    );
    const response = await call("unitUpdate", SECRET);
    expect(response.status).toBe(409);
    expect((await response.json()).error).toBe(UNIT_ERRORS.CONFLICT);
  });

  it("answers 404 when the Service reports a missing unit", async () => {
    updateAsset.mockRejectedValue(
      new InventoryError(UNIT_ERRORS.NOT_FOUND, 404),
    );
    const response = await call("unitUpdate", SECRET);
    expect(response.status).toBe(404);
  });

  it("answers 400 when the Service rejects a value (valuation)", async () => {
    updateAsset.mockRejectedValue(
      new InventoryError(
        "El costo de adquisición debe ser un número no negativo",
        400,
      ),
    );
    const response = await call("unitUpdate", SECRET, {
      row_version: 4,
      acquisition_cost: -5,
    });
    expect(response.status).toBe(400);
  });
});

describe("POST /api/external/inventory/units", () => {
  it("creates through the Service and answers 201", async () => {
    const response = await call("unitCreate", SECRET);
    expect(response.status).toBe(201);
    expect(createUnit).toHaveBeenCalledWith({
      product_id: 16,
      serial_number: "SN-1",
      location_id: "loc-1",
    });
  });

  it.each([
    ["missing product_id", { serial_number: "SN-1" }],
    ["non-integer product_id", { product_id: "16" }],
    ["negative product_id", { product_id: -1 }],
  ])("answers 400 for %s", async (_label, body) => {
    const response = await call("unitCreate", SECRET, body);
    expect(response.status).toBe(400);
    expect(createUnit).not.toHaveBeenCalled();
  });

  it("answers 409 when the Service reports a duplicate serial", async () => {
    createUnit.mockRejectedValue(
      new InventoryError(UNIT_ERRORS.SERIAL_TAKEN, 409),
    );
    const response = await call("unitCreate", SECRET);
    expect(response.status).toBe(409);
  });

  it("never forwards fields outside the allowlist", async () => {
    await call("unitCreate", SECRET, {
      product_id: 16,
      asset_tag: "MH-99999",
      id: 77,
      row_version: 9,
    });
    expect(createUnit).toHaveBeenCalledWith({ product_id: 16 });
  });
});
