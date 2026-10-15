import type { APIRoute } from 'astro';
import { withAuth } from '../../../../../middleware/auth';
import { SerialisedAssetService, type BulkUnitDefaults } from '../../../../../services/serialisedAssetService';
import { errorResponse, fail, json, positiveInt, readJsonObject, sessionUserId } from '../../_respond';

// Units of one product (0021): the product's "Inventario" tab and its bulk intake. Admin-only.
// CORS handled by global middleware.

function textOrNull(value: unknown): string | null {
  return typeof value === 'string' ? value : null;
}

export const GET: APIRoute = withAuth(async ({ params, locals }) => {
  const productId = positiveInt(params.productId);
  if (!productId) return fail('ID de producto inválido', 400);

  try {
    const units = await SerialisedAssetService.listByProduct(productId);
    return json({ success: true, data: { units, total: units.length } }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al consultar las unidades', {
      endpoint: 'GET /api/inventory/products/[productId]/units',
      productId,
      userId: sessionUserId(locals),
    });
  }
});

/**
 * POST { count, wear?, condition?, location_id? | location?, serial_prefix?, kit_code?, notes? }
 * registers `count` units with consecutive asset tags. The service validates every field.
 */
export const POST: APIRoute = withAuth(async ({ request, params, locals }) => {
  const productId = positiveInt(params.productId);
  if (!productId) return fail('ID de producto inválido', 400);

  const body = await readJsonObject(request);
  if (!body) return fail('JSON inválido', 400);

  const defaults: BulkUnitDefaults = {
    wear: body.wear as BulkUnitDefaults['wear'],
    condition: body.condition as BulkUnitDefaults['condition'],
    location_id: textOrNull(body.location_id),
    location: textOrNull(body.location),
    serial_prefix: textOrNull(body.serial_prefix),
    kit_code: textOrNull(body.kit_code),
    notes: textOrNull(body.notes),
  };

  try {
    const units = await SerialisedAssetService.bulkCreateAssets(productId, Number(body.count), defaults);
    return json({ success: true, data: { units, total: units.length } }, 201);
  } catch (error) {
    return errorResponse(error, 'Error al registrar las unidades', {
      endpoint: 'POST /api/inventory/products/[productId]/units',
      productId,
      userId: sessionUserId(locals),
    });
  }
});
