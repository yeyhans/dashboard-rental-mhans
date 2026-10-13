import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';
import { sendEmailViaWorker } from '../lib/emailWorkerService';
import { renderTransactionalEmail } from '../lib/transactionalEmail';
import { rutValidationError } from '../lib/rut';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert'];
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// Helper function to ensure supabaseAdmin is available
const getSupabaseAdmin = () => {
  if (!supabaseAdmin) {
    throw new Error('Supabase admin client not available - this service can only be used on the server');
  }
  return supabaseAdmin;
};

/** A client payload carried a RUT whose check digit does not match. Routes map it to HTTP 400. */
export class InvalidRutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidRutError';
  }
}

/** Throws `InvalidRutError` when the payload has a RUT (client or company) with a bad check digit. */
function assertValidRuts(payload: { rut?: string | null; empresa_rut?: string | null }): void {
  const error = rutValidationError(payload);
  if (error) throw new InvalidRutError(error);
}

export class UserService {
  /**
   * Obtener todos los usuarios con paginación
   */
  static async getAllUsers(page: number = 1, limit: number = 10) {
    try {
      const admin = getSupabaseAdmin();
      const offset = (page - 1) * limit;

      const { data, error, count } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order('user_id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) {
        throw error;
      }

      return {
        users: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching users:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por ID
   */
  static async getUserById(userId: number): Promise<UserProfile | null> {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('user_profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user by ID:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por auth_uid
   */
  static async getUserByAuthUid(authUid: string): Promise<UserProfile | null> {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('user_profiles')
        .select('*')
        .eq('auth_uid', authUid)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Usuario no encontrado
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching user by auth_uid:', error);
      throw error;
    }
  }

  /**
   * Obtener usuario por email
   *
   * NOTA: SELECT parcial — solo devuelve los campos consultados. El tipo de
   * retorno refleja exactamente ese subconjunto (no el Row completo) para no
   * mentirle al consumidor sobre qué propiedades están presentes.
   */
  static async getUserByEmail(
    email: string
  ): Promise<Pick<UserProfile, 'user_id' | 'email' | 'nombre' | 'apellido' | 'tipo_cliente'> | null> {
    try {
      const admin = getSupabaseAdmin();
      const { data, error } = await admin
        .from('user_profiles')
        .select('user_id, email, nombre, apellido, tipo_cliente')
        .eq('email', email)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // No encontrado — no es error
        }
        throw error;
      }

      return data;
    } catch (error) {
      console.error('[UserService] Error fetching user by email:', error);
      throw error;
    }
  }

  /**
   * R-09e: the "Registro" design for an account an admin created, with a "Crear mi contraseña"
   * button instead of a password in the email.
   *
   * The button is a Supabase recovery link generated server-side. It points at the customer
   * site's own `/reset-password?token_hash=…&type=recovery` — the same entry the site's "¿Olvidaste
   * tu contraseña?" emails use, which asks for an explicit click before redeeming the token (so
   * a mail scanner opening the link does not burn it) — rather than at `action_link`, which
   * would redeem it on the Supabase host first.
   *
   * Best effort: the account already exists. Returns a Spanish warning for the admin when the
   * link or the email fails; nothing is sent without the link, because without it the customer
   * has no way in.
   */
  private static async sendRegistroEmail(
    email: string,
    nombre: string,
    usuario: string
  ): Promise<string | undefined> {
    const frontendUrl = (import.meta.env.PUBLIC_FRONTEND_URL || 'https://rental.mariohans.cl').replace(/\/$/, '');
    const resetPage = `${frontendUrl}/reset-password`;

    try {
      const { data, error } = await getSupabaseAdmin().auth.admin.generateLink({
        type: 'recovery',
        email,
        options: { redirectTo: resetPage },
      });
      const hashedToken = data?.properties?.hashed_token;
      if (error || !hashedToken) {
        console.error('[UserService] No se pudo generar el enlace para crear la contraseña:', {
          email,
          error: error?.message,
        });
        return 'La cuenta se creó, pero no se pudo generar el enlace para crear la contraseña. El cliente puede pedirlo en «¿Olvidaste tu contraseña?».';
      }

      const link = `${resetPage}?${new URLSearchParams({ token_hash: hashedToken, type: 'recovery' })}`;
      const { subject, html } = renderTransactionalEmail('registro', {
        nombre_cliente: nombre || 'Cliente',
        usuario,
        link_crear_contrasena: link,
      });

      const result = await sendEmailViaWorker(email, subject, html);
      if (!result.success) {
        console.error('[UserService] Error enviando el correo de registro:', { email, error: result.error });
        return 'La cuenta se creó, pero no se pudo enviar el correo de registro al cliente.';
      }
      console.log('[UserService] Correo de registro enviado a:', email);
      return undefined;
    } catch (error) {
      console.error('[UserService] Error en sendRegistroEmail:', { email, error });
      return 'La cuenta se creó, pero no se pudo enviar el correo de registro al cliente.';
    }
  }

  /**
   * Crear nuevo usuario: primero en Supabase Auth, luego perfil via RPC.
   *
   * Callers that cannot show a warning (the Hermes `external/create-user` route) keep this
   * signature; the admin panel uses `createUserWithWelcome` to surface it.
   */
  static async createUser(userData: UserProfileInsert): Promise<UserProfile> {
    const { user } = await UserService.createUserWithWelcome(userData);
    return user;
  }

  /**
   * `createUser`, plus the warning when the Registro email could not go out (R-09e).
   */
  static async createUserWithWelcome(
    userData: UserProfileInsert
  ): Promise<{ user: UserProfile; warning?: string }> {
    try {
      assertValidRuts(userData);
      const admin = getSupabaseAdmin();

      if (!userData.email) {
        throw new Error('El email es requerido');
      }

      console.log('[UserService] Creando usuario:', { email: userData.email, nombre: userData.nombre });

      // 1. Crear usuario en Supabase Auth, sin contraseña: el cliente la crea con el enlace del
      //    correo de Registro (R-09e). Nadie más llega a conocerla.
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: userData.email,
        email_confirm: true,
      });

      if (authError) {
        console.error('[UserService] Error creando auth user:', authError);
        if (authError.message?.includes('already been registered')) {
          throw new Error('Ya existe una cuenta con este email');
        }
        throw new Error(`Error al crear cuenta: ${authError.message}`);
      }

      const authUid = authData.user.id;
      console.log('[UserService] Auth user creado:', { authUid, email: userData.email });

      // 2. Crear perfil via RPC con auth_uid
      const { data, error } = await admin
        .rpc('admin_create_user_profile' as any, {
          p_auth_uid: authUid,
          p_email: userData.email,
          p_nombre: userData.nombre || null,
          p_apellido: userData.apellido || null,
          p_rut: userData.rut || null,
          p_telefono: userData.telefono || null,
          p_direccion: userData.direccion || null,
          p_ciudad: userData.ciudad || null,
          p_pais: userData.pais || null,
          p_tipo_cliente: userData.tipo_cliente || null,
          p_instagram: userData.instagram || null,
          p_fecha_nacimiento: userData.fecha_nacimiento || null,
          p_usuario: userData.usuario || null,
          p_empresa_nombre: userData.empresa_nombre || null,
          p_empresa_rut: userData.empresa_rut || null,
          p_empresa_ciudad: userData.empresa_ciudad || null,
          p_empresa_direccion: userData.empresa_direccion || null,
          p_terminos_aceptados: userData.terminos_aceptados || false
        });

      if (error) {
        // Rollback: eliminar auth user si falla el perfil
        console.error('[UserService] Error en RPC, haciendo rollback del auth user:', error);
        await admin.auth.admin.deleteUser(authUid);
        throw error;
      }

      const newUser = Array.isArray(data) ? data[0] : data;

      if (!newUser) {
        await admin.auth.admin.deleteUser(authUid);
        throw new Error('No se pudo crear el perfil del usuario');
      }

      console.log('[UserService] Perfil creado:', { user_id: newUser.user_id, email: newUser.email });

      // 3. Correo de Registro con "Crear mi contraseña" (best-effort: la cuenta ya existe)
      const warning = await UserService.sendRegistroEmail(
        userData.email,
        userData.nombre || '',
        userData.usuario || userData.email
      );

      return warning ? { user: newUser as UserProfile, warning } : { user: newUser as UserProfile };
    } catch (error) {
      console.error('[UserService] Error creating user:', error);
      throw error;
    }
  }

  /**
   * Actualizar usuario
   */
  static async updateUser(userId: number, updates: UserProfileUpdate): Promise<UserProfile> {
    try {
      assertValidRuts(updates);
      const admin = getSupabaseAdmin();

      console.log('🔄 UserService.updateUser - Starting update:', { userId, updates });

      // First, verify the user exists
      const existingUser = await this.getUserById(userId);
      if (!existingUser) {
        console.error('❌ User not found in updateUser:', userId);
        throw new Error(`Usuario con ID ${userId} no encontrado`);
      }

      console.log('✅ User exists, current data:', {
        user_id: existingUser.user_id,
        email: existingUser.email,
        current_url_rut_anverso: existingUser.url_rut_anverso
      });

      // Try direct update first (this should work with proper RLS policies)
      console.log('🔍 Attempting direct update...');
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await admin
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select();

      console.log('📊 Direct update result:', { data, error, affectedRows: data?.length });

      // If direct update fails or affects 0 rows, use the admin function
      if (error || !data || data.length === 0) {
        console.log('🔍 Direct update failed, using admin function...');

        // Use the comprehensive admin function with all updates as JSONB
        const updatesJson = JSON.stringify(updates);

        console.log('📝 Calling update_user_profile_admin_full with updates:', updatesJson);

        const { data: sqlFunctionResult, error: sqlFunctionError } = await admin
          .rpc('update_user_profile_admin_full' as any, {
            p_user_id: userId,
            p_updates: updatesJson
          });

        console.log('📊 SQL function result:', { sqlFunctionResult, sqlFunctionError });

        if (sqlFunctionError) {
          console.error('❌ SQL function failed:', sqlFunctionError);
          throw new Error(`Error en función SQL: ${sqlFunctionError.message}`);
        }

        if (!sqlFunctionResult || (Array.isArray(sqlFunctionResult) && sqlFunctionResult.length === 0)) {
          throw new Error('La función SQL no retornó datos del usuario actualizado');
        }

        const updatedUser = Array.isArray(sqlFunctionResult) ? sqlFunctionResult[0] : sqlFunctionResult;
        console.log('✅ User updated via SQL function:', {
          user_id: (updatedUser as any).user_id,
          updated_fields: Object.keys(updates)
        });
        return updatedUser as UserProfile;
      }

      // Direct update succeeded
      const updatedUser = data[0];

      if (!updatedUser) {
        console.error('❌ No user data in update result');
        throw new Error('No se pudo obtener los datos actualizados del usuario');
      }

      console.log('✅ User updated successfully via direct update:', {
        user_id: updatedUser.user_id,
        updated_fields: Object.keys(updates)
      });

      return updatedUser;
    } catch (error) {
      console.error('❌ Error updating user:', error);
      throw error;
    }
  }

  /**
   * Eliminar usuario (soft delete - marcar como inactivo)
   */
  static async deleteUser(userId: number): Promise<boolean> {
    try {
      // En lugar de eliminar, podríamos marcar como inactivo
      // Por ahora, eliminamos completamente
      const admin = getSupabaseAdmin();
      const { error } = await admin
        .from('user_profiles')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }

  /**
   * Buscar usuarios por término
   */
  static async searchUsers(searchTerm: string, page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;

      const admin = getSupabaseAdmin();

      let query = admin
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .order('user_id', { ascending: false })
        .range(offset, offset + limit - 1);

      if (searchTerm.trim()) {
        query = query.or(
          `nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`
        );
      }

      const { data, error, count } = await query;

      if (error) {
        throw error;
      }

      return {
        users: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit),
        searchTerm
      };
    } catch (error) {
      console.error('Error searching users:', error);
      throw error;
    }
  }

  /**
   * Obtener usuarios de auth.users que no tienen perfil en user_profiles
   */
  static async getOrphanedAuthUsers() {
    try {
      const admin = getSupabaseAdmin();

      // Get all auth users with pagination (default perPage en Supabase SDK es 50)
      const allAuthUsers: any[] = [];
      let page = 1;
      const perPage = 100;

      while (true) {
        const { data, error: pageError } = await admin.auth.admin.listUsers({ page, perPage });
        if (pageError) throw pageError;
        allAuthUsers.push(...(data.users || []));
        if ((data.users || []).length < perPage) break;
        page++;
      }

      const authUsers = allAuthUsers;

      // Get all auth_uids from user_profiles
      const { data: profiles, error: profileError } = await admin
        .from('user_profiles')
        .select('auth_uid');
      if (profileError) throw profileError;

      const profileAuthUids = new Set(profiles?.map(p => p.auth_uid) || []);

      // Filter auth users without profiles
      const orphaned = authUsers
        .filter(u => !profileAuthUids.has(u.id))
        .map(u => ({
          auth_uid: u.id,
          email: u.email || '',
          created_at: u.created_at
        }));

      return orphaned;
    } catch (error) {
      console.error('[UserService] Error obteniendo usuarios huérfanos:', error);
      throw error;
    }
  }

  /**
   * Crear perfil básico para un usuario de auth huérfano
   */
  static async createProfileForOrphan(authUid: string, email: string): Promise<UserProfile> {
    try {
      const admin = getSupabaseAdmin();

      const username = email.split('@')[0] || '';

      const { data, error } = await admin
        .from('user_profiles')
        .insert({
          auth_uid: authUid,
          email: email,
          nombre: username,
          apellido: '',
          usuario: username,
          pais: 'Chile',
          tipo_cliente: 'natural',
          terminos_aceptados: false
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    } catch (error) {
      console.error('[UserService] Error creando perfil para huérfano:', { authUid, email, error });
      throw error;
    }
  }

  /**
   * Obtener estadísticas de usuarios
   */
  static async getUserStats() {
    try {
      const admin = getSupabaseAdmin();

      // Total de usuarios
      const { count: totalUsers, error: totalError } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true });

      if (totalError) throw totalError;

      // Usuarios con contratos firmados
      const { count: usersWithContracts, error: contractsError } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .not('url_user_contrato', 'is', null);

      if (contractsError) throw contractsError;

      // Usuarios que aceptaron términos
      const { count: usersWithTerms, error: termsError } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .eq('terminos_aceptados', true);

      if (termsError) throw termsError;

      // Usuarios registrados en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentUsers, error: recentError } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', thirtyDaysAgo.toISOString());

      if (recentError) throw recentError;

      return {
        totalUsers: totalUsers || 0,
        usersWithContracts: usersWithContracts || 0,
        usersWithTerms: usersWithTerms || 0,
        recentUsers: recentUsers || 0,
        contractCompletionRate: totalUsers ? ((usersWithContracts || 0) / totalUsers * 100).toFixed(1) : '0',
        termsAcceptanceRate: totalUsers ? ((usersWithTerms || 0) / totalUsers * 100).toFixed(1) : '0'
      };
    } catch (error) {
      console.error('Error fetching user stats:', error);
      throw error;
    }
  }
}
