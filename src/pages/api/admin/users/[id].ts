import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabase";
import { withMiddleware, withAuth, withCors } from "../../../../middleware/auth";

/**
 * DELETE /api/admin/users/[id] - Eliminar usuario administrador
 */
const deleteAdminUser = async (context: any) => {
  try {
    const { id } = context.params;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario requerido' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar que el usuario existe
    const { data: existingAdmin, error: fetchError } = await supabaseAdmin
      .from('admin_users')
      .select('user_id, email')
      .eq('user_id', id)
      .single();

    if (fetchError || !existingAdmin) {
      return new Response(
        JSON.stringify({ error: 'Administrador no encontrado' }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Prevenir que el usuario se elimine a sí mismo
    if (context.user?.id === id) {
      return new Response(
        JSON.stringify({ error: 'No puedes eliminar tu propio acceso de administrador' }), 
        { 
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Eliminar el administrador
    const { error: deleteError } = await supabaseAdmin
      .from('admin_users')
      .delete()
      .eq('user_id', id);

    if (deleteError) {
      console.error('Error deleting admin user:', deleteError);
      return new Response(
        JSON.stringify({ error: 'Error al eliminar usuario administrador' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: `Administrador ${existingAdmin.email} eliminado correctamente`
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unexpected error in deleteAdminUser:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

/**
 * PUT /api/admin/users/[id] - Actualizar usuario administrador
 */
const updateAdminUser = async (context: any) => {
  try {
    const { id } = context.params;
    const body = await context.request.json();
    const { role } = body;

    if (!id) {
      return new Response(
        JSON.stringify({ error: 'ID de usuario requerido' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!role || !['admin', 'super_admin'].includes(role)) {
      return new Response(
        JSON.stringify({ error: 'Rol válido requerido (admin, super_admin)' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Actualizar el rol
    const { data: updatedAdmin, error: updateError } = await supabaseAdmin
      .from('admin_users')
      .update({ role })
      .eq('user_id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating admin user:', updateError);
      return new Response(
        JSON.stringify({ error: 'Error al actualizar usuario administrador' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    if (!updatedAdmin) {
      return new Response(
        JSON.stringify({ error: 'Administrador no encontrado' }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: updatedAdmin,
        message: 'Administrador actualizado correctamente'
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unexpected error in updateAdminUser:', error);
    return new Response(
      JSON.stringify({ error: 'Error interno del servidor' }), 
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
};

const handler = async (context: any) => {
  switch (context.request.method) {
    case 'DELETE':
      return deleteAdminUser(context);
    case 'PUT':
      return updateAdminUser(context);
    default:
      return new Response(
        JSON.stringify({ error: 'Método no permitido' }), 
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json' }
        }
      );
  }
};

export const DELETE: APIRoute = withMiddleware(withCors, withAuth)(handler);
export const PUT: APIRoute = withMiddleware(withCors, withAuth)(handler);
