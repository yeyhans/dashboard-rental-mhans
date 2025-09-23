import type { APIRoute } from "astro";
import { supabaseAdmin } from "../../../../lib/supabase";
import { withMiddleware, withAuth, withCors } from "../../../../middleware/auth";

/**
 * GET /api/admin/users - Obtener todos los usuarios administradores
 */
const getAdminUsers = async (context: any) => {
  try {
    const { data: adminUsers, error } = await supabaseAdmin
      .from('admin_users')
      .select(`
        id,
        user_id,
        email,
        role,
        created_at
      `)
      .order('created_at', { ascending: false });

    if (error) {
      console.error('Error fetching admin users:', error);
      return new Response(
        JSON.stringify({ error: 'Error al obtener usuarios administradores' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: adminUsers,
        count: adminUsers?.length || 0
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unexpected error in getAdminUsers:', error);
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
 * POST /api/admin/users - Crear nuevo usuario administrador
 */
const createAdminUser = async (context: any) => {
  try {
    const body = await context.request.json();
    const { email } = body;

    if (!email) {
      return new Response(
        JSON.stringify({ error: 'Email es requerido' }), 
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Buscar el usuario en user_profiles
    const { data: userProfile, error: userError } = await supabaseAdmin
      .from('user_profiles')
      .select('auth_uid, email')
      .eq('email', email)
      .single();

    if (userError || !userProfile) {
      return new Response(
        JSON.stringify({ error: 'Usuario no encontrado en el sistema' }), 
        { 
          status: 404,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Verificar si ya es administrador
    const { data: existingAdmin } = await supabaseAdmin
      .from('admin_users')
      .select('user_id')
      .eq('user_id', userProfile.auth_uid)
      .single();

    if (existingAdmin) {
      return new Response(
        JSON.stringify({ error: 'El usuario ya es administrador' }), 
        { 
          status: 409,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Crear el administrador
    const { data: newAdmin, error: insertError } = await supabaseAdmin
      .from('admin_users')
      .insert({
        user_id: userProfile.auth_uid,
        email: userProfile.email,
        role: 'admin'
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error creating admin user:', insertError);
      return new Response(
        JSON.stringify({ error: 'Error al crear usuario administrador' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        data: newAdmin,
        message: `Usuario ${email} agregado como administrador`
      }), 
      { 
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Unexpected error in createAdminUser:', error);
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
    case 'GET':
      return getAdminUsers(context);
    case 'POST':
      return createAdminUser(context);
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

export const GET: APIRoute = withMiddleware(withCors, withAuth)(handler);
export const POST: APIRoute = withMiddleware(withCors, withAuth)(handler);
