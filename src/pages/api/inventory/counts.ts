import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { ProductUnitCountsService } from '../../../services/productUnitCountsService';
import { errorResponse, fail, json, positiveInt, sessionUserId } from './_respond';

// Unit counts per product (0021, view product_unit_counts): Stock / Disp. / En arriendo for the
// product list. Admin-only. CORS handled by global middleware.

/** GET ?product_ids=1,2,3 */
export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  const raw = new URL(request.url).searchParams.get('product_ids') ?? '';
  const parts = raw
    .split(',')
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return fail('Debes indicar product_ids', 400);

  const ids = parts.map(positiveInt);
  if (ids.some((id) => id === null)) return fail('Los IDs de producto deben ser enteros positivos', 400);

  try {
    const counts = await ProductUnitCountsService.getByProductIds(ids as number[]);
    return json({ success: true, data: { counts } }, 200);
  } catch (error) {
    return errorResponse(error, 'Error al consultar los conteos de unidades', {
      endpoint: 'GET /api/inventory/counts',
      userId: sessionUserId(locals),
    });
  }
});
