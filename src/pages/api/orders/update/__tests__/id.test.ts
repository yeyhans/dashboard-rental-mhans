import { afterEach, describe, expect, it, vi } from "vitest";

const updateOrder = vi.fn();
const from = vi.fn();
const priceOrderUpdate = vi.hoisted(() =>
  vi.fn(async (): Promise<unknown> => null),
);

vi.mock("../../../../../services/orderPricingService", () => ({
  OrderPricingService: { priceOrderUpdate },
}));

vi.mock("../../../../../middleware/auth", () => ({
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

vi.mock("../../../../../services/orderService", () => ({
  OrderService: { updateOrder },
}));

vi.mock("../../../../../lib/supabase", () => ({
  supabaseAdmin: { from },
}));

const onStatusChanged = vi.hoisted(() =>
  vi.fn(
    async (): Promise<{ generated: boolean; warning?: string }> => ({
      generated: false,
    }),
  ),
);

vi.mock("../../../../../services/orderLifecycleService", () => ({
  OrderLifecycleService: { onStatusChanged },
}));

describe("admin order update relay boundary", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("rejects unauthenticated requests before body parsing, order update, or email relay", async () => {
    const json = vi.fn(async () => ({ status: "completed" }));
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        body: "{}",
      },
    );
    Object.defineProperty(request, "json", { value: json });
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request,
      locals: {},
    } as never);

    expect(response.status).toBe(401);
    expect(json).not.toHaveBeenCalled();
    expect(updateOrder).not.toHaveBeenCalled();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("preserves authenticated admin status updates and notification relay behavior", async () => {
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    const currentOrder = {
      id: 123,
      status: "processing",
      billing_email: "cliente@example.com",
    };
    const updatedOrder = { ...currentOrder, status: "completed" };
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: currentOrder, error: null }),
        }),
      }),
    });
    updateOrder.mockResolvedValue(updatedOrder);
    const fetchSpy = vi.fn(
      async () =>
        new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    vi.stubGlobal("fetch", fetchSpy);
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "completed" }),
      },
    );
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);
    expect(response.status).toBe(200);
    expect(updateOrder).toHaveBeenCalledWith(
      123,
      expect.objectContaining({ status: "completed" }),
    );
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://dashboard.mariohans.cl/api/emails/send-order-completed-notification",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "X-API-Key": "frontend-secret",
          "X-Request-ID": expect.any(String),
        }),
      }),
    );
  });

  it("still persists the status update and warns when the notification fails", async () => {
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    const currentOrder = {
      id: 123,
      status: "processing",
      billing_email: "cliente@example.com",
    };
    const updatedOrder = { ...currentOrder, status: "failed" };
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: currentOrder, error: null }),
        }),
      }),
    });
    updateOrder.mockResolvedValue(updatedOrder);
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("delivery failed", { status: 500 })),
    );
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "failed" }),
      },
    );
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);

    expect(response.status).toBe(200);
    expect(updateOrder).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toEqual(
      expect.objectContaining({
        success: true,
        warning: expect.stringContaining("correo"),
      }),
    );
  });

  /**
   * La reserva configurable por pedido (`orders.reserve_type` / `reserve_value`, migración 0008).
   *
   * `ProcessOrder.tsx:579` ya topaba el porcentaje a 100 en el cliente, pero el servidor no: la
   * regla del proyecto es que la validación del cliente es sólo UX. Sin este tope server-side, un
   * PUT con `percent: 500` pasaba el endpoint y lo rechazaba la CHECK de Postgres, devolviendo un
   * 500 con detalle interno en vez de un 400 en español.
   */
  describe("configuración de reserva", () => {
    function reserveRequest(body: unknown) {
      return new Request(
        "https://dashboard.mariohans.cl/api/orders/update/123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
    }

    const ctx = (request: Request) =>
      ({
        params: { id: "123" },
        request,
        locals: { user: { id: "admin-1" } },
      }) as never;

    it("rechaza un porcentaje mayor a 100 antes de tocar la base", async () => {
      const { PUT } = await import("../[id]");
      const response = await PUT(
        ctx(reserveRequest({ reserve_type: "percent", reserve_value: 500 })),
      );

      expect(response.status).toBe(400);
      expect(updateOrder).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("100"),
        }),
      );
    });

    it("rechaza un valor negativo", async () => {
      const { PUT } = await import("../[id]");
      const response = await PUT(
        ctx(reserveRequest({ reserve_type: "fixed", reserve_value: -1 })),
      );

      expect(response.status).toBe(400);
      expect(updateOrder).not.toHaveBeenCalled();
    });

    it("rechaza un reserve_type fuera del vocabulario", async () => {
      const { PUT } = await import("../[id]");
      const response = await PUT(
        ctx(reserveRequest({ reserve_type: "cuotas", reserve_value: 10 })),
      );

      expect(response.status).toBe(400);
      expect(updateOrder).not.toHaveBeenCalled();
    });

    it("exige el par completo: un valor sin su tipo no dice en qué unidad está", async () => {
      // Sin el tipo no se puede saber si 500 son "500%" (inválido) o "$500" (válido), y ambos
      // call sites del panel ya mandan los dos juntos.
      const { PUT } = await import("../[id]");
      const response = await PUT(ctx(reserveRequest({ reserve_value: 500 })));

      expect(response.status).toBe(400);
      expect(updateOrder).not.toHaveBeenCalled();
    });

    it("acepta un porcentaje válido y lo pasa al servicio", async () => {
      from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 123, status: "confirmed" },
              error: null,
            }),
          }),
        }),
      });
      updateOrder.mockResolvedValue({
        id: 123,
        reserve_type: "percent",
        reserve_value: 50,
      });
      const { PUT } = await import("../[id]");
      const response = await PUT(
        ctx(reserveRequest({ reserve_type: "percent", reserve_value: 50 })),
      );

      expect(response.status).toBe(200);
      expect(updateOrder).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ reserve_type: "percent", reserve_value: 50 }),
      );
    });

    it("acepta un monto fijo por encima de 100, que en CLP es legítimo", async () => {
      from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({
              data: { id: 123, status: "confirmed" },
              error: null,
            }),
          }),
        }),
      });
      updateOrder.mockResolvedValue({
        id: 123,
        reserve_type: "fixed",
        reserve_value: 180000,
      });
      const { PUT } = await import("../[id]");
      const response = await PUT(
        ctx(reserveRequest({ reserve_type: "fixed", reserve_value: 180000 })),
      );

      expect(response.status).toBe(200);
      expect(updateOrder).toHaveBeenCalledWith(
        123,
        expect.objectContaining({
          reserve_type: "fixed",
          reserve_value: 180000,
        }),
      );
    });
  });
  describe("recálculo de montos en el servidor", () => {
    const ctx = (body: unknown) =>
      ({
        params: { id: "123" },
        request: new Request(
          "https://dashboard.mariohans.cl/api/orders/update/123",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        locals: { user: { id: "admin-1" } },
      }) as never;

    const currentOrder = {
      id: 123,
      status: "confirmed",
      shipping_total: 0,
      calculated_total: 96390,
    };

    function stubCurrentOrder() {
      from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: currentOrder, error: null }),
          }),
        }),
      });
      updateOrder.mockResolvedValue(currentOrder);
    }

    it("persists the server figures and ignores the totals the client sent", async () => {
      stubCurrentOrder();
      const priced = {
        num_jornadas: 3,
        shipping_total: 15000,
        calculated_subtotal: 96000,
        calculated_discount: 0,
        calculated_iva: 18240,
        calculated_total: 114240,
        total: 114240,
      };
      priceOrderUpdate.mockResolvedValueOnce(priced);
      const { PUT } = await import("../[id]");

      const body = {
        shipping_total: 15000,
        calculated_total: 96390,
        calculated_iva: 15390,
        coupon_lines: [],
      };
      const response = await PUT(ctx(body));

      expect(response.status).toBe(200);
      expect(priceOrderUpdate).toHaveBeenCalledWith(currentOrder, body);
      expect(updateOrder).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ ...priced, coupon_lines: [] }),
      );
    });

    it("answers 400 when the order cannot be priced and does not write", async () => {
      stubCurrentOrder();
      const { PricingError } = await import("../../../../../lib/pricing");
      priceOrderUpdate.mockRejectedValueOnce(
        new PricingError("Número de jornadas inválido"),
      );
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ num_jornadas: 0 }));

      expect(response.status).toBe(400);
      expect(updateOrder).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual({
        success: false,
        error: "Número de jornadas inválido",
      });
    });
  });

  /**
   * El 500 devolvía `error.message` tal cual, filtrando detalle interno (nombres de columna,
   * mensajes de Postgres) al panel. La regla del proyecto: mensaje genérico en español al cliente
   * y el error completo sólo en el log del servidor.
   */
  it("hides internal error detail on a 500 and logs it with context", async () => {
    const currentOrder = {
      id: 123,
      status: "processing",
      billing_email: "cliente@example.com",
    };
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({ data: currentOrder, error: null }),
        }),
      }),
    });
    updateOrder.mockRejectedValue(
      new Error(
        'null value in column "calculated_total" violates not-null constraint',
      ),
    );
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const request = new Request(
      "https://dashboard.mariohans.cl/api/orders/update/123",
      {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_proyecto: "Sesión de catálogo" }),
      },
    );
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request,
      locals: { user: { id: "admin-1" } },
    } as never);
    const payload = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(500);
    expect(payload).toEqual({
      success: false,
      error: "Error al actualizar la orden",
    });
    expect(JSON.stringify(payload)).not.toContain("not-null constraint");
    expect(errorSpy).toHaveBeenCalledWith(
      "[PUT /api/orders/update/:id] Error al actualizar la orden:",
      expect.objectContaining({ orderId: "123" }),
    );
    errorSpy.mockRestore();
  });

  /**
   * T-02: este endpoint genérico copiaba `status` sin mirar la máquina de estados, así que el
   * formulario de edición podía saltar de `request` a `completed`. Aplica la misma regla que
   * `PUT /api/orders/[id]/status`.
   */
  describe("máquina de estados", () => {
    function stubOrderStatus(status: string) {
      from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 123, status }, error: null }),
          }),
        }),
      });
      updateOrder.mockResolvedValue({ id: 123 });
    }

    const ctx = (
      body: unknown,
      user: Record<string, unknown> = { id: "admin-1", role: "admin" },
    ) =>
      ({
        params: { id: "123" },
        request: new Request(
          "https://dashboard.mariohans.cl/api/orders/update/123",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        locals: { user },
      }) as never;

    it("rechaza con 409 un salto ilegal (request -> completed) sin escribir", async () => {
      stubOrderStatus("request");
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ status: "completed" }));

      expect(response.status).toBe(409);
      expect(updateOrder).not.toHaveBeenCalled();
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          success: false,
          error: expect.stringContaining("Transición de estado no permitida"),
        }),
      );
    });

    it("acepta el siguiente paso legal (request -> evaluation)", async () => {
      stubOrderStatus("request");
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ status: "evaluation" }));

      expect(response.status).toBe(200);
      expect(updateOrder).toHaveBeenCalledWith(
        123,
        expect.objectContaining({ status: "evaluation" }),
      );
    });

    it("acepta reenviar el mismo estado como no-op de la máquina", async () => {
      stubOrderStatus("preparation");
      const { PUT } = await import("../[id]");

      const response = await PUT(
        ctx({ status: "preparation", order_proyecto: "Rodaje" }),
      );

      expect(response.status).toBe(200);
      expect(updateOrder).toHaveBeenCalledTimes(1);
    });

    it("rechaza un estado fuera del vocabulario cuando la orden ya está en v1.2", async () => {
      stubOrderStatus("confirmed");
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ status: "on-hold" }));

      expect(response.status).toBe(409);
      expect(updateOrder).not.toHaveBeenCalled();
    });

    it("un operario no puede cancelar aunque la máquina lo permita", async () => {
      stubOrderStatus("confirmed");
      const { PUT } = await import("../[id]");

      const response = await PUT(
        ctx({ status: "cancelled" }, { id: "op-1", role: "operator" }),
      );

      expect(response.status).toBe(403);
      expect(updateOrder).not.toHaveBeenCalled();
    });
  });

  /**
   * R-14 on this route too: moving an order to `in-rental` from the edit form must generate the
   * contract exactly like the status route does, and a failure only adds a warning.
   */
  describe("efectos del ciclo de vida", () => {
    function stubOrder(status: string, saved: Record<string, unknown>) {
      from.mockReturnValue({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { id: 123, status }, error: null }),
          }),
        }),
      });
      updateOrder.mockResolvedValue(saved);
    }

    const ctx = (body: unknown) =>
      ({
        params: { id: "123" },
        request: new Request(
          "https://dashboard.mariohans.cl/api/orders/update/123",
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body),
          },
        ),
        locals: { user: { id: "admin-1", role: "admin" } },
      }) as never;

    it("entrega la orden guardada al servicio de ciclo de vida al pasar a in-rental", async () => {
      const saved = {
        id: 123,
        status: "in-rental",
        new_pdf_processing_url: null,
      };
      stubOrder("preparation", saved);
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ status: "in-rental" }));

      expect(response.status).toBe(200);
      expect(onStatusChanged).toHaveBeenCalledWith(saved, "in-rental");
    });

    it("mantiene el 200 y agrega el aviso si el contrato no se pudo generar", async () => {
      stubOrder("preparation", { id: 123, status: "in-rental" });
      onStatusChanged.mockResolvedValueOnce({
        generated: false,
        warning: "No se pudo generar el contrato",
      });
      const { PUT } = await import("../[id]");

      const response = await PUT(ctx({ status: "in-rental" }));

      expect(response.status).toBe(200);
      await expect(response.json()).resolves.toEqual(
        expect.objectContaining({
          success: true,
          warning: "No se pudo generar el contrato",
        }),
      );
    });

    it("no llama al ciclo de vida si el estado no cambió", async () => {
      stubOrder("in-rental", { id: 123, status: "in-rental" });
      const { PUT } = await import("../[id]");

      const response = await PUT(
        ctx({ status: "in-rental", order_proyecto: "Rodaje" }),
      );

      expect(response.status).toBe(200);
      expect(onStatusChanged).not.toHaveBeenCalled();
    });
  });
});

/** H-2 (R3): a lifecycle warning must not hide the notification warning, and vice versa. */
describe("avisos combinados", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
  });

  it("keeps both the email warning and the lifecycle warning", async () => {
    vi.stubEnv("FRONTEND_API_SECRET", "frontend-secret");
    from.mockReturnValue({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 123, status: "return" },
            error: null,
          }),
        }),
      }),
    });
    updateOrder.mockResolvedValue({ id: 123, status: "completed" });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 500 })),
    );
    onStatusChanged.mockResolvedValueOnce({
      generated: false,
      warning: "Aviso del ciclo de vida.",
    });
    vi.spyOn(console, "error").mockImplementation(() => {});
    const { PUT } = await import("../[id]");

    const response = await PUT({
      params: { id: "123" },
      request: new Request(
        "https://dashboard.mariohans.cl/api/orders/update/123",
        {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "completed" }),
        },
      ),
      locals: { user: { id: "admin-1", role: "admin" } },
    } as never);

    const body = await response.json();
    expect(response.status).toBe(200);
    expect(body.warning).toContain("correo");
    expect(body.warning).toContain("Aviso del ciclo de vida.");
  });
});
