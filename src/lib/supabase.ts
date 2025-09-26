import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { APIContext } from 'astro';
import type { AstroGlobal } from 'astro';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Cliente con service_role para operaciones administrativas (solo servidor)
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

// Solo crear el cliente admin en el servidor
if (typeof window === 'undefined') {
  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase environment variables for service role');
  }
  
  supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    },
    db: {
      schema: 'public'
    }
  });
}

export { supabaseAdmin };

// Types for authentication
export interface AuthenticatedUser {
  auth: any;
  profile: Database['public']['Tables']['user_profiles']['Row'] | null;
}

// Cliente regular para autenticación de usuarios (cliente y servidor)
export const supabase = supabaseUrl && supabaseAnonKey ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  db: {
    schema: 'public'
  }
}) : null;

// Función para verificar conexión
export const testConnection = async () => {
  try {
    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not available');
      return false;
    }
    
    const { error } = await supabaseAdmin
      .from('user_profiles')
      .select('count')
      .limit(1);
    
    if (error) {
      console.error('Supabase connection test failed:', error);
      return false;
    }
    
    console.log('✅ Supabase connection successful');
    return true;
  } catch (error) {
    console.error('❌ Supabase connection error:', error);
    return false;
  }
};

// Authentication functions for backend
export const getServerUser = async (context: APIContext | AstroGlobal) => {
  try {
    if (!supabase) {
      console.error('❌ Supabase client not available');
      return null;
    }

    // Get session from cookies
    const accessToken = context.cookies.get('sb-access-token')?.value;
    // const refreshToken = context.cookies.get('sb-refresh-token')?.value; // For future use

    if (!accessToken) {
      console.log('🔍 No access token found in cookies');
      return null;
    }

    // Set session
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);
    
    if (error || !user) {
      console.error('❌ Error getting user:', error);
      return null;
    }

    console.log('✅ User authenticated:', user.id);
    return user;
  } catch (error) {
    console.error('❌ Error in getServerUser:', error);
    return null;
  }
};

export const getServerUserProfile = async (context: APIContext | AstroGlobal) => {
  try {
    const user = await getServerUser(context);
    if (!user) {
      return null;
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not available');
      return null;
    }

    // Get user profile
    const { data: profile, error } = await supabaseAdmin
      .from('user_profiles')
      .select('*')
      .eq('auth_uid', user.id)
      .single();

    if (error) {
      console.error('❌ Error getting user profile:', error);
      return null;
    }

    return {
      auth: user,
      profile: profile
    };
  } catch (error) {
    console.error('❌ Error in getServerUserProfile:', error);
    return null;
  }
};