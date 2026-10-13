import type { APIRoute } from "astro";
import { DRIVER_ERRORS } from "../../../../../lib/delivery";
import { withAuth } from "../../../../../middleware/auth";
import { DeliveryService } from "../../../../../services/deliveryService";

/**
 * R-06: the driver (conductor) of an order's shipment, read and written by ORDER id — the order
 * edit screen knows the order, not its `shipping_usage` row. Admin only; CORS handled by the
 * global middleware.
 *
 * GET -> `{ shipmentId, driverName, knownDrivers }` (`shipmentId: null` when there is no shipment).
 * PUT `{ driver_name }` -> assigns it (empty clears). Validation lives in `DeliveryService`
 * (`normalizeDriverName`); this route only maps its messages to statuses.
 */
const CLIENT_ERRORS: Array<{ match: string; status: number }> = [
  { match: DRIVER_ERRORS.INVALID, status: 400 },
  { match: DRIVER_ERRORS.TOO_LONG, status: 400 },
  { match: DRIVER_ERRORS.NO_SHIPMENT, status: 404 },
  { match: DRIVER_ERRORS.COLUMN_MISSING, status: 503 },
];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function parseOrderId(raw: unknown): number | null {
  const id = Number(raw);
  return Number.isInteger(id) && id > 0 ? id : null;
}

export const GET: APIRoute = withAuth(async ({ params, locals }: any) => {
  const orderId = parseOrderId(params.orderId);
  if (!orderId) {
    return json({ success: false, error: "ID de pedido inválido" }, 400);
  }

  try {
    const [driver, knownDrivers] = await Promise.all([
      DeliveryService.getDriverForOrder(orderId),
      DeliveryService.listDriverNames(),
    ]);
    return json(
      {
        success: true,
        data: {
          shipmentId: driver?.shipmentId ?? null,
          driverName: driver?.driverName ?? null,
          knownDrivers,
        },
      },
      200,
    );
  } catch (error) {
    console.error("[GET /api/delivery/orders/:orderId/driver] Error:", {
      orderId,
      userId: locals?.user?.id,
      error,
    });
    return json(
      { success: false, error: "Error al obtener el conductor del pedido" },
      500,
    );
  }
});

export const PUT: APIRoute = withAuth(
  async ({ params, request, locals }: any) => {
    const orderId = parseOrderId(params.orderId);
    if (!orderId) {
      return json({ success: false, error: "ID de pedido inválido" }, 400);
    }

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return json({ success: false, error: "JSON inválido" }, 400);
    }

    try {
      const updated = await DeliveryService.setDriverForOrder(
        orderId,
        body.driver_name ?? null,
      );
      return json({ success: true, data: updated }, 200);
    } catch (error) {
      const message = error instanceof Error ? error.message : "";
      const known = CLIENT_ERRORS.find((candidate) =>
        message.startsWith(candidate.match),
      );
      if (known) return json({ success: false, error: message }, known.status);

      console.error("[PUT /api/delivery/orders/:orderId/driver] Error:", {
        orderId,
        userId: locals?.user?.id,
        error,
      });
      return json(
        { success: false, error: "Error al asignar el conductor del pedido" },
        500,
      );
    }
  },
);
