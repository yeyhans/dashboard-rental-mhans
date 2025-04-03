import type { APIRoute } from 'astro';
import WooCommerce from '../apiroute';

export const GET: APIRoute = async ({ params }) => {
  try {
    const { id } = params;

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ID de orden requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const response = await WooCommerce.get(`orders/${id}/notes`);
    
    // Transform notes to a simpler format
    const notes = response.data.map((note: any) => ({
      id: note.id,
      author: note.author,
      date_created: note.date_created,
      content: note.note,
      customer_note: note.customer_note
    }));

    return new Response(JSON.stringify({
      success: true,
      message: 'Notas obtenidas exitosamente',
      data: notes
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al obtener notas:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error al obtener las notas',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const POST: APIRoute = async ({ request, params }) => {
  try {
    const { id } = params;
    const body = await request.json();

    if (!id) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ID de orden requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    if (!body.note || typeof body.note !== 'string') {
      return new Response(JSON.stringify({
        success: false,
        message: 'Contenido de la nota requerido'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const response = await WooCommerce.post(`orders/${id}/notes`, {
      note: body.note,
      customer_note: body.customer_note || false
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Nota creada exitosamente',
      data: {
        id: response.data.id,
        author: response.data.author,
        date_created: response.data.date_created,
        content: response.data.note,
        customer_note: response.data.customer_note
      }
    }), {
      status: 201,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al crear nota:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error al crear la nota',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
};

export const DELETE: APIRoute = async ({ params, request }) => {
  try {
    const { id } = params;
    const url = new URL(request.url);
    const noteId = url.searchParams.get('note_id');

    if (!id || !noteId) {
      return new Response(JSON.stringify({
        success: false,
        message: 'ID de orden y nota requeridos'
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    await WooCommerce.delete(`orders/${id}/notes/${noteId}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Nota eliminada exitosamente'
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  } catch (error: any) {
    console.error('Error al eliminar nota:', error);
    return new Response(JSON.stringify({
      success: false,
      message: 'Error al eliminar la nota',
      error: error.message
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}; 