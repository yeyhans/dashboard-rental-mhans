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
      // Usar context.cookies de Astro si existe (soporta get + set),
      // fallback a parser manual de headers solo si no está disponible
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
          },
          set: () => {
            // No-op: no se pueden setear cookies sin el contexto de Astro
          },
          delete: () => {}
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
 * Higher-order function para verificar que el admin tiene un rol específico.
 * Se apoya en withAuth para la autenticación — no la duplica.
 * Uso: requireRole('super_admin')(handler)
 *      requireRole('admin', 'super_admin')(handler)
 */
export const requireRole = (...roles: string[]) => (handler: (context: any) => Promise<Response>) => {
  return withAuth(async (context: any) => {
    const adminUser = context.user;

    if (!adminUser || !roles.includes(adminUser.role)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Permisos insuficientes para esta operación'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return handler(context);
  });
};

/**
 * Middleware para CORS
 * IMPORTANTE: Este middleware debe estar ANTES de withAuth para manejar preflight OPTIONS
 */

const CORS_HEADERS = 'Content-Type, Authorization, Cookie, X-Frontend-Source, x-frontend-source, X-External-Source, X-API-Key, X-Requested-With, Accept, X-Internal-Request, X-Requested-User-Id, X-Requested-Order-Id';
const CORS_METHODS = 'GET, POST, PUT, DELETE, OPTIONS, PATCH';

export function getAllowedOrigin(requestOrigin: string | null): string | null {
  const allowedOrigins = (
    import.meta.env.ALLOWED_ORIGINS ||
    import.meta.env.PUBLIC_FRONTEND_URL ||
    ''
  ).split(',').map((o: string) => o.trim()).filter(Boolean);

  // En desarrollo, permitir localhost
  if (import.meta.env.DEV) {
    allowedOrigins.push('http://localhost:4321', 'http://localhost:3000');
  }

  if (!requestOrigin) return allowedOrigins[0] || null;
  return allowedOrigins.includes(requestOrigin) ? requestOrigin : null;
}

export const withCors = (handler: (context: any) => Promise<Response>) => {
  return async (context: any) => {
    const requestOrigin = context.request.headers.get('origin');
    const allowedOrigin = getAllowedOrigin(requestOrigin);

    // Manejar preflight requests ANTES de cualquier autenticación
    if (context.request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          ...(allowedOrigin ? { 'Access-Control-Allow-Origin': allowedOrigin } : {}),
          'Access-Control-Allow-Methods': CORS_METHODS,
          'Access-Control-Allow-Headers': CORS_HEADERS,
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Para requests normales, ejecutar handler y agregar headers CORS
    const response = await handler(context);

    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Methods', CORS_METHODS);
      response.headers.set('Access-Control-Allow-Headers', CORS_HEADERS);
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }

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
