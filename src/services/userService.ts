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
    const { data, error } = await admin
        .from('user_profiles')
        .update(updates)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error updating user:', error);
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
