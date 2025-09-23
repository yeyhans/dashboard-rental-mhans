import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type AdminUser = Database['public']['Tables']['admin_users']['Row'];
type AdminUserInsert = Database['public']['Tables']['admin_users']['Insert'];

export class AdminService {
  /**
   * Verificar si un usuario es administrador
   */
  static async isAdmin(userId: string): Promise<boolean> {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('id')
        .eq('user_id', userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return false; // Usuario no es admin
        }
        throw error;
      }

      return !!data;
    } catch (error) {
      console.error('Error checking admin status:', error);
      return false;
    }
  }

  /**
   * Obtener todos los administradores
   */
  static async getAllAdmins(): Promise<AdminUser[]> {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Error fetching admins:', error);
      throw error;
    }
  }

  /**
   * Agregar nuevo administrador
   */
  static async addAdmin(adminData: AdminUserInsert): Promise<AdminUser> {
    try {
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .insert([adminData])
        .select()
        .single();

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error adding admin:', error);
      throw error;
    }
  }

  /**
   * Remover administrador
   */
  static async removeAdmin(userId: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('admin_users')
        .delete()
        .eq('user_id', userId);

      if (error) {
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error removing admin:', error);
      throw error;
    }
  }

  /**
   * Obtener información de administrador por user_id
   */
  static async getAdminByUserId(userId: string): Promise<AdminUser | null> {
    try {
      console.log(`AdminService: Looking for admin with user_id: ${userId}`);
      
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        console.log(`AdminService: Error or no result for user_id ${userId}:`, error);
        if (error.code === 'PGRST116') {
          return null; // Admin no encontrado
        }
        throw error;
      }

      console.log(`AdminService: Found admin user:`, data);
      return data;
    } catch (error) {
      console.error('Error fetching admin by user_id:', error);
      throw error;
    }
  }

  /**
   * Obtener información de administrador por email (fallback)
   */
  static async getAdminByEmail(email: string): Promise<AdminUser | null> {
    try {
      console.log(`AdminService: Looking for admin with email: ${email}`);
      
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*')
        .eq('email', email)
        .single();

      if (error) {
        console.log(`AdminService: Error or no result for email ${email}:`, error);
        if (error.code === 'PGRST116') {
          return null; // Admin no encontrado
        }
        throw error;
      }

      console.log(`AdminService: Found admin user by email:`, data);
      return data;
    } catch (error) {
      console.error('Error fetching admin by email:', error);
      throw error;
    }
  }

  /**
   * Debug: Obtener todos los registros de admin_users para verificar datos
   */
  static async debugGetAllAdmins(): Promise<void> {
    try {
      console.log('=== DEBUG: Fetching all admin_users records ===');
      
      const { data, error } = await supabaseAdmin
        .from('admin_users')
        .select('*');

      if (error) {
        console.error('Debug: Error fetching all admins:', error);
        return;
      }

      console.log('Debug: All admin_users records:', JSON.stringify(data, null, 2));
      console.log(`Debug: Total records found: ${data?.length || 0}`);
      
      if (data && data.length > 0) {
        data.forEach((admin, index) => {
          console.log(`Debug: Admin ${index + 1}:`, {
            id: admin.id,
            user_id: admin.user_id,
            user_id_type: typeof admin.user_id,
            email: admin.email,
            role: admin.role
          });
        });
      }
    } catch (error) {
      console.error('Debug: Error in debugGetAllAdmins:', error);
    }
  }
}
