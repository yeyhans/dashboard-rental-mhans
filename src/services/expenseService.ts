import { supabaseAdmin } from '../lib/supabase';
import {
  isExpenseCategory,
  type Expense,
  type ExpenseInsert,
  type ExpenseUpdate,
} from '../types/expenses';

/**
 * Operational expenses not tied to a single asset acquisition (T-026 gap 3, Rentabilidad minimal
 * scope). NOTE: `expenses` (`0006_t026_schema_gaps.sql`) has not been applied to any database yet
 * (pending staging rehearsal, see `apply-progress.md` "T-026 resuelto"). Written and tested
 * against the migration's contract ahead of that rehearsal.
 */
export class ExpenseService {
  /**
   * `as any`: `expenses` is not yet in the generated `Database` type (the migration has not been
   * applied to any database — see the module note above), so the typed client rejects
   * `.from('expenses')`. Replace with the typed client once
   * `npx supabase gen types typescript` is re-run after the migration lands.
   */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  private static validateCategory(category: unknown): void {
    if (!isExpenseCategory(category)) {
      throw new Error('Categoría inválida. Ver EXPENSE_CATEGORIES para los 11 valores permitidos');
    }
  }

  private static validateAmount(amount: unknown): void {
    if (typeof amount !== 'number' || !Number.isFinite(amount) || amount < 0) {
      throw new Error('El monto debe ser mayor o igual a cero');
    }
  }

  static async getAll(page = 1, limit = 20) {
    const client = this.ensureSupabaseAdmin();
    const offset = (page - 1) * limit;

    const { data, error, count } = await client
      .from('expenses')
      .select('*', { count: 'exact' })
      .order('expense_date', { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      console.error('[ExpenseService] Error al listar gastos:', { error });
      throw error;
    }

    const total = count || 0;
    return {
      expenses: (data as Expense[]) || [],
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  static async create(input: ExpenseInsert): Promise<Expense> {
    this.validateCategory(input.category);
    this.validateAmount(input.amount);
    if (!input.expense_date) {
      throw new Error('La fecha del gasto es obligatoria');
    }

    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('expenses')
      .insert({
        category: input.category,
        amount: input.amount,
        expense_date: input.expense_date,
        related_order_id: input.related_order_id ?? null,
        related_asset_id: input.related_asset_id ?? null,
        notes: input.notes ?? null,
      })
      .select()
      .single();

    if (error) {
      console.error('[ExpenseService] Error al crear el gasto:', { input, error });
      throw error;
    }

    console.log('[ExpenseService] Gasto creado:', { expenseId: (data as Expense).id });
    return data as Expense;
  }

  static async update(id: number, updates: ExpenseUpdate): Promise<Expense> {
    if (updates.category !== undefined) this.validateCategory(updates.category);
    if (updates.amount !== undefined) this.validateAmount(updates.amount);

    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('expenses')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === 'PGRST116') {
        throw new Error('Gasto no encontrado');
      }
      console.error('[ExpenseService] Error al actualizar el gasto:', { id, error });
      throw error;
    }

    return data as Expense;
  }

  /**
   * `false` when `id` did not exist (R3-101, review R3 on `4de3c5c`): `.delete().eq('id', id)`
   * alone returns `error: null` with zero affected rows for a nonexistent id — a naive
   * `if (error) throw; return true` would report success for a delete that deleted nothing. The
   * trailing `.select()` returns the deleted rows so the caller can tell "deleted" from "there was
   * nothing to delete", same distinction `update()` above makes via `PGRST116`.
   */
  static async delete(id: number): Promise<boolean> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client.from('expenses').delete().eq('id', id).select();

    if (error) {
      console.error('[ExpenseService] Error al eliminar el gasto:', { id, error });
      throw error;
    }

    return Array.isArray(data) && data.length > 0;
  }
}

export default ExpenseService;
