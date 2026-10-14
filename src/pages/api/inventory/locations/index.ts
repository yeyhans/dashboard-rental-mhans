import type { APIRoute } from 'astro';
import { withAuth } from '../../../../middleware/auth';
import { WarehouseLocationService } from '../../../../services/warehouseLocationService';
import { errorResponse, fail, json, readJsonObject, sessionUserId } from '../_respond';

// Warehouse locations (0021). GET is open to operators (the garage reads the plan, see
// lib/accessControl.ts); POST is admin-only. CORS handled by global middleware.

/**
 * GET ?include_inactive=1 lists deactivated rows too; ?view=tree returns the active locations
 * nested by parent.
 */
export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  const url = new URL(request.url);
  try {
    if (url.searchParams.get('view') === 'tree') {
      const tree = await WarehouseLocationService.tree();
      return json({ success: true, data: { tree } }, 200);
    }
    const includeInactive = url.searchParams.get('include_inactive') === '1';
    const locations = await WarehouseLocationService.list({ includeInactive });
    return json({ success: true, data: { locations, total: locations.length } }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al consultar las ubicaciones', {
      endpoint: 'GET /api/inventory/locations',
      userId: sessionUserId(locals),
    });
  }
});

export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);

  try {
    // The editor is the session user, never a body field.
    const result = await WarehouseLocationService.create(body, sessionUserId(locals));
    return json({ success: true, data: result }, 201);
  } catch (error) {
    return errorResponse(error, 'Error al crear la ubicación', {
      endpoint: 'POST /api/inventory/locations',
      userId: sessionUserId(locals),
    });
  }
});
