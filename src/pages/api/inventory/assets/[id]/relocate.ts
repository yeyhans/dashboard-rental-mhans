import type { APIRoute } from 'astro';
import { withAuth } from '../../../../../middleware/auth';
import { AssetRelocationService } from '../../../../../services/assetRelocationService';
import { errorResponse, fail, json, positiveInt, readJsonObject, sessionUserId } from '../../_respond';

// Move one unit to another warehouse location (0021). Open to operators (see
// lib/accessControl.ts). The mover is the session user and the source is always 'dashboard':
// neither is read from the body. CORS handled by global middleware.

/** POST { to_location_id, row_version, notes? } */
export const POST: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = positiveInt(params.id);
  if (!id) return fail('ID de unidad inválido', 400);

  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);

  try {
    const result = await AssetRelocationService.relocateAsset({
      assetId: id,
      toLocationId: typeof body.to_location_id === 'string' ? body.to_location_id : '',
      movedByUserId: sessionUserId(locals),
      source: 'dashboard',
      expectedRowVersion: positiveInt(body.row_version) ?? 0,
      notes: typeof body.notes === 'string' ? body.notes : null,
    });
    return json({ success: true, data: result }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al reubicar la unidad', {
      endpoint: 'POST /api/inventory/assets/[id]/relocate',
      id,
      userId: sessionUserId(locals),
    });
  }
});
