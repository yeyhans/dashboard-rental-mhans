import type { APIRoute } from 'astro';
import { OPERATOR_ERRORS, parseOperatorInput } from '../../../lib/operators';
import { requireRole } from '../../../middleware/auth';
import { OperatorService } from '../../../services/operatorService';

// Operator accounts (batch 3, migration 0011). `super_admin` only: creating a login is the one
// dashboard action that mints credentials, and a plain admin should not be able to do it.
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

export const GET: APIRoute = requireRole('super_admin')(async ({ locals }) => {
  try {
    const operators = await OperatorService.list();
    return json({ success: true, data: { operators, total: operators.length } }, 200);
  } catch (error) {
    console.error('[GET /api/operators] Error:', {
      error,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al obtener los operarios', 500);
  }
});

export const POST: APIRoute = requireRole('super_admin')(async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const { values, error } = parseOperatorInput(body);
  if (!values) {
    return fail(error, 400);
  }

  try {
    const operator = await OperatorService.create(values);
    return json({ success: true, data: operator }, 201);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    if (message === OPERATOR_ERRORS.EMAIL_TAKEN) {
      return fail(message, 409);
    }

    // Never log the password. The email is enough to find the attempt.
    console.error('[POST /api/operators] Error:', {
      error: err,
      email: values.email,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al crear el operario', 500);
  }
});
