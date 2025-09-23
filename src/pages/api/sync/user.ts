import type { APIRoute } from 'astro';
import { BackendApiService } from '../../../services/backendApiService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const POST: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const userData = await context.request.json();
    
    if (!userData.auth_uid || !userData.email) {
      return new Response(
        JSON.stringify({ error: 'auth_uid y email son requeridos' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const syncedUser = await BackendApiService.syncUserFromFrontend(userData);

    return new Response(JSON.stringify(syncedUser), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error syncing user:', error);
    return new Response(
      JSON.stringify({ error: 'Error al sincronizar usuario' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
