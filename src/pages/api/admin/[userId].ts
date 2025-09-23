import type { APIRoute } from 'astro';
import { AdminService } from '../../../services/adminService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const userId = context.params.userId as string;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario requerido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    const admin = await AdminService.getAdminByUserId(userId);

    if (!admin) {
      return new Response(
        JSON.stringify({ error: 'Administrador no encontrado' }),
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(JSON.stringify(admin), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching admin:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const DELETE: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const userId = context.params.userId as string;
    
    if (!userId) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario requerido' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    await AdminService.removeAdmin(userId);

    return new Response(JSON.stringify({ message: 'Administrador removido correctamente' }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error removing admin:', error);
    return new Response(
      JSON.stringify({ error: 'Error al remover administrador' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
