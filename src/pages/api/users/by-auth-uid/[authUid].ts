import type { APIRoute } from 'astro';
import { UserService } from '../../../../services/userService';
import { withMiddleware, withCors, withAuth } from '../../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context: any) => {
  try {
    const authUid = context.params.authUid as string;
    
    console.log('🔍 GET /api/users/by-auth-uid/[authUid] - Looking up user:', { authUid });
    
    if (!authUid) {
      console.error('❌ No auth_uid provided');
      return new Response(
        JSON.stringify({ error: 'auth_uid es requerido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const user = await UserService.getUserByAuthUid(authUid);

    if (!user) {
      console.error('❌ User not found by auth_uid:', authUid);
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    console.log('✅ User found by auth_uid:', { authUid, user_id: user.user_id, email: user.email });

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error fetching user by auth_uid:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
