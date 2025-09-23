import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    console.log('=== DEBUG: Starting user stats API call ===');
    
    const stats = await UserService.getUserStats();
    
    console.log('UserService stats result:', stats);

    return new Response(JSON.stringify({
      success: true,
      data: stats
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('=== ERROR in user stats API ===');
    console.error('Error details:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error instanceof Error ? error.message : 'Error interno del servidor' 
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
