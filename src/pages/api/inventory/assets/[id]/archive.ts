import type { APIRoute } from 'astro';
import { withAuth } from '../../../../../middleware/auth';
import { SerialisedAssetService } from '../../../../../services/serialisedAssetService';
import { errorResponse, fail, json, positiveInt, readJsonObject, sessionUserId } from '../../_respond';

// Archive one unit (0021): condition 'retired', never a DELETE. Admin-only.
// CORS handled by global middleware.

/** POST { row_version } */
export const POST: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = positiveInt(params.id);
  if (!id) return fail('ID de unidad inválido', 400);

  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);

  try {
    const unit = await SerialisedAssetService.archiveAsset(id, positiveInt(body.row_version) ?? 0);
    return json({ success: true, data: unit }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al archivar la unidad', {
      endpoint: 'POST /api/inventory/assets/[id]/archive',
      id,
      userId: sessionUserId(locals),
    });
  }
});
