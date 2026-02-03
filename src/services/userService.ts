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
   * Crear nuevo usuario usando función RPC que bypasa RLS
   */
  static async createUser(userData: UserProfileInsert): Promise<UserProfile> {
    try {
      const admin = getSupabaseAdmin();

      console.log('📝 Creating user with data:', { email: userData.email, nombre: userData.nombre });

      // Usar función RPC que bypasa RLS (SECURITY DEFINER)
      const { data, error } = await admin
        .rpc('admin_create_user_profile' as any, {
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
        console.error('❌ Error in admin_create_user_profile RPC:', error);
        throw error;
      }

      // La función RPC retorna un array, tomamos el primer elemento
      const newUser = Array.isArray(data) ? data[0] : data;

      if (!newUser) {
        throw new Error('No se pudo crear el usuario');
      }

      console.log('✅ User created successfully:', { user_id: newUser.user_id, email: newUser.email });
      return newUser as UserProfile;
    } catch (error) {
      console.error('Error creating user:', error);
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
      const { data, error, count } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .or(`nombre.ilike.%${searchTerm}%,apellido.ilike.%${searchTerm}%,email.ilike.%${searchTerm}%`)
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
        .eq('terms_accepted', '1');

      if (termsError) throw termsError;

      // Usuarios registrados en los últimos 30 días
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const { count: recentUsers, error: recentError } = await admin
        .from('user_profiles')
        .select('*', { count: 'exact', head: true })
        .gte('fecha_creacion', thirtyDaysAgo.toISOString());

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
