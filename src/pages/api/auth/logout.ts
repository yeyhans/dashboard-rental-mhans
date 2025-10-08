import type { APIRoute } from 'astro';
import { clearAuthCookies } from '../../../lib/supabase';
import { withCors } from '../../../middleware/auth';

// GET: Logout con redirección (para uso directo en navegador)
export const GET: APIRoute = async (context) => {
  console.log(' Logout solicitado via GET');
  
  try {
    // Limpiar todas las cookies de autenticación
    clearAuthCookies(context);
    
    console.log('Logout completado exitosamente');
    
    // Redirigir al home
    return context.redirect('/');
  } catch (error) {
    console.error('Error en logout:', error);
    return context.redirect('/');
  }
};

// POST: Logout para APIs con respuesta JSON
export const POST: APIRoute = withCors(async (context) => {
  console.log('Logout solicitado via POST');
  
  try {
    // Limpiar todas las cookies de autenticación
    clearAuthCookies(context);
    
    console.log('Logout completado exitosamente');
    
    return new Response(JSON.stringify({
      success: true,
      message: 'Sesión cerrada exitosamente',
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });
  } catch (error) {
    console.error('Error en logout:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor durante logout',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
});

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
});
