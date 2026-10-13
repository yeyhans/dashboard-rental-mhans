import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * `POST /api/order/generate-processing-pdf` had no auth and wrote `orders` with the service role.
 * It now runs behind `withAuth` and delegates to `OrderLifecycleService.generateRentalContract`,
 * the same generator the `in-rental` transition uses.
 *
 * Lives under `services/__tests__` because the route's own `__tests__` folder is outside this
 * change's edit surface.
 */
const generateRentalContract = vi.hoisted(() => vi.fn());

vi.mock("../../middleware/auth", () => ({
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

vi.mock("../orderLifecycleService", () => ({
  OrderLifecycleService: { generateRentalContract },
}));

function post(body: unknown, user: unknown = { id: "admin-1" }) {
  return {
    request: new Request(
      "https://dash.example.cl/api/order/generate-processing-pdf",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    ),
    locals: user ? { user } : {},
  } as never;
}

describe("POST /api/order/generate-processing-pdf", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("rejects an unauthenticated caller before generating anything", async () => {
    const { POST } = await import(
      "../../pages/api/order/generate-processing-pdf"
    );

    const response = await POST(post({ order_id: 42 }, null));

    expect(response.status).toBe(401);
    expect(generateRentalContract).not.toHaveBeenCalled();
  });

  it("delegates to the lifecycle generator and returns the stored URL", async () => {
    generateRentalContract.mockResolvedValue("https://r2/c.pdf");
    const { POST } = await import(
      "../../pages/api/order/generate-processing-pdf"
    );

    const response = await POST(post({ order_id: 42 }));

    expect(response.status).toBe(200);
    expect(generateRentalContract).toHaveBeenCalledWith(42);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        pdf_url: "https://r2/c.pdf",
        pdfUrl: "https://r2/c.pdf",
      }),
    );
  });

  it("accepts the legacy nested orderData shape", async () => {
    generateRentalContract.mockResolvedValue("https://r2/c.pdf");
    const { POST } = await import(
      "../../pages/api/order/generate-processing-pdf"
    );

    await POST(post({ orderData: { order_id: "42" } }));

    expect(generateRentalContract).toHaveBeenCalledWith(42);
  });

  it("answers 400 for a missing or invalid order id", async () => {
    const { POST } = await import(
      "../../pages/api/order/generate-processing-pdf"
    );

    const response = await POST(post({ order_id: "abc" }));

    expect(response.status).toBe(400);
    expect(generateRentalContract).not.toHaveBeenCalled();
  });

  it("hides the internal error on a failed generation", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    generateRentalContract.mockRejectedValue(new Error("R2 secret leaked?"));
    const { POST } = await import(
      "../../pages/api/order/generate-processing-pdf"
    );

    const response = await POST(post({ order_id: 42 }));

    expect(response.status).toBe(500);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(JSON.stringify(body)).not.toContain("R2 secret");
  });
});
