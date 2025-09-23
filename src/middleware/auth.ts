import { supabase } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Middleware para validar JWT tokens de Supabase
 */
export const withAuth = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    try {
      const authHeader = context.request.headers.get('Authorization');
      
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Token de autorización requerido' }), 
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const token = authHeader.substring(7);

      // Verificar el token con Supabase
      if (!supabase) {
        return new Response(
          JSON.stringify({ error: 'Error de configuración de Supabase' }), 
          { 
            status: 500,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      const { data: { user }, error } = await supabase.auth.getUser(token);

      if (error || !user) {
        return new Response(
          JSON.stringify({ error: 'Token inválido' }), 
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // TODO: Verificar si el usuario es administrador
      // Por ahora, permitir acceso a cualquier usuario autenticado
      console.log('User authenticated:', { id: user.id, email: user.email });

      // Agregar información del usuario al contexto
      context.user = {
        id: user.id,
        email: user.email || '',
        role: 'user' // Rol temporal hasta implementar verificación de admin
      };

      return handler(context);
    } catch (error) {
      console.error('Error en middleware de autenticación:', error);
      return new Response(
        JSON.stringify({ error: 'Error interno del servidor' }), 
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }
  };
};

/**
 * Middleware para CORS
 */
export const withCors = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    // Manejar preflight requests
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 200,
        headers: {
          'Access-Control-Allow-Origin': process.env.FRONTEND_URL || '*',
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    const response = await handler(context);

    // Agregar headers CORS a la respuesta
    response.headers.set('Access-Control-Allow-Origin', process.env.FRONTEND_URL || '*');
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    return response;
  };
};

/**
 * Combinar middlewares
 */
export const withMiddleware = (...middlewares: Array<(handler: any) => any>) => {
  return (handler: any) => {
    return middlewares.reduceRight((acc, middleware) => middleware(acc), handler);
  };
};
