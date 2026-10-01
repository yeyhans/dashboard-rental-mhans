import { OPERATOR_ERRORS, type OperatorInput } from '../lib/operators';
import { invalidateAdminCache, supabaseAdmin } from '../lib/supabase';

/**
 * Operator accounts (migration 0011): `admin_users` rows with `role = 'operator'` backed by a
 * Supabase Auth user. Managed by `super_admin` only — the API layer enforces that with
 * `requireRole('super_admin')`; this class does not re-check it.
 *
 * Two writes per create (Auth user, then the row), and no transaction spans them. If the row
 * insert fails the Auth user is deleted again so a retry with the same email does not hit
 * "already registered" for an account that never worked. The reverse partial failure (row without
 * Auth user) cannot happen: the row is inserted with the id Auth returned.
 *
 * Never returns password hashes or tokens — `admin_users` holds none, and the Auth user object is
 * dropped after its id is read.
 */
export interface Operator {
  id: number;
  user_id: string;
  email: string;
  role: 'operator';
  is_active: boolean;
  created_at: string;
}

const OPERATOR_COLUMNS = 'id, user_id, email, role, is_active, created_at';

/** PostgREST "no rows" code for `.single()`. */
const NOT_FOUND = 'PGRST116';

export class OperatorService {
  /**
   * `as any`: `admin_users.is_active` is a hand edit in `database.ts` until 0011 is applied and the
   * types are regenerated; the typed `.update()` would reject the column until then.
   */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  /** Every operator, newest first. Active and inactive alike — the table shows both. */
  static async list(): Promise<Operator[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('admin_users')
      .select(OPERATOR_COLUMNS)
      .eq('role', 'operator')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[OperatorService] Error al listar operarios:', { error });
      throw error;
    }

    return (data as Operator[]) || [];
  }

  /**
   * Creates the Auth user (email pre-confirmed: nobody is going to click a link on the garage
   * phone) and the `admin_users` row. Input is assumed validated by `parseOperatorInput`.
   */
  static async create(input: OperatorInput): Promise<Operator> {
    const client = this.ensureSupabaseAdmin();

    const { data: authData, error: authError } = await client.auth.admin.createUser({
      email: input.email,
      password: input.password,
      email_confirm: true,
      ...(input.displayName ? { user_metadata: { display_name: input.displayName } } : {}),
    });

    if (authError || !authData?.user) {
      console.error('[OperatorService] Error al crear el usuario de Auth:', {
        email: input.email,
        error: authError,
      });
      if (authError?.message?.includes('already been registered')) {
        throw new Error(OPERATOR_ERRORS.EMAIL_TAKEN);
      }
      throw authError ?? new Error('Auth user missing from createUser response');
    }

    const userId: string = authData.user.id;

    const { data, error } = await client
      .from('admin_users')
      .insert({ user_id: userId, email: input.email, role: 'operator', is_active: true })
      .select(OPERATOR_COLUMNS)
      .single();

    if (error) {
      console.error('[OperatorService] Error al insertar en admin_users; se revierte el usuario de Auth:', {
        email: input.email,
        userId,
        error,
      });
      const { error: rollbackError } = await client.auth.admin.deleteUser(userId);
      if (rollbackError) {
        // Now there IS an orphan Auth user. Say so loudly: the next create with this email will
        // fail with EMAIL_TAKEN and the fix is manual.
        console.error('[OperatorService] No se pudo revertir el usuario de Auth (queda huérfano):', {
          userId,
          error: rollbackError,
        });
      }
      throw error;
    }

    console.log('[OperatorService] Operario creado:', { operatorId: (data as Operator).id, email: input.email });
    return data as Operator;
  }

  /**
   * Flips `is_active`. Scoped to `role = 'operator'` so this endpoint can never deactivate an
   * admin. Returns `null` when no operator has that id.
   *
   * Drops the session cache entry on this instance; operators are never served from cache
   * anyway (see `resolveAdminSession`), so the deactivation bites on the worker's next request.
   */
  static async setActive(id: number, isActive: boolean): Promise<Operator | null> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('admin_users')
      .update({ is_active: isActive })
      .eq('id', id)
      .eq('role', 'operator')
      .select(OPERATOR_COLUMNS)
      .single();

    if (error) {
      if ((error as { code?: string }).code === NOT_FOUND) return null;
      console.error('[OperatorService] Error al cambiar el estado del operario:', { id, isActive, error });
      throw error;
    }

    const operator = data as Operator;
    invalidateAdminCache(operator.user_id);
    console.log('[OperatorService] Estado del operario actualizado:', { operatorId: id, isActive });
    return operator;
  }
}

export default OperatorService;
