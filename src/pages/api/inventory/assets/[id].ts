import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { SerialisedAssetService } from '../../../../services/serialisedAssetService';
import { errorResponse, fail, json, positiveInt, readJsonObject, sessionUserId } from '../_respond';

// Edit one unit (0021). Admin-only. CORS handled by global middleware.

/**
 * PUT { serial_number?, condition?, wear?, kit_code?, notes?, row_version } — optimistic
 * concurrency on `row_version` (409 CONFLICT: reload). Location changes go through
 * POST /api/inventory/assets/[id]/relocate so they leave an audit row.
 */
export const PUT: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = positiveInt(params.id);
  if (!id) return fail('ID de unidad inválido', 400);

  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);
  const { row_version: rowVersion, ...patch } = body;

  try {
    const unit = await SerialisedAssetService.updateAsset(id, patch, positiveInt(rowVersion) ?? 0);
    return json({ success: true, data: unit }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al actualizar la unidad', {
      endpoint: 'PUT /api/inventory/assets/[id]',
      id,
      userId: sessionUserId(locals),
    });
  }
});
