import type { APIRoute } from 'astro';
import { MOVEMENT_TRANSITION_ERRORS } from '../../../lib/assetMovements';
import { parseInstant } from '../../../lib/movementsFeed';
import { withAuth } from '../../../middleware/auth';
import { AssetMovementService, FEED_DEFAULT_LIMIT, FEED_MAX_LIMIT } from '../../../services/assetMovementService';
import { isMovementDirection, type MovementDirection } from '../../../types/assetMovements';

// Asset movements (T-026 gap 1/4, Check-In audit trail). Admin-only, same posture as
// `/api/inventory/assets`: `asset_movements` has no grant beyond `service_role` (see the
// migration header — no MCP call site, dashboard-only). CORS handled by global middleware.
//
// NOTE: `asset_movements` (`0006_t026_schema_gaps.sql`) has not been applied to any database yet
// (pending staging rehearsal). This endpoint is written and tested against the migration's
// contract ahead of that rehearsal.

// R3-103: sourced from `lib/assetMovements.ts`'s exported constants, not duplicated literals —
// `assetMovementService.ts` throws the exact same strings (both the synchronous validation path
// and the DB unique-violation defense-in-depth path, R3-102b), so this matcher cannot drift.
const CLIENT_ERRORS: Array<{ match: string; status: number }> = [
  { match: MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS, status: 409 },
  { match: MOVEMENT_TRANSITION_ERRORS.NO_OPEN_CHECKOUT, status: 409 },
  { match: 'Dirección inválida', status: 400 },
  { match: 'Debes indicar un equipo válido', status: 400 },
  { match: 'Debes indicar una orden válida', status: 400 },
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

export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const assetId = Number(body.asset_id);
  if (!Number.isInteger(assetId) || assetId <= 0) {
    return fail('Debes indicar un equipo válido', 400);
  }

  const orderId = Number(body.order_id);
  if (!Number.isInteger(orderId) || orderId <= 0) {
    return fail('Debes indicar una orden válida', 400);
  }

  const conditionNotes = typeof body.condition_notes === 'string' ? body.condition_notes.trim() : '';

  // The acting admin is resolved server-side from `withAuth`, never trusted from the request body
  // (see 0006's migration header, R1-002: this is the whole reason `checked_by_admin_id` exists).
  const adminSession = (locals as { adminSession?: { admin?: { id?: number } } })?.adminSession;
  const checkedByAdminId = adminSession?.admin?.id ?? null;

  try {
    const movement = await AssetMovementService.recordMovement({
      asset_id: assetId,
      order_id: orderId,
      direction: body.direction as MovementDirection,
      condition_notes: conditionNotes || null,
      checked_by_admin_id: checkedByAdminId,
    });

    return json({ success: true, data: movement }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known = CLIENT_ERRORS.find((candidate) => message.startsWith(candidate.match));
    if (known) {
      return fail(message, known.status);
    }

    console.error('[POST /api/inventory/movements] Error:', {
      error,
      assetId,
      orderId,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al registrar el movimiento', 500);
  }
});

/**
 * GET without `asset_id`/`order_id` is the central feed (batch 3): `?since=&until=` (ISO
 * instants), `?direction=checkout|checkin`, `?admin_id=`, `?limit=`. The two original lookups
 * keep their contract and their callers untouched. Operators never reach this handler — the
 * `withAuth` role gate answers 403 for `GET /api/inventory/movements` before it runs.
 */
function feedHandler(url: URL, locals: unknown): Promise<Response> {
  const since = parseInstant(url.searchParams.get('since'));
  if (since === undefined) return Promise.resolve(fail('El parámetro since debe ser una fecha válida', 400));
  const until = parseInstant(url.searchParams.get('until'));
  if (until === undefined) return Promise.resolve(fail('El parámetro until debe ser una fecha válida', 400));

  const directionParam = url.searchParams.get('direction');
  if (directionParam && !isMovementDirection(directionParam)) {
    return Promise.resolve(fail('Dirección inválida. Debe ser "checkout" o "checkin"', 400));
  }

  const adminIdParam = url.searchParams.get('admin_id');
  const adminId = adminIdParam ? Number(adminIdParam) : null;
  if (adminIdParam && (!Number.isInteger(adminId) || (adminId as number) <= 0)) {
    return Promise.resolve(fail('ID de operario inválido', 400));
  }

  const limitParam = url.searchParams.get('limit');
  const limit = limitParam ? Number(limitParam) : FEED_DEFAULT_LIMIT;
  if (!Number.isInteger(limit) || limit <= 0 || limit > FEED_MAX_LIMIT) {
    return Promise.resolve(fail(`El parámetro limit debe estar entre 1 y ${FEED_MAX_LIMIT}`, 400));
  }

  return AssetMovementService.listFeed({
    since,
    until,
    direction: (directionParam as MovementDirection | null) || null,
    adminId,
    limit,
  })
    .then((feed) => json({ success: true, data: feed }, 200))
    .catch((error) => {
      console.error('[GET /api/inventory/movements] Error al cargar el feed:', {
        error,
        userId: (locals as { user?: { id: string } })?.user?.id,
      });
      return fail('Error al consultar los movimientos', 500);
    });
}

export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  const url = new URL(request.url);
  const assetIdParam = url.searchParams.get('asset_id');
  const orderIdParam = url.searchParams.get('order_id');

  if (!assetIdParam && !orderIdParam) {
    return feedHandler(url, locals);
  }

  try {
    if (assetIdParam) {
      const assetId = Number(assetIdParam);
      if (!Number.isInteger(assetId) || assetId <= 0) {
        return fail('ID de equipo inválido', 400);
      }
      const movements = await AssetMovementService.getHistoryForAsset(assetId);
      return json({ success: true, data: { movements, total: movements.length } }, 200);
    }

    const orderId = Number(orderIdParam);
    if (!Number.isInteger(orderId) || orderId <= 0) {
      return fail('ID de orden inválido', 400);
    }
    const movements = await AssetMovementService.listByOrder(orderId);
    return json({ success: true, data: { movements, total: movements.length } }, 200);
  } catch (error) {
    console.error('[GET /api/inventory/movements] Error:', {
      error,
      assetIdParam,
      orderIdParam,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al consultar los movimientos', 500);
  }
});
