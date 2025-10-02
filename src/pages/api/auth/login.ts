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

    // Set extended Supabase session cookies for administrators
    if (authData.session) {
      const { access_token, refresh_token } = authData.session;
      
      // Configuración extendida para administradores (30 días)
      const extendedMaxAge = 60 * 60 * 24 * 30; // 30 días
      
      context.cookies.set('sb-access-token', access_token, {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
      
      context.cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
      
      // Marcar como sesión de administrador extendida
      context.cookies.set('sb-admin-session', 'true', {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: false, // Permitir acceso desde JavaScript para verificaciones
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
      
      // Configurar fecha de expiración extendida
      const extendedExpiry = new Date();
      extendedExpiry.setDate(extendedExpiry.getDate() + 30);
      
      context.cookies.set('sb-session-expiry', extendedExpiry.toISOString(), {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: false, // Permitir acceso desde JavaScript
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
    }

    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: adminUser.role
        },
        session: {
          access_token: authData.session?.access_token,
          expires_at: authData.session?.expires_at
        },
        preferences: {
          remember_me: true,
          session_duration: 30 * 24 * 60 * 60, // 30 días en segundos
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }
      },
      message: 'Inicio de sesión exitoso - Sesión extendida configurada por 30 días'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
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
