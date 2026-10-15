import { afterEach, describe, expect, it, vi } from "vitest";

const getProductById = vi.fn();
const updateProduct = vi.fn();

vi.mock("../../../../middleware/auth", () => ({
  withAuth:
    (handler: (context: any) => Promise<Response>) => async (context: any) => {
      if (!context.locals?.user) {
        return new Response(
          JSON.stringify({ success: false, error: "No autorizado" }),
          { status: 401 },
        );
      }
      return handler(context);
    },
}));

vi.mock("../../../../services/productService", () => ({
  ProductService: { getProductById, updateProduct },
}));

const admin = {
  locals: { user: { id: "admin-1", email: "admin@x.cl", role: "admin" } },
};

function putRequest(body: unknown) {
  return new Request("https://dashboard.mariohans.cl/api/products/42", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function put(body: unknown) {
  const { PUT } = await import("../[id]");
  return PUT({
    request: putRequest(body),
    params: { id: "42" },
    ...admin,
  } as never);
}

/**
 * PUT /api/products/[id] with the jsonb array columns (categories_ids, images, tags, related_ids).
 * Clients may send them as arrays or as JSON-encoded strings; both must reach the service as
 * arrays, and category ids are always stored as strings.
 */
describe("PUT /api/products/[id] — array fields", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("stores numeric category ids as strings", async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });

    const response = await put({ categories_ids: [3, "7"] });

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ categories_ids: ["3", "7"] }),
    );
  });

  it("parses JSON-encoded array strings", async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });

    const response = await put({ categories_ids: "[5]", tags: '["flash"]' });

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ categories_ids: ["5"], tags: ["flash"] }),
    );
  });

  it("clears an array field sent as a blank string", async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });

    const response = await put({ related_ids: "  " });

    expect(response.status).toBe(200);
    expect(updateProduct).toHaveBeenCalledWith(
      42,
      expect.objectContaining({ related_ids: null }),
    );
  });

  it.each([
    ["malformed JSON", { images: "[oops" }],
    ["a JSON value that is not an array", { tags: '{"a":1}' }],
    ["a non-string, non-array value", { related_ids: 12 }],
    ["an invalid category id", { categories_ids: [{ id: 1 }] }],
  ])("rejects %s with a 400 and does not update", async (_label, body) => {
    getProductById.mockResolvedValue({ id: 42 });

    const response = await put(body);
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.success).toBe(false);
    expect(updateProduct).not.toHaveBeenCalled();
  });

  it("keeps validating valuation fields alongside array fields", async () => {
    getProductById.mockResolvedValue({ id: 42 });
    updateProduct.mockResolvedValue({ id: 42 });

    const response = await put({
      categories_ids: [1],
      declared_quantity: "4",
      total_value_clp: 999,
    });

    expect(response.status).toBe(200);
    const [, updates] = updateProduct.mock.calls[0];
    expect(updates).toMatchObject({
      categories_ids: ["1"],
      declared_quantity: 4,
    });
    expect(updates).not.toHaveProperty("total_value_clp");
  });
});
