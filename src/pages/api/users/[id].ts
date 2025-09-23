import type { APIRoute } from 'astro';
import { UserService } from '../../../services/userService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
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

export const PUT: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
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

export const DELETE: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
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
