import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { withAuth } from '../../../middleware/auth';
// withCors and withMiddleware removed - global middleware handles CORS

export const GET: APIRoute = withAuth(async (context: any) => {
  try {
    const userId = parseInt(context.params.id as string);
    
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const user = await UserService.getUserById(userId);

    if (!user) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(JSON.stringify(user), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching user:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const PUT: APIRoute = withAuth(async (context: any) => {
  try {
    const userId = parseInt(context.params.id as string);
    
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const updates = await context.request.json();
    
    const updatedUser = await UserService.updateUser(userId, updates);

    return new Response(JSON.stringify(updatedUser), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error updating user:', error);
    return new Response(
      JSON.stringify({ error: 'Error al actualizar usuario' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const PATCH: APIRoute = withAuth(async (context: any) => {
  try {
    const userId = parseInt(context.params.id as string);
    
    console.log('📝 PATCH /api/users/[id] - Received request:', { userId, params: context.params });
    
    if (isNaN(userId)) {
      console.error('❌ Invalid user ID:', context.params.id);
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const updates = await context.request.json();
    console.log('📝 Update data received:', updates);
    
    // First check if user exists
    const existingUser = await UserService.getUserById(userId);
    if (!existingUser) {
      console.error('❌ User not found:', userId);
      return new Response(
        JSON.stringify({ error: `Usuario con ID ${userId} no encontrado` }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
    
    console.log('✅ User found, proceeding with update:', { userId, existingUser: { user_id: existingUser.user_id, email: existingUser.email } });
    
    const updatedUser = await UserService.updateUser(userId, updates);
    
    console.log('✅ User updated successfully:', { userId, updatedFields: Object.keys(updates) });

    return new Response(JSON.stringify(updatedUser), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('❌ Error updating user:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Error al actualizar usuario',
        details: error instanceof Error ? error.message : 'Error desconocido'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const DELETE: APIRoute = withAuth(async (context: any) => {
  try {
    const userId = parseInt(context.params.id as string);
    
    if (isNaN(userId)) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario inválido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    await UserService.deleteUser(userId);

    return new Response(JSON.stringify({ message: 'Usuario eliminado correctamente' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error deleting user:', error);
    return new Response(
      JSON.stringify({ error: 'Error al eliminar usuario' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
