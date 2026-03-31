import type { APIRoute } from 'astro';
import { supabase, clearAuthCookies, getAuthCookieConfig } from '../../../lib/supabase';
import { withCors } from '../../../middleware/auth';

export const POST: APIRoute = withCors(async (context) => {
  try {
    if (!supabase) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Supabase no configurado'
      }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }

    const refreshToken = context.cookies.get('sb-refresh-token')?.value;

    if (!refreshToken) {
      return new Response(JSON.stringify({
        success: false,
        error: 'No hay refresh token disponible'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    const { data, error } = await supabase.auth.refreshSession({
      refresh_token: refreshToken,
    });

    if (error || !data.session) {
      console.error('[Auth Refresh] Failed:', error?.message);
      clearAuthCookies(context);
      return new Response(JSON.stringify({
        success: false,
        error: 'Sesión expirada, por favor inicia sesión nuevamente'
      }), { status: 401, headers: { 'Content-Type': 'application/json' } });
    }

    // Actualizar cookies con nuevos tokens
    const cookieConfig = getAuthCookieConfig();
    context.cookies.set('sb-access-token', data.session.access_token, cookieConfig);
    context.cookies.set('sb-refresh-token', data.session.refresh_token, cookieConfig);

    console.log('[Auth Refresh] Session refreshed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Sesión renovada'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('[Auth Refresh] Error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), { status: 500, headers: { 'Content-Type': 'application/json' } });
  }
});

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
});
