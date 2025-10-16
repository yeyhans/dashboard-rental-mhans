import { defineMiddleware } from "astro:middleware";
import { getServerAdmin, clearAuthCookies, isExtendedSessionValid } from "../lib/supabase";
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
  "/api/auth/session"
];

const homeRoute = "/";
const dashboardRoute = "/dashboard";

export const onRequest = defineMiddleware(async (context, next) => {
  const { url, redirect, locals, request } = context;

  console.log('🔍 Middleware called:', request.method, url.pathname);

  // ===== CORS HANDLING - DEBE SER LO PRIMERO =====
  // Manejar CORS para todas las rutas API
  if (url.pathname.startsWith('/api/')) {
    const origin = request.headers.get('origin') || 'http://localhost:4321';
    
    // Manejar preflight OPTIONS requests ANTES de cualquier autenticación
    if (request.method === 'OPTIONS') {
      console.log('🔵 Global Middleware: OPTIONS request for', url.pathname, 'from', origin);
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': origin,
          'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
          'Access-Control-Allow-Headers': 'Content-Type, Authorization, Cookie',
          'Access-Control-Allow-Credentials': 'true',
          'Access-Control-Max-Age': '86400',
        },
      });
    }
    
    // Para requests normales, continuar y agregar headers CORS a la respuesta
    const response = await next();
    response.headers.set('Access-Control-Allow-Origin', origin);
    response.headers.set('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS, PATCH');
    response.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, Cookie');
    response.headers.set('Access-Control-Allow-Credentials', 'true');
    return response;
  }

  // Permitir rutas de autenticación sin verificación
  if (isMatch(url.pathname, authRoutes)) {
    return next();
  }

  // Si no es una ruta protegida, continuar sin verificación
  if (!isMatch(url.pathname, protectedRoutes)) {
    return next();
  }

  console.log('🔒 Verificando admin para ruta protegida:', url.pathname);

  // Verificar si tiene sesión extendida válida primero
  if (isExtendedSessionValid(context)) {
    console.log('⚡ Sesión extendida válida, omitiendo verificación completa');
    return next();
  }

  // Verificar admin completo
  const adminSession = await getServerAdmin(context);
  
  if (!adminSession) {
    console.log('🔒 Acceso denegado: No es administrador o sesión inválida');
    clearAuthCookies(context);
    return redirect(homeRoute);
  }

  // Configurar datos del usuario en locals para uso en páginas
  locals.user = adminSession.user;
  locals.email = adminSession.admin.email;
  // Nota: adminRole e isExtendedSession se pueden acceder via adminSession si se necesita

  console.log('✅ Admin verificado:', adminSession.admin.email, '- Sesión hasta:', adminSession.expiresAt);

  // Si está en home y autenticado, redirigir a dashboard
  if (url.pathname === homeRoute) {
    return redirect(dashboardRoute);
  }

  return next();
}); 