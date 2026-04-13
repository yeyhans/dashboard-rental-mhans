import { defineMiddleware } from "astro:middleware";
import { getServerAdmin, clearAuthCookies } from "../lib/supabase";
import { getAllowedOrigin } from "../middleware/auth";
import micromatch from "micromatch";

const { isMatch } = micromatch;

// Rutas que requieren autenticación de administrador
const protectedRoutes = [
  "/dashboard(|/)", 
  "/orders/**", 
  "/users/**", 
  "/payments-table(|/)", 
  "/products/**",
  "/analytics/**"
];

// Rutas de autenticación que no requieren verificación
const authRoutes = [
  "/api/auth/login",
  "/api/auth/logout",
  "/api/auth/session",
  "/api/auth/refresh"
];

const homeRoute = "/";
const dashboardRoute = "/dashboard";

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, locals, request } = context;

  // ===== CORS HANDLING - DEBE SER LO PRIMERO =====
  // Manejar CORS para todas las rutas API usando whitelist de orígenes permitidos
  if (url.pathname.startsWith('/api/')) {
    const allowedOrigin = getAllowedOrigin(request.headers.get('origin'));

    // Manejar preflight OPTIONS requests ANTES de cualquier autenticación
    if (request.method === 'OPTIONS') {
      // Si el origen no está en la whitelist, responder sin headers CORS (browser bloqueará)
      if (!allowedOrigin) {
        return new Response(null, { status: 204 });
      }
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': allowedOrigin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie, Accept',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }

    // Para requests normales, continuar y agregar headers CORS solo a orígenes permitidos
    const response = await next();
    if (allowedOrigin) {
      response.headers.set('Access-Control-Allow-Origin', allowedOrigin);
      response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
      response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie, Accept');
      response.headers.set('Access-Control-Allow-Credentials', 'true');
    }
    return response;
  }

  // Permitir rutas de autenticación sin verificación
  if (isMatch(url.pathname, authRoutes)) {
    return next();
  }

  // Si está en home, verificar si ya está autenticado para redirigir
  if (url.pathname === homeRoute) {
    const adminSession = await getServerAdmin(context);
    if (adminSession) {
      return redirect(dashboardRoute);
    }
    return next();
  }

  // Si no es una ruta protegida, continuar sin verificación
  if (!isMatch(url.pathname, protectedRoutes)) {
    return next();
  }

  console.log('🔒 Verificando admin para ruta protegida:', url.pathname);

  // SIEMPRE verificar admin en base de datos (usa cache interno de 5 min)
  const adminSession = await getServerAdmin(context);

  if (!adminSession) {
    console.log('🚫 Acceso denegado al dashboard - Usuario no es administrador');
    clearAuthCookies(context);
    return redirect(homeRoute);
  }

  // Configurar datos del usuario en locals para uso en páginas
  locals.user = adminSession.user;
  locals.email = adminSession.admin.email;

  return next();
}); 