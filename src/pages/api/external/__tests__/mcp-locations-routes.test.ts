import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { InventoryError, UNIT_ERRORS } from "../../../../lib/inventoryUnits";

const createLocation = vi.fn();
const updateLocation = vi.fn();
const listLocations = vi.fn();
const relocateAsset = vi.fn();

vi.mock("../../../../services/warehouseLocationService", () => ({
  WarehouseLocationService: {
    create: createLocation,
    update: updateLocation,
    list: listLocations,
  },
}));
vi.mock("../../../../services/assetRelocationService", () => ({
  AssetRelocationService: { relocateAsset },
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
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

async function call(
  handler: (ctx: {
    request: Request;
    params: Record<string, string>;
  }) => Promise<Response>,
  request: Request,
  params: Record<string, string> = {},
) {
  const response = await handler({ request, params });
  return { status: response.status, body: await response.json() };
}

const locationsRoute = () => import("../warehouse/locations/index");
const locationByIdRoute = () => import("../warehouse/locations/[id]");
const relocateRoute = () => import("../inventory/units/[id]/relocate");

beforeEach(() => {
  vi.stubEnv("MCP_API_SECRET", SECRET);
  vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
});

describe("external warehouse locations: auth", () => {
  it("answers 401 without the MCP key, before reading the body", async () => {
    const { POST } = await locationsRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/warehouse/locations", "wrong", {
        code: "E-2",
      }),
    );
    expect(res.status).toBe(401);
    expect(createLocation).not.toHaveBeenCalled();
  });

  it("does not accept the frontend key for MCP writes", async () => {
    const { POST } = await locationsRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/warehouse/locations", "frontend-secret", {
        code: "E-2",
      }),
    );
    expect(res.status).toBe(401);
  });
});

describe("external warehouse locations: list and create", () => {
  it("lists active locations", async () => {
    listLocations.mockResolvedValue([{ id: "1", code: "E-1" }]);
    const { GET } = await locationsRoute();
    const res = await call(
      GET,
      req("GET", "/api/external/warehouse/locations", SECRET),
    );
    expect(res.status).toBe(200);
    expect(res.body.data).toEqual([{ id: "1", code: "E-1" }]);
  });

  it("creates one location and returns 201", async () => {
    createLocation.mockResolvedValue({
      location: { id: "9", code: "E-2" },
      warnings: [],
    });
    const { POST } = await locationsRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/warehouse/locations", SECRET, {
        code: "E-2",
        kind: "shelf",
      }),
    );
    expect(res.status).toBe(201);
    expect(createLocation).toHaveBeenCalledWith(
      { code: "E-2", kind: "shelf" },
      null,
    );
  });

  it("reports a batch item by item: created and refused, without stopping", async () => {
    createLocation
      .mockResolvedValueOnce({
        location: { id: "1", code: "E-1" },
        warnings: [],
      })
      .mockRejectedValueOnce(new InventoryError("El código ya existe", 409));
    const { POST } = await locationsRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/warehouse/locations", SECRET, {
        locations: [{ code: "E-1" }, { code: "E-1" }],
      }),
    );
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(false);
    expect(res.body.data.creadas).toBe(1);
    expect(res.body.data.fallidas).toBe(1);
    expect(res.body.data.resultados[1]).toMatchObject({
      index: 1,
      ok: false,
      status: 409,
    });
  });

  it("refuses a batch above the limit before writing anything", async () => {
    const { POST } = await locationsRoute();
    const many = Array.from({ length: 51 }, (_, i) => ({ code: `E-${i}` }));
    const res = await call(
      POST,
      req("POST", "/api/external/warehouse/locations", SECRET, {
        locations: many,
      }),
    );
    expect(res.status).toBe(400);
    expect(createLocation).not.toHaveBeenCalled();
  });
});

describe("external warehouse locations: update", () => {
  it("requires row_version", async () => {
    const { PUT } = await locationByIdRoute();
    const res = await call(
      PUT,
      req("PUT", "/api/external/warehouse/locations/1", SECRET, { name: "x" }),
      { id: "1" },
    );
    expect(res.status).toBe(400);
    expect(updateLocation).not.toHaveBeenCalled();
  });

  it("passes row_version as the guard and keeps it out of the draft", async () => {
    updateLocation.mockResolvedValue({ location: { id: "1" }, warnings: [] });
    const { PUT } = await locationByIdRoute();
    await call(
      PUT,
      req("PUT", "/api/external/warehouse/locations/1", SECRET, {
        name: "Estante E",
        row_version: 3,
      }),
      { id: "1" },
    );
    expect(updateLocation).toHaveBeenCalledWith(
      "1",
      { name: "Estante E" },
      3,
      null,
    );
  });

  it("answers 409 when the version moved on", async () => {
    updateLocation.mockRejectedValue(
      new InventoryError("La ubicación fue modificada", 409),
    );
    const { PUT } = await locationByIdRoute();
    const res = await call(
      PUT,
      req("PUT", "/api/external/warehouse/locations/1", SECRET, {
        name: "x",
        row_version: 1,
      }),
      { id: "1" },
    );
    expect(res.status).toBe(409);
  });
});

describe("external unit relocation", () => {
  it("moves the unit with source mcp and the operator's row_version", async () => {
    relocateAsset.mockResolvedValue({
      relocation: { id: 7 },
      unit: { id: 5, row_version: 4 },
    });
    const { POST } = await relocateRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/inventory/units/5/relocate", SECRET, {
        to_location_id: "loc-2",
        row_version: 3,
        notes: "Estante E",
      }),
      { id: "5" },
    );
    expect(res.status).toBe(200);
    expect(relocateAsset).toHaveBeenCalledWith({
      assetId: 5,
      toLocationId: "loc-2",
      movedByUserId: null,
      source: "mcp",
      expectedRowVersion: 3,
      notes: "Estante E",
    });
  });

  it("requires row_version before touching anything", async () => {
    const { POST } = await relocateRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/inventory/units/5/relocate", SECRET, {
        to_location_id: "loc-2",
      }),
      { id: "5" },
    );
    expect(res.status).toBe(400);
    expect(relocateAsset).not.toHaveBeenCalled();
  });

  it("answers 409 with the service's message when the unit changed", async () => {
    relocateAsset.mockRejectedValue(
      new InventoryError(UNIT_ERRORS.CONFLICT, 409),
    );
    const { POST } = await relocateRoute();
    const res = await call(
      POST,
      req("POST", "/api/external/inventory/units/5/relocate", SECRET, {
        to_location_id: "loc-2",
        row_version: 3,
      }),
      { id: "5" },
    );
    expect(res.status).toBe(409);
    expect(res.body.error).toBe(UNIT_ERRORS.CONFLICT);
  });
});
