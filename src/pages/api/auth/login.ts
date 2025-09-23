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

    // Set Supabase session cookies on the response
    if (authData.session) {
      const { access_token, refresh_token, expires_in } = authData.session;
      context.cookies.set('sb-access-token', access_token, {
        path: '/',
        maxAge: expires_in,
        httpOnly: true,
        secure: import.meta.env.PROD,
        sameSite: 'lax',
      });
      context.cookies.set('sb-refresh-token', refresh_token, {
        path: '/',
        maxAge: 60 * 60 * 24 * 30, // 30 days
        httpOnly: true,
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
        }
      },
      message: 'Inicio de sesión exitoso'
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
