import { getServerAdmin } from "../lib/supabase";

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    email: string;
    role?: string;
  };
}

/**
 * Middleware para validar sesiones de administrador usando el nuevo sistema
 */
export const withAuth = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    try {
      // Crear un objeto Astro-like para getServerAdmin
      const astroLike = {
        cookies: context.cookies || {
          get: (name: string) => {
            const cookieHeader = context.request.headers.get('cookie');
            if (!cookieHeader) return undefined;
            
            const cookies = cookieHeader.split(';').reduce((acc: Record<string, string>, cookie: string) => {
              const [key, value] = cookie.trim().split('=');
              if (key && value) acc[key] = decodeURIComponent(value);
              return acc;
            }, {});
            
            return cookies[name] ? { value: cookies[name] } : undefined;
          }
        }
      };

      // Verificar autenticación usando el nuevo sistema
      const adminSession = await getServerAdmin(astroLike as any);

      if (!adminSession) {
        return new Response(
          JSON.stringify({ error: 'Acceso denegado - Usuario no es administrador' }), 
          { 
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        );
      }

      // Usuario administrador autenticado exitosamente
      console.log('✅ Admin authenticated via middleware:', { 
        id: adminSession.user.id, 
        email: adminSession.admin.email,
        role: adminSession.admin.role,
        method: context.request.method,
        url: context.url?.pathname
      });

      // Agregar información del administrador al contexto
      context.user = {
        id: adminSession.user.id,
        email: adminSession.admin.email,
        role: adminSession.admin.role
      };
      
      context.adminSession = adminSession;

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
 * IMPORTANTE: Este middleware debe estar ANTES de withAuth para manejar preflight OPTIONS
 */
export const withCors = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    // Get origin from request or use default
    const origin = context.request.headers.get('origin') || process.env.PUBLIC_FRONTEND_URL || 'http://localhost:4321';
    
    console.log('🌐 CORS Middleware:', {
      method: context.request.method,
      origin,
      url: context.url?.pathname
    });
    
    // Manejar preflight requests ANTES de cualquier autenticación
    if (context.request.method === 'OPTIONS') {
      console.log('✅ Handling OPTIONS preflight request');
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, X-Frontend-Source, x-frontend-source, X-External-Source, X-API-Key, X-Requested-With, Accept, X-Internal-Request, X-Requested-User-Id, X-Requested-Order-Id',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Para requests normales, ejecutar handler y agregar headers CORS
    const response = await handler(context);

    // Agregar headers CORS a la respuesta
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, X-Frontend-Source, x-frontend-source, X-External-Source, X-API-Key, X-Requested-With, Accept, X-Internal-Request, X-Requested-User-Id, X-Requested-Order-Id');
    response.headers.set('Access-Control-Allow-Credentials', 'true');

    console.log('✅ CORS headers added to response');

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
