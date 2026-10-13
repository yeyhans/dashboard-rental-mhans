import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * H-3: `POST /api/orders` reports the non-fatal warning of the save (e.g. migration 0019 not
 * applied, so the discount percentage was not stored) instead of dropping it.
 */
const createOrderDetailed = vi.hoisted(() => vi.fn());

vi.mock("../../../../services/orderService", () => ({
  OrderService: {
    createOrder: vi.fn(),
    createOrderDetailed,
    getAllOrders: vi.fn(),
    getOrderStats: vi.fn(),
  },
}));

const sendForOrder = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ sent: boolean; warning?: string }> => ({ sent: true }),
  ),
);
vi.mock("../../../../services/transactionalEmailService", () => ({
  TransactionalEmailService: { sendForOrder },
}));

vi.mock("../../../../lib/serverApiAuth", () => ({
  isFrontendApiKeyOrAdmin: vi.fn(async () => true),
  validateFrontendApiKey: vi.fn(() => false),
  unauthorizedResponse: () => new Response("{}", { status: 401 }),
}));

function postOrder() {
  const href = "https://dashboard.mariohans.cl/api/orders";
  return {
    request: new Request(href, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        customer_id: 42,
        billing_email: "c@x.cl",
        status: "request",
      }),
    }),
    url: new URL(href),
  } as never;
}

beforeEach(() => {
  vi.resetModules();
  vi.stubEnv("PUBLIC_SUPABASE_URL", "https://project.supabase.co");
  vi.stubEnv("PUBLIC_SUPABASE_ANON_KEY", "anon-key");
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "service-key");
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.clearAllMocks();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe("POST /api/orders — save warning (H-3)", () => {
  it("returns 201 with the warning when the service reports one", async () => {
    createOrderDetailed.mockResolvedValue({
      order: { id: 1, status: "request" },
      warning: "falta aplicar la migración 0019",
    });
    const { POST } = await import("../index");

    const response = await POST(postOrder());

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toMatchObject({ success: true, data: { id: 1 } });
    expect(body.warning).toContain("0019");
  });

  it("has no warning key on a clean save", async () => {
    createOrderDetailed.mockResolvedValue({
      order: { id: 1, status: "request" },
    });
    const { POST } = await import("../index");

    const body = await (await POST(postOrder())).json();
    expect(body).not.toHaveProperty("warning");
  });
});

/** R-09d: a new order sends "Solicitud recibida" (03) once, after the insert, best effort. */
describe("POST /api/orders — Solicitud email (R-09d)", () => {
  it("sends solicitud-recibida for the created order", async () => {
    const order = { id: 9, status: "request", billing_email: "c@x.cl" };
    createOrderDetailed.mockResolvedValue({ order });
    const { POST } = await import("../index");

    const response = await POST(postOrder());

    expect(response.status).toBe(201);
    expect(sendForOrder).toHaveBeenCalledTimes(1);
    expect(sendForOrder).toHaveBeenCalledWith("solicitud-recibida", order);
  });

  it("keeps the 201 and reports a failed email as a warning", async () => {
    createOrderDetailed.mockResolvedValue({
      order: { id: 9, status: "request" },
      warning: "falta aplicar la migración 0019",
    });
    sendForOrder.mockResolvedValueOnce({
      sent: false,
      warning: "No se pudo enviar el correo.",
    });
    const { POST } = await import("../index");

    const response = await POST(postOrder());
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.warning).toContain("0019");
    expect(body.warning).toContain("No se pudo enviar el correo.");
  });
});
