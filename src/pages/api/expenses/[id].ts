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
    // R3-106: reject an unparseable date instead of forwarding an opaque string to the DB, where
    // Postgres would reject it with a generic error the client can't act on.
    if (Number.isNaN(new Date(body.expense_date).getTime())) {
      return fail('La fecha del gasto no es una fecha válida', 400);
    }
    updates.expense_date = body.expense_date;
  }
  if (body.related_order_id !== undefined) {
    // R3-105: same validation as POST (`index.ts`) — Number.isInteger && > 0, not just a
    // null-check, so a non-numeric or non-positive value doesn't silently reach the service.
    if (body.related_order_id === null) {
      updates.related_order_id = null;
    } else {
      const relatedOrderId = Number(body.related_order_id);
      if (!Number.isInteger(relatedOrderId) || relatedOrderId <= 0) {
        return fail('ID de orden relacionada inválido', 400);
      }
      updates.related_order_id = relatedOrderId;
    }
  }
  if (body.related_asset_id !== undefined) {
    if (body.related_asset_id === null) {
      updates.related_asset_id = null;
    } else {
      const relatedAssetId = Number(body.related_asset_id);
      if (!Number.isInteger(relatedAssetId) || relatedAssetId <= 0) {
        return fail('ID de equipo relacionado inválido', 400);
      }
      updates.related_asset_id = relatedAssetId;
    }
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
    // R3-101 (CRITICAL): `delete()` returns `false` when nothing existed at `id` — must map to
    // 404, not the 200 a bare `await ExpenseService.delete(id)` would always return.
    const deleted = await ExpenseService.delete(id);
    if (!deleted) {
      return fail('Gasto no encontrado', 404);
    }
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
