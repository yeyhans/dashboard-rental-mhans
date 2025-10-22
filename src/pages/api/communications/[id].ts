import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    console.log('🗑️ DELETE /api/communications/[id] called');
    
    const messageId = params.id;
    console.log('📝 Message ID:', messageId);
    
    if (!messageId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'ID de mensaje requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar que supabaseAdmin esté disponible
    if (!supabaseAdmin) {
      console.error('❌ supabaseAdmin is null - service role key not configured');
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'Configuración del servidor incorrecta' 
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Obtener userId del body
    const body = await request.json();
    const { userId } = body;
    console.log('👤 User ID:', userId);

    if (!userId) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'userId requerido' 
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Verificar si el usuario es admin
    console.log('🔍 Checking if user is admin...');
    const { data: adminData, error: adminCheckError } = await (supabaseAdmin as any)
      .from('admin_users')
      .select('id')
      .eq('user_id', userId)
      .single();
    
    if (adminCheckError && adminCheckError.code !== 'PGRST116') {
      console.error('❌ Error checking admin status:', adminCheckError);
    }
    
    console.log('👮 Is admin:', !!adminData);

    // Si es admin, puede eliminar cualquier mensaje
    // Si no es admin, solo puede eliminar sus propios mensajes
    if (adminData) {
      // Admin: puede eliminar cualquier mensaje (sin restricción de user_id)
      console.log('🔓 Admin deleting message without user_id restriction');
      const { error, count } = await (supabaseAdmin as any)
        .from('order_communications')
        .delete({ count: 'exact' })
        .eq('id', messageId);

      console.log('📊 Delete result - Error:', error, 'Count:', count);

      if (error) {
        console.error('❌ Error deleting message (admin):', error);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Error al eliminar el mensaje' 
        }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log('✅ Message deleted successfully by admin');
    } else {
      // Usuario regular: solo puede eliminar sus propios mensajes
      console.log('🔒 Regular user deleting own message');
      const { error, count } = await (supabaseAdmin as any)
        .from('order_communications')
        .delete({ count: 'exact' })
        .eq('id', messageId)
        .eq('user_id', userId);

      console.log('📊 Delete result - Error:', error, 'Count:', count);

      if (error) {
        console.error('❌ Error deleting message (user):', error);
        return new Response(JSON.stringify({ 
          success: false, 
          message: 'Error al eliminar el mensaje o no tienes permisos' 
        }), {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        });
      }
      
      console.log('✅ Message deleted successfully by user');
    }

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Mensaje eliminado correctamente' 
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error in DELETE /api/communications/[id]:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Error interno del servidor' 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};
