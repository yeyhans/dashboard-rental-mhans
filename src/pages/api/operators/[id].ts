import type { APIRoute } from 'astro';
import { OPERATOR_ERRORS, parseActiveFlag } from '../../../lib/operators';
import { requireRole } from '../../../middleware/auth';
import { OperatorService } from '../../../services/operatorService';

// PATCH /api/operators/[id] — `{ is_active: boolean }`. Deactivation, not deletion: the rows an
// operator signed in `asset_movements` keep their author (see 0011). `super_admin` only.
// CORS handled by global middleware.

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

export const PATCH: APIRoute = requireRole('super_admin')(async ({ params, request, locals }) => {
  const id = Number(params.id);
  if (!Number.isInteger(id) || id <= 0) {
    return fail('ID de operario inválido', 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const isActive = parseActiveFlag(body);
  if (isActive === null) {
    return fail(OPERATOR_ERRORS.INVALID_ACTIVE_FLAG, 400);
  }

  try {
    const operator = await OperatorService.setActive(id, isActive);
    if (!operator) {
      return fail(OPERATOR_ERRORS.NOT_FOUND, 404);
    }
    return json({ success: true, data: operator }, 200);
  } catch (error) {
    console.error('[PATCH /api/operators/[id]] Error:', {
      error,
      id,
      isActive,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al actualizar el operario', 500);
  }
});
