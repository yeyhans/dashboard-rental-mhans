import { supabaseAdmin } from '../lib/supabase';
import type { Database } from '../types/database';

type UserProfile = Database['public']['Tables']['user_profiles']['Row'];

/**
 * Servicio para integración con el frontend
 * Proporciona funcionalidades específicas que el frontend necesita
 */
export class BackendApiService {
  /**
   * Sincronizar usuario desde el frontend
   * Usado cuando el frontend crea/actualiza usuarios
   */
  static async syncUserFromFrontend(userData: {
    auth_uid: string;
    email: string;
    nombre?: string;
    apellido?: string;
    usuario?: string;
  }): Promise<UserProfile | null> {
    try {
      // Verificar si el usuario ya existe
      const { data: existingUser } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('auth_uid', userData.auth_uid)
        .single();

      if (existingUser) {
        // Actualizar usuario existente
        const { data: updatedUser, error } = await supabaseAdmin
          .from('user_profiles')
          .update({
            email: userData.email,
            nombre: userData.nombre || existingUser.nombre,
            apellido: userData.apellido || existingUser.apellido,
            usuario: userData.usuario || existingUser.usuario,
            updated_at: new Date().toISOString()
          })
          .eq('auth_uid', userData.auth_uid)
          .select()
          .single();

        if (error) throw error;
        return updatedUser;
      } else {
        // Crear nuevo usuario
        const { data: newUser, error } = await supabaseAdmin
          .from('user_profiles')
          .insert([{
            auth_uid: userData.auth_uid,
            email: userData.email,
            nombre: userData.nombre || '',
            apellido: userData.apellido || '',
            usuario: userData.usuario || userData.email?.split('@')[0] || '',
            pais: 'Chile',
            tipo_cliente: 'natural',
            terminos_aceptados: false
          }])
          .select()
          .single();

        if (error) throw error;
        return newUser;
      }
    } catch (error) {
      console.error('Error syncing user from frontend:', error);
      throw error;
    }
  }

  /**
   * Validar contrato de usuario
   * Verifica si el usuario tiene contrato firmado y términos aceptados
   */
  static async validateUserContract(userId: number): Promise<{
    hasContract: boolean;
    hasTerms: boolean;
    isEligibleForOrders: boolean;
    contractUrl?: string;
  }> {
    try {
      const { data: user, error } = await supabaseAdmin
        .from('user_profiles')
        .select('url_user_contrato, terms_accepted, terminos_aceptados')
        .eq('user_id', userId)
        .single();

      if (error) throw error;

      const hasContract = !!user.url_user_contrato;
      const hasTerms = user.terms_accepted === '1' || user.terminos_aceptados === true;
      const isEligibleForOrders = hasContract && hasTerms;

      return {
        hasContract,
        hasTerms,
        isEligibleForOrders,
        contractUrl: user.url_user_contrato || undefined
      };
    } catch (error) {
      console.error('Error validating user contract:', error);
      throw error;
    }
  }

  /**
   * Actualizar estado de contrato
   * Usado cuando el usuario completa el proceso de contrato
   */
  static async updateContractStatus(userId: number, updates: {
    contractUrl?: string;
    termsAccepted?: boolean;
    documentsUploaded?: boolean;
  }): Promise<UserProfile> {
    try {
      const updateData: any = {
        updated_at: new Date().toISOString()
      };

      if (updates.contractUrl) {
        updateData.url_user_contrato = updates.contractUrl;
      }

      if (updates.termsAccepted !== undefined) {
        updateData.terms_accepted = updates.termsAccepted ? '1' : '0';
        updateData.terminos_aceptados = updates.termsAccepted;
      }

      const { data: updatedUser, error } = await supabaseAdmin
        .from('user_profiles')
        .update(updateData)
        .eq('user_id', userId)
        .select()
        .single();

      if (error) throw error;
      return updatedUser;
    } catch (error) {
      console.error('Error updating contract status:', error);
      throw error;
    }
  }

  /**
   * Obtener usuarios elegibles para pedidos
   * Usuarios con contratos firmados y términos aceptados
   */
  static async getEligibleUsers(page: number = 1, limit: number = 10) {
    try {
      const offset = (page - 1) * limit;
      
      const { data, error, count } = await supabaseAdmin
        .from('user_profiles')
        .select('*', { count: 'exact' })
        .not('url_user_contrato', 'is', null)
        .eq('terms_accepted', '1')
        .order('updated_at', { ascending: false })
        .range(offset, offset + limit - 1);

      if (error) throw error;

      return {
        users: data,
        total: count || 0,
        page,
        limit,
        totalPages: Math.ceil((count || 0) / limit)
      };
    } catch (error) {
      console.error('Error fetching eligible users:', error);
      throw error;
    }
  }

  /**
   * Buscar usuarios por email o auth_uid
   * Útil para sincronización con el frontend
   */
  static async findUserByIdentifier(identifier: string): Promise<UserProfile | null> {
    try {
      // Intentar buscar por auth_uid primero (si parece ser un UUID)
      if (identifier.includes('-')) {
        const { data: userByAuthUid } = await supabaseAdmin
          .from('user_profiles')
          .select('*')
          .eq('auth_uid', identifier)
          .single();

        if (userByAuthUid) return userByAuthUid;
      }

      // Buscar por email
      const { data: userByEmail } = await supabaseAdmin
        .from('user_profiles')
        .select('*')
        .eq('email', identifier)
        .single();

      return userByEmail || null;
    } catch (error) {
      console.error('Error finding user by identifier:', error);
      return null;
    }
  }
}
