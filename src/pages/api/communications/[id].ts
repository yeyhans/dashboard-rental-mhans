import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { withAuth } from '../../../middleware/auth';

export const DELETE: APIRoute = withAuth(async (context) => {
  try {
    const messageId = context.params.id;
    const adminUser = context.user;

    if (!messageId) {
      return new Response(JSON.stringify({
        success: false,
        error: 'ID de mensaje requerido'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    if (!supabaseAdmin) {
      console.error('[DELETE /api/communications/[id]] supabaseAdmin no está inicializado');
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuración del servidor incorrecta'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Admin autenticado via withAuth — puede eliminar cualquier mensaje
    const { error } = await (supabaseAdmin as any)
      .from('order_communications')
      .delete()
      .eq('id', messageId);

    if (error) {
      console.error('[DELETE /api/communications/[id]] Error al eliminar mensaje:', {
        messageId,
        adminId: adminUser?.id,
        error
      });
      return new Response(JSON.stringify({
        success: false,
        error: 'Error al eliminar el mensaje'
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log('[DELETE /api/communications/[id]] Mensaje eliminado:', {
      messageId,
      adminId: adminUser?.id
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Mensaje eliminado correctamente'
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[DELETE /api/communications/[id]] Error interno:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});
