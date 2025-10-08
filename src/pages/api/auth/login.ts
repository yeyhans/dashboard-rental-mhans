import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { withCors } from '../../../middleware/auth';

interface LoginRequest {
  email: string;
  password: string;
}

export const POST: APIRoute = withCors(async (context) => {
  try {
    const { email, password }: LoginRequest = await context.request.json();

    // Basic validation
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email y contraseña son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (authError || !authData.user) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Credenciales inválidas'
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verify admin user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', authData.user.id)
      .eq('role', 'admin')
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acceso denegado. Permisos de administrador requeridos.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Configurar sesión extendida para administradores (30 días)
    if (authData.session) {
      const { access_token, refresh_token } = authData.session;
      
      // Configuración profesional de cookies para sesión extendida
      const EXTENDED_SESSION_DAYS = 30;
      const extendedMaxAge = 60 * 60 * 24 * EXTENDED_SESSION_DAYS; // 30 días en segundos
      const isProduction = import.meta.env.PROD;
      
      // Configuración base de cookies
      const cookieConfig = {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax' as const,
      };
      
      // Tokens de autenticación
      context.cookies.set('sb-access-token', access_token, cookieConfig);
      context.cookies.set('sb-refresh-token', refresh_token, cookieConfig);
      
      // Marcador de sesión administrativa extendida
      context.cookies.set('sb-admin-session', 'true', {
        ...cookieConfig,
        httpOnly: false, // Accesible desde JavaScript para verificaciones rápidas
      });
      
      // Fecha de expiración para verificación rápida
      const expiryDate = new Date(Date.now() + extendedMaxAge * 1000);
      context.cookies.set('sb-session-expiry', expiryDate.toISOString(), {
        ...cookieConfig,
        httpOnly: false, // Accesible desde JavaScript
      });
      
      console.log('✅ Sesión extendida configurada hasta:', expiryDate.toLocaleDateString());
    }

    // Preparar respuesta con información de sesión extendida
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: adminUser.role,
          admin_id: adminUser.id
        },
        session: {
          access_token: authData.session?.access_token,
          expires_at: sessionExpiry.toISOString(),
          is_extended: true,
          duration_days: 30
        },
        admin: {
          verified: true,
          role: adminUser.role,
          email: adminUser.email
        }
      },
      message: `✅ Bienvenido ${adminUser.email} - Sesión configurada hasta ${sessionExpiry.toLocaleDateString('es-ES')}`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
});
