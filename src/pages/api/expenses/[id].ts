import type { APIRoute } from 'astro';
import { withAuth } from '../../../middleware/auth';
import { ExpenseService } from '../../../services/expenseService';
import type { ExpenseCategory } from '../../../types/expenses';

// Expenses by id (T-026 gap 3). See `./index.ts` for the module-level notes (grants, migration
// status). CORS handled by global middleware.

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

export const PUT: APIRoute = withAuth(async ({ request, params, locals }) => {
  const id = parseInt(params.id as string);
  if (isNaN(id) || id <= 0) {
    return fail('ID de gasto inválido', 400);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const updates: Record<string, unknown> = {};

  if (body.category !== undefined) {
    updates.category = body.category as ExpenseCategory;
  }
  if (body.amount !== undefined) {
    const amount = Number(body.amount);
    if (!Number.isFinite(amount) || amount < 0) {
      return fail('El monto debe ser mayor o igual a cero', 400);
    }
    updates.amount = amount;
  }
  if (body.expense_date !== undefined) {
    if (typeof body.expense_date !== 'string' || !body.expense_date) {
      return fail('La fecha del gasto es obligatoria', 400);
    }
    updates.expense_date = body.expense_date;
  }
  if (body.related_order_id !== undefined) {
    updates.related_order_id = body.related_order_id === null ? null : Number(body.related_order_id);
  }
  if (body.related_asset_id !== undefined) {
    updates.related_asset_id = body.related_asset_id === null ? null : Number(body.related_asset_id);
  }
  if (body.notes !== undefined) {
    updates.notes = typeof body.notes === 'string' ? body.notes.trim() || null : null;
  }

  try {
    const expense = await ExpenseService.update(id, updates);
    return json({ success: true, data: expense }, 200);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message === 'Gasto no encontrado') {
      return fail(message, 404);
    }
    if (message.startsWith('Categoría inválida') || message.startsWith('El monto debe ser')) {
      return fail(message, 400);
    }

    console.error('[PUT /api/expenses/[id]] Error:', {
      error,
      id,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al actualizar el gasto', 500);
  }
});

export const DELETE: APIRoute = withAuth(async ({ params, locals }) => {
  const id = parseInt(params.id as string);
  if (isNaN(id) || id <= 0) {
    return fail('ID de gasto inválido', 400);
  }

  try {
    await ExpenseService.delete(id);
    return json({ success: true, message: 'Gasto eliminado correctamente' }, 200);
  } catch (error) {
    console.error('[DELETE /api/expenses/[id]] Error:', {
      error,
      id,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al eliminar el gasto', 500);
  }
});
