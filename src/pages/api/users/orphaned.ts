import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { withAuth } from '../../../middleware/auth';

// GET: List orphaned auth users (no profile)
export const GET: APIRoute = withAuth(async (_context) => {
  try {
    const orphaned = await UserService.getOrphanedAuthUsers();

    return new Response(
      JSON.stringify({ success: true, data: orphaned }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[GET /api/users/orphaned] Error obteniendo usuarios huérfanos:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al obtener usuarios sin perfil' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});

// POST: Create profile for an orphaned user (body: { auth_uid, email })
export const POST: APIRoute = withAuth(async (context) => {
  try {
    let body: { auth_uid?: string; email?: string };
    try {
      body = await context.request.json();
    } catch {
      return new Response(
        JSON.stringify({ success: false, error: 'JSON inválido' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!body.auth_uid || !body.email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Se requieren auth_uid y email' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const newProfile = await UserService.createProfileForOrphan(body.auth_uid, body.email);

    return new Response(
      JSON.stringify({ success: true, data: newProfile }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('[POST /api/users/orphaned] Error creando perfil para huérfano:', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Error al crear perfil para el usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
});
