import type { APIRoute } from 'astro';
import { SHIPMENT_TRANSITION_ERRORS, isShipmentStatus } from '../../../../lib/delivery';
import { withAuth } from '../../../../middleware/auth';
import { DeliveryService } from '../../../../services/deliveryService';

// Dispatch status transitions (T-026 gap 2/4, R3-205 fix). Admin-only, same posture as
// `/api/shipping/methods/:id`. CORS handled by global middleware.
//
// The transition rule itself lives ONLY in `lib/delivery.ts`'s `canTransitionShipment` — this
// endpoint does not reimplement it. `CLIENT_ERRORS` maps the SAME exported constants
// `DeliveryService.updateShipmentStatus` throws, so the two cannot drift (same pattern as
// `inventory/movements.ts`'s `MOVEMENT_TRANSITION_ERRORS` matcher).
const CLIENT_ERRORS: Array<{ match: string; status: number }> = [
  { match: SHIPMENT_TRANSITION_ERRORS.NOT_FOUND, status: 404 },
  { match: SHIPMENT_TRANSITION_ERRORS.ILLEGAL, status: 409 },
  { match: SHIPMENT_TRANSITION_ERRORS.RACE, status: 409 },
];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

export const PUT: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail('ID de envío inválido', 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  // El vocabulario de `status` lo define el CHECK real de `shipping_usage_status_check`
  // (`isShipmentStatus`, `lib/delivery.ts`) — no una lista duplicada aquí.
  if (!isShipmentStatus(body.status)) {
    return fail(
      'Estado inválido. Debe ser uno de: pending, processing, shipped, delivered, cancelled',
      400
    );
  }

  try {
    const updated = await DeliveryService.updateShipmentStatus(id, body.status);
    return json({ success: true, data: updated }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known = CLIENT_ERRORS.find(candidate => message.startsWith(candidate.match));
    if (known) {
      return fail(message, known.status);
    }

    console.error('[PUT /api/delivery/shipments/:id] Error:', {
      error,
      shipmentId: id,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al actualizar el estado del envío', 500);
  }
});
