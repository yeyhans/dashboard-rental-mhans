import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { ExpenseService } from '../../../services/expenseService';
import type { ExpenseCategory } from '../../../types/expenses';

// Expenses (T-026 gap 3, Rentabilidad minimal scope). Admin-only, `service_role`-only grant, no
// `hermes_ro` access (see migration header). CORS handled by global middleware.
//
// NOTE: `expenses` (`0006_t026_schema_gaps.sql`) has not been applied to any database yet
// (pending staging rehearsal). This endpoint is written and tested against the migration's
// contract ahead of that rehearsal.

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  const url = new URL(request.url);
  const page = parseInt(url.searchParams.get('page') || '1');
  const limit = parseInt(url.searchParams.get('limit') || '20');

  if (isNaN(page) || page < 1) {
    return fail('Parámetro page inválido', 400);
  }
  if (isNaN(limit) || limit < 1) {
    return fail('Parámetro limit inválido', 400);
  }

  try {
    const result = await ExpenseService.getAll(page, limit);
    return json({ success: true, data: result }, 200);
  } catch (error) {
    console.error('[GET /api/expenses] Error:', {
      error,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al obtener los gastos', 500);
  }
});

export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const amount = Number(body.amount);
  if (!Number.isFinite(amount) || amount < 0) {
    return fail('El monto debe ser mayor o igual a cero', 400);
  }

  if (typeof body.expense_date !== 'string' || !body.expense_date) {
    return fail('La fecha del gasto es obligatoria', 400);
  }
  // R3-106: reject an unparseable date instead of forwarding an opaque string to the DB.
  if (Number.isNaN(new Date(body.expense_date).getTime())) {
    return fail('La fecha del gasto no es una fecha válida', 400);
  }

  const relatedOrderId = body.related_order_id != null ? Number(body.related_order_id) : null;
  if (relatedOrderId != null && (!Number.isInteger(relatedOrderId) || relatedOrderId <= 0)) {
    return fail('ID de orden relacionada inválido', 400);
  }

  const relatedAssetId = body.related_asset_id != null ? Number(body.related_asset_id) : null;
  if (relatedAssetId != null && (!Number.isInteger(relatedAssetId) || relatedAssetId <= 0)) {
    return fail('ID de equipo relacionado inválido', 400);
  }

  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  try {
    const expense = await ExpenseService.create({
      // The service owns the category enum; validating it twice would let the two drift.
      category: body.category as ExpenseCategory,
      amount,
      expense_date: body.expense_date,
      related_order_id: relatedOrderId,
      related_asset_id: relatedAssetId,
      notes: notes || null,
    });

    return json({ success: true, data: expense }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.startsWith('Categoría inválida') || message.startsWith('El monto debe ser') || message.startsWith('La fecha del gasto')) {
      return fail(message, 400);
    }

    console.error('[POST /api/expenses] Error:', {
      error,
      body,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al crear el gasto', 500);
  }
});
