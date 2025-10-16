import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { withAuth } from '../../../middleware/auth';
// withCors and withMiddleware removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context) => {
  try {
    console.log('=== DEBUG: Starting users API call ===');
    
    const url = new URL(context.request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');

    console.log('Parameters:', { page, limit, search });

    let result;
    if (search) {
      console.log('Calling searchUsers...');
      result = await UserService.searchUsers(search, page, limit);
    } else {
      console.log('Calling getAllUsers...');
      result = await UserService.getAllUsers(page, limit);
    }

    console.log('UserService result:', result);

    // Devolver en el formato esperado por CreateOrderForm
    return new Response(JSON.stringify({
      success: true,
      data: result
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('=== ERROR in users API ===');
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

export const POST: APIRoute = withAuth(async (context) => {
  try {
    const userData = await context.request.json();
    
    const newUser = await UserService.createUser(userData);

    return new Response(JSON.stringify(newUser), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear usuario' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
