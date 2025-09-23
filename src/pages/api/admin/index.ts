import type { APIRoute } from 'astro';
import { AdminService } from '../../../services/adminService';
import { withMiddleware, withCors, withAuth } from '../../../middleware/auth';

export const GET: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const admins = await AdminService.getAllAdmins();

    return new Response(JSON.stringify(admins), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error fetching admins:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});

export const POST: APIRoute = withMiddleware(withCors, withAuth)(async (context) => {
  try {
    const adminData = await context.request.json();
    
    const newAdmin = await AdminService.addAdmin(adminData);

    return new Response(JSON.stringify(newAdmin), {
      status: 201,
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (error) {
    console.error('Error creating admin:', error);
    return new Response(
      JSON.stringify({ error: 'Error al crear administrador' }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
});
