import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

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
   * Generar contraseña temporal segura
   */
  private static generateTemporaryPassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    const special = '!@#$%&*';
    let password = '';
    for (let i = 0; i < 10; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    password += special.charAt(Math.floor(Math.random() * special.length));
    return password;
  }

  /**
   * Enviar email de bienvenida con credenciales temporales
   */
  private static async sendWelcomeEmail(
    email: string,
    nombre: string,
    temporaryPassword: string
  ): Promise<void> {
    try {
      const { Resend } = await import('resend');
      const resend = new Resend(import.meta.env.RESEND_API_KEY);

      const frontendUrl = import.meta.env.PUBLIC_FRONTEND_URL || 'https://rental.mariohans.cl';
      const emailDomain = import.meta.env.PUBLIC_EMAIL_DOMAIN || 'mail.mariohans.cl';

      const html = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #1a1a1a;">Bienvenido/a a Mario Hans Rental</h2>
          <p>Hola <strong>${nombre || 'Cliente'}</strong>,</p>
          <p>Tu cuenta ha sido creada exitosamente. A continuación te dejamos tus credenciales de acceso:</p>
          <div style="background-color: #f4f4f5; border-radius: 8px; padding: 20px; margin: 20px 0;">
            <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
            <p style="margin: 0;"><strong>Contraseña temporal:</strong> ${temporaryPassword}</p>
          </div>
          <p style="color: #dc2626; font-weight: bold;">Te recomendamos cambiar tu contraseña después de iniciar sesión.</p>
          <a href="${frontendUrl}/login" style="display: inline-block; background-color: #000; color: #fff; padding: 12px 24px; border-radius: 6px; text-decoration: none; margin-top: 10px;">
            Iniciar sesión
          </a>
          <hr style="margin: 30px 0; border: none; border-top: 1px solid #e4e4e7;" />
          <p style="color: #71717a; font-size: 14px;">
            Si tenés alguna consulta, escribinos a rental.mariohans@gmail.com<br/>
            Equipo Mario Hans Rental Fotográfico
          </p>
        </div>
      `;

      const { error } = await resend.emails.send({
        from: `Rental Mario Hans <admin@${emailDomain}>`,
        to: [email],
        cc: ['rental.mariohans@gmail.com'],
        subject: 'Bienvenido/a a Mario Hans Rental — Tus credenciales de acceso',
        html,
      });

      if (error) {
        console.error('[UserService] Error enviando email de bienvenida:', { email, error });
      } else {
        console.log('[UserService] Email de bienvenida enviado a:', email);
      }
    } catch (error) {
      // No lanzar error — el usuario ya fue creado, el email es best-effort
      console.error('[UserService] Error en sendWelcomeEmail:', error);
    }
  }

  /**
   * Crear nuevo usuario: primero en Supabase Auth, luego perfil via RPC
   */
  static async createUser(userData: UserProfileInsert): Promise<UserProfile> {
    try {
      const admin = getSupabaseAdmin();

      if (!userData.email) {
        throw new Error('El email es requerido');
      }

      console.log('[UserService] Creando usuario:', { email: userData.email, nombre: userData.nombre });

      // 1. Generar contraseña temporal
      const temporaryPassword = UserService.generateTemporaryPassword();

      // 2. Crear usuario en Supabase Auth
      const { data: authData, error: authError } = await admin.auth.admin.createUser({
        email: userData.email,
        password: temporaryPassword,
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

      // 3. Crear perfil via RPC con auth_uid
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

      // 4. Enviar email de bienvenida con credenciales (best-effort, no bloquea)
      const nombre = userData.nombre || '';
      UserService.sendWelcomeEmail(userData.email, nombre, temporaryPassword);

      return newUser as UserProfile;
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
