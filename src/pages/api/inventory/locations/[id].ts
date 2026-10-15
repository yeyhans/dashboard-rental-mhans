import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { WarehouseLocationService } from '../../../../services/warehouseLocationService';
import { errorResponse, fail, json, positiveInt, readJsonObject, sessionUserId } from '../_respond';

// One warehouse location (0021). Admin-only. CORS handled by global middleware.

function locationId(params: Record<string, string | undefined>): string | null {
  const id = (params.id ?? '').trim();
  return id ? id : null;
}

/** PUT { ...fields to change, row_version } — partial update under optimistic concurrency. */
export const PUT: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = locationId(params);
  if (!id) return fail('ID de ubicación inválido', 400);

  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);
  const { row_version: rowVersion, ...patch } = body;

  try {
    const result = await WarehouseLocationService.update(id, patch, positiveInt(rowVersion) ?? 0, sessionUserId(locals));
    return json({ success: true, data: result }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al actualizar la ubicación', {
      endpoint: 'PUT /api/inventory/locations/[id]',
      id,
      userId: sessionUserId(locals),
    });
  }
});

/** DELETE ?row_version=N — soft delete (is_active = false); rows are never removed. */
export const DELETE: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = locationId(params);
  if (!id) return fail('ID de ubicación inválido', 400);

  const rowVersion = positiveInt(new URL(request.url).searchParams.get('row_version')) ?? 0;

  try {
    const location = await WarehouseLocationService.deactivate(id, rowVersion, sessionUserId(locals));
    return json({ success: true, data: { location } }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al desactivar la ubicación', {
      endpoint: 'DELETE /api/inventory/locations/[id]',
      id,
      userId: sessionUserId(locals),
    });
  }
});
