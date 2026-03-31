import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types/database';
import type { APIContext } from 'astro';
import type { AstroGlobal } from 'astro';
import type { User } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.PUBLIC_SUPABASE_URL;
const supabaseServiceKey = import.meta.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = import.meta.env.PUBLIC_SUPABASE_ANON_KEY;

// Cliente con service_role para operaciones administrativas (solo servidor)
let supabaseAdmin: ReturnType<typeof createClient<Database>> | null = null;

// Solo crear el cliente admin en el servidor
if (typeof window === 'undefined') {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Variables de entorno faltantes para Supabase Admin Client');
    throw new Error('Missing Supabase environment variables for service role');
  }

  try {
    supabaseAdmin = createClient<Database>(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      },
      db: {
        schema: 'public'
      }
    });
  } catch (error) {
    console.error('❌ Error creando Supabase Admin Client:', error);
    throw error;
  }
}

export { supabaseAdmin };

// Types for authentication
export interface AuthenticatedUser {
  auth: User | null;
  profile: Database['public']['Tables']['user_profiles']['Row'] | null;
}

export interface AdminUser {
  id: number;
  user_id: string;
  email: string;
  role: string;
  created_at: string;
}

export interface ExtendedSession {
  user: User;
  admin: AdminUser;
  expiresAt: Date;
  isExtended: boolean;
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

// Cookie config reutilizable para tokens de auth
export const getAuthCookieConfig = () => ({
  path: '/',
  maxAge: 60 * 60 * 24 * 30, // 30 días
  httpOnly: true,
  secure: import.meta.env.PROD,
  sameSite: 'strict' as const,
});

// Authentication functions for backend
export const getServerUser = async (context: APIContext | AstroGlobal) => {
  try {
    if (!supabase) {
      console.error('[Auth] Supabase client not available');
      return null;
    }

    const accessToken = context.cookies.get('sb-access-token')?.value;
    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    if (!accessToken) {
      console.log('[Auth] No access token found in cookies');
      return null;
    }

    // 1. Intentar con el access token actual
    const { data: { user }, error } = await supabase.auth.getUser(accessToken);

    if (!error && user) {
      return user;
    }

    // 2. Access token expirado — intentar refresh
    console.log('[Auth] Access token expired, attempting refresh...');

    if (!refreshToken) {
      console.log('[Auth] No refresh token available');
      return null;
    }

    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (refreshError || !refreshData.session || !refreshData.user) {
      console.error('[Auth] Token refresh failed:', refreshError?.message);
      return null;
    }

    // 3. Refresh exitoso — actualizar cookies con nuevos tokens
    if (typeof context.cookies.set === 'function') {
      const cookieConfig = getAuthCookieConfig();
      context.cookies.set('sb-access-token', refreshData.session.access_token, cookieConfig);
      context.cookies.set('sb-refresh-token', refreshData.session.refresh_token, cookieConfig);
      console.log('[Auth] Tokens refreshed and cookies updated');
    }

    return refreshData.user;
  } catch (error) {
    console.error('[Auth] Error in getServerUser:', error);
    return null;
  }
};

// Función optimizada para verificar admin con cache
const adminCache = new Map<string, { admin: AdminUser | null, timestamp: number }>();
const ADMIN_CACHE_TTL = 5 * 60 * 1000; // 5 minutos

export const getServerAdmin = async (context: APIContext | AstroGlobal): Promise<ExtendedSession | null> => {
  try {
    const user = await getServerUser(context);
    if (!user) {
      console.log('🔒 No user found in session');
      return null;
    }

    // Check admin cache first
    const cached = adminCache.get(user.id);
    if (cached && (Date.now() - cached.timestamp) < ADMIN_CACHE_TTL) {
      if (!cached.admin) {
        console.log('🔒 User not admin (cached)');
        return null;
      }
      
      return {
        user,
        admin: cached.admin,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
        isExtended: true
      };
    }

    if (!supabaseAdmin) {
      console.error('❌ Supabase admin client not available');
      return null;
    }

    // Verify admin user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    // Cache the result
    adminCache.set(user.id, {
      admin: adminUser,
      timestamp: Date.now()
    });

    if (adminError || !adminUser) {
      console.log('🔒 User is not admin:', user.email);
      return null;
    }

    console.log('✅ Admin verified:', adminUser.email);
    return {
      user,
      admin: adminUser,
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 días
      isExtended: true
    };
  } catch (error) {
    console.error('❌ Error in getServerAdmin:', error);
    return null;
  }
};

// Función para verificar si una sesión extendida es válida
export const isExtendedSessionValid = (context: APIContext | AstroGlobal): boolean => {
  const adminSession = context.cookies.get('sb-admin-session')?.value;
  const sessionExpiry = context.cookies.get('sb-session-expiry')?.value;
  
  if (!adminSession || adminSession !== 'true') return false;
  if (!sessionExpiry) return false;
  
  const expiryDate = new Date(sessionExpiry);
  return expiryDate > new Date();
};

// Función para limpiar cookies de sesión
export const clearAuthCookies = (context: APIContext | AstroGlobal) => {
  const cookiesToClear = [
    'sb-access-token',
    'sb-refresh-token', 
    'sb-admin-session',
    'sb-session-expiry'
  ];
  
  cookiesToClear.forEach(name => {
    context.cookies.delete(name, { path: '/' });
  });
  
  console.log('🧹 Auth cookies cleared');
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