import { afterEach, describe, expect, it, vi } from "vitest";

const getAllProducts = vi.fn();

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
  ProductService: {
    getAllProducts,
    searchProducts: vi.fn(),
    getProductsByCategory: vi.fn(),
    getFeaturedProducts: vi.fn(),
  },
}));

const adminLocals = { user: { id: "admin-1", role: "admin" } };

/**
 * T-07: the public customer site never calls these routes (it reads the catalogue from its own
 * Supabase client), so the full product payload — purchase cost, supplier, stock — stays admin only.
 */
describe("product listing authorization (T-07)", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects GET /api/products without a session before any catalogue query", async () => {
    const { GET } = await import("../index");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/products?limit=10",
    );

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(getAllProducts).not.toHaveBeenCalled();
  });

  it("rejects GET /api/products/simple without a session before any catalogue query", async () => {
    const { GET } = await import("../simple");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/products/simple?limit=10",
    );

    const response = await GET({ request, locals: {} } as never);

    expect(response.status).toBe(401);
    expect(getAllProducts).not.toHaveBeenCalled();
  });

  it("keeps the authenticated listing for admin callers", async () => {
    getAllProducts.mockResolvedValue({
      products: [{ id: 1, name: "Lente", price: 1000 }],
      total: 1,
    });
    const { GET } = await import("../index");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/products?limit=10",
    );

    const response = await GET({
      request,
      url: new URL(request.url),
      locals: adminLocals,
    } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.data.products[0].id).toBe(1);
  });

  it("keeps the authenticated simple listing and does not open CORS to any origin", async () => {
    getAllProducts.mockResolvedValue({
      products: [
        {
          id: 1,
          name: "Lente",
          price: 1000,
          sku: "L1",
          stock_quantity: 2,
          featured_image_url: null,
          cost: 5,
        },
      ],
    });
    const { GET } = await import("../simple");
    const request = new Request(
      "https://dashboard.mariohans.cl/api/products/simple?limit=10",
    );

    const response = await GET({ request, locals: adminLocals } as never);
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("Access-Control-Allow-Origin")).toBeNull();
    expect(Object.keys(payload.data.products[0]).sort()).toEqual(
      [
        "featured_image_url",
        "id",
        "name",
        "price",
        "sku",
        "stock_quantity",
      ].sort(),
    );
  });
});
