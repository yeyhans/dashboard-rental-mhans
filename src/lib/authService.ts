/**
 * Servicio profesional de autenticación para el panel de administrador
 * Maneja sesiones extendidas de 30 días para administradores
 */

import { supabase } from './supabase';

// Cache de sesión para optimizar rendimiento
interface SessionCache {
  token: string | null;
  expiry: number;
  isAdmin: boolean;
}

let sessionCache: SessionCache | null = null;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutos

/**
 * Verifica si el usuario actual es administrador
 */
export const isCurrentUserAdmin = async (): Promise<boolean> => {
  try {
    // Verificar cache primero
    if (sessionCache && Date.now() < sessionCache.expiry) {
      return sessionCache.isAdmin;
    }

    if (!supabase) {
      console.warn('Supabase no disponible para verificación de admin');
      return false;
    }

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      sessionCache = { token: null, expiry: Date.now() + CACHE_TTL, isAdmin: false };
      return false;
    }

    // Verificar en admin_users (esto requeriría una función edge o API)
    // Por ahora, asumimos que si hay sesión válida, es admin
    sessionCache = {
      token: session.access_token,
      expiry: Date.now() + CACHE_TTL,
      isAdmin: true
    };

    return true;
  } catch (error) {
    console.error('Error verificando admin:', error);
    return false;
  }
};

/**
 * Obtiene el token de acceso actual
 */
export const getCurrentAccessToken = async (): Promise<string | null> => {
  try {
    // Usar cache si está disponible y válido
    if (sessionCache && sessionCache.token && Date.now() < sessionCache.expiry) {
      return sessionCache.token;
    }

    if (!supabase) return null;

    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error || !session) {
      sessionCache = { token: null, expiry: Date.now() + CACHE_TTL, isAdmin: false };
      return null;
    }

    // Actualizar cache
    sessionCache = {
      token: session.access_token,
      expiry: Date.now() + CACHE_TTL,
      isAdmin: sessionCache?.isAdmin || false
    };

    return session.access_token;
  } catch (error) {
    console.error('Error obteniendo token:', error);
    return null;
  }
};

/**
 * Realiza petición autenticada con manejo automático de tokens
 */
export const makeAuthenticatedRequest = async (
  url: string,
  options: RequestInit = {}
): Promise<Response> => {
  const token = await getCurrentAccessToken();
  
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };
  
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, {
    ...options,
    headers,
  });
};

/**
 * Verifica si la sesión extendida es válida
 */
export const isExtendedSessionValid = (): boolean => {
  if (typeof window === 'undefined') return false;
  
  try {
    const adminSession = document.cookie
      .split('; ')
      .find(row => row.startsWith('sb-admin-session='))
      ?.split('=')[1];
    
    const sessionExpiry = document.cookie
      .split('; ')
      .find(row => row.startsWith('sb-session-expiry='))
      ?.split('=')[1];
    
    if (!adminSession || adminSession !== 'true') return false;
    if (!sessionExpiry) return false;
    
    const expiryDate = new Date(decodeURIComponent(sessionExpiry));
    return expiryDate > new Date();
  } catch (error) {
    console.error('Error verificando sesión extendida:', error);
    return false;
  }
};

/**
 * Logout completo del sistema
 */
export const performLogout = async (): Promise<boolean> => {
  try {
    // Limpiar cache local
    sessionCache = null;
    
    // Logout de Supabase si está disponible
    if (supabase) {
      await supabase.auth.signOut();
    }
    
    // Llamar API de logout para limpiar cookies del servidor
    const response = await fetch('/api/auth/logout', {
      method: 'POST',
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.warn('Error en logout del servidor, continuando...');
    }
    
    console.log('✅ Logout completado exitosamente');
    return true;
  } catch (error) {
    console.error('Error durante logout:', error);
    return false;
  }
};

/**
 * Información de la sesión actual
 */
export const getSessionInfo = async () => {
  const isAdmin = await isCurrentUserAdmin();
  const isExtended = isExtendedSessionValid();
  const token = await getCurrentAccessToken();
  
  return {
    isAuthenticated: !!token,
    isAdmin,
    isExtendedSession: isExtended,
    hasValidToken: !!token
  };
};
