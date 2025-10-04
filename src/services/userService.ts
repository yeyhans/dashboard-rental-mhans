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
   * Crear nuevo usuario
   */
  static async createUser(userData: UserProfileInsert): Promise<UserProfile> {
    try {
      const admin = getSupabaseAdmin();
    const { data, error } = await admin
        .from('user_profiles')
        .insert([userData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
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
      
      // First, let's verify the user exists and get current data
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
      
      // Add updated_at timestamp
      const updateData = {
        ...updates,
        updated_at: new Date().toISOString()
      };
      
      console.log('📝 Executing update with data:', updateData);
      
      // First, let's test if we can perform a simple select to verify permissions
      console.log('🔍 Testing read permissions...');
      const { data: testRead, error: testReadError } = await admin
        .from('user_profiles')
        .select('user_id, email, url_rut_anverso')
        .eq('user_id', userId);
      
      console.log('📊 Read test result:', { testRead, testReadError });
      
      // Try a minimal update first to test permissions
      console.log('🔍 Testing minimal update...');
      const { data: testUpdate, error: testUpdateError, count: testCount } = await admin
        .from('user_profiles')
        .update({ updated_at: new Date().toISOString() })
        .eq('user_id', userId)
        .select();
      
      console.log('📊 Minimal update test:', { testUpdate, testUpdateError, testCount, affectedRows: testUpdate?.length });
      
      if (testUpdateError) {
        console.error('❌ Minimal update failed, permissions issue:', testUpdateError);
        throw new Error(`Error de permisos en actualización: ${testUpdateError.message}`);
      }
      
      if (!testUpdate || testUpdate.length === 0) {
        console.error('❌ Minimal update affected 0 rows - RLS or permissions issue');
        
        // Use the SQL function that bypasses RLS
        console.log('🔍 Using SQL function to bypass RLS...');
        
        // Prepare parameters for the SQL function
        const functionParams = {
          p_user_id: userId,
          p_url_rut_anverso: updates.url_rut_anverso || null,
          p_url_rut_reverso: updates.url_rut_reverso || null,
          p_url_firma: updates.url_firma || null,
          p_new_url_e_rut_empresa: updates.new_url_e_rut_empresa || null
        };
        
        console.log('📝 Calling update_user_profile_admin with params:', functionParams);
        
        const { data: sqlFunctionResult, error: sqlFunctionError } = await admin
          .rpc('update_user_profile_admin' as any, functionParams);
        
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
          updated_fields: Object.keys(updates),
          new_url_rut_anverso: (updatedUser as any).url_rut_anverso 
        });
        return updatedUser as UserProfile;
      }
      
      // If minimal update worked, proceed with full update
      console.log('✅ Minimal update successful, proceeding with full update...');
      const { data, error, count } = await admin
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select();

      console.log('📊 Full update result:', { data, error, count, affectedRows: data?.length });

      if (error) {
        console.error('❌ Supabase update error:', error);
        throw error;
      }
      
      if (!data || data.length === 0) {
        console.error('❌ No rows affected by update');
        throw new Error('No se pudo actualizar el usuario - ninguna fila afectada');
      }
      
      if (data.length > 1) {
        console.warn('⚠️ Multiple rows affected by update:', data.length);
      }
      
      const updatedUser = data[0]; // Take the first (should be only) result
      
      if (!updatedUser) {
        console.error('❌ No user data in update result');
        throw new Error('No se pudo obtener los datos actualizados del usuario');
      }

      console.log('✅ User updated successfully:', { 
        user_id: updatedUser.user_id, 
        updated_fields: Object.keys(updates),
        new_url_rut_anverso: updatedUser.url_rut_anverso 
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
