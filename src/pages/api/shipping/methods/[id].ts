import type { APIRoute } from 'astro';
import { ShippingService } from '../../../../services/shippingService';

export const GET: APIRoute = async ({ params }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const method = await ShippingService.getShippingMethodById(methodId);
    
    if (!method) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify(method), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching shipping method:', error);
    return new Response(JSON.stringify({ 
      error: 'Error al obtener método de envío',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const PUT: APIRoute = async ({ params, request }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const body = await request.json();
    const updatedMethod = await ShippingService.updateShippingMethod(methodId, body);

    return new Response(JSON.stringify(updatedMethod), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error updating shipping method:', error);
    
    if (error instanceof Error && error.message.includes('no encontrado')) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Error al actualizar método de envío',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};

export const DELETE: APIRoute = async ({ params }) => {
  try {
    const methodId = parseInt(params.id as string);
    
    if (isNaN(methodId)) {
      return new Response(JSON.stringify({ 
        error: 'ID de método de envío inválido' 
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    const success = await ShippingService.deleteShippingMethod(methodId);
    
    if (!success) {
      return new Response(JSON.stringify({ 
        error: 'No se pudo eliminar el método de envío' 
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ 
      success: true,
      message: 'Método de envío eliminado exitosamente' 
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error deleting shipping method:', error);
    
    if (error instanceof Error && error.message.includes('no encontrado')) {
      return new Response(JSON.stringify({ 
        error: 'Método de envío no encontrado' 
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
        },
      });
    }

    return new Response(JSON.stringify({ 
      error: 'Error al eliminar método de envío',
      details: error instanceof Error ? error.message : 'Error desconocido'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }
};
