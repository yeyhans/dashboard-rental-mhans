import type { APIRoute } from 'astro';
import { getServerAdmin } from '../../../lib/supabase';

export const GET: APIRoute = async (context) => {
  try {
    const adminSession = await getServerAdmin(context);

    if (!adminSession) {
      return new Response(
        JSON.stringify({ success: false, error: 'No hay sesión activa' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: {
            id: adminSession.user.id,
            email: adminSession.user.email,
          },
          admin: {
            role: adminSession.admin.role,
            email: adminSession.admin.email,
          },
          expiresAt: adminSession.expiresAt.toISOString(),
          isExtended: adminSession.isExtended,
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[Session] Error:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error interno del servidor' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
