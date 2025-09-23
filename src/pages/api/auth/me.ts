import type { APIRoute } from 'astro';
import { AdminService } from '../../../services/adminService';
import { withAuth, withCors } from '../../../middleware/auth';

export const GET: APIRoute = withCors(withAuth(async (context) => {
  const startTime = Date.now();
  let clientIP = 'unknown';

  try {
    // Get client IP for logging
    clientIP = context.request.headers.get('x-forwarded-for')?.split(',')[0] || 
               context.request.headers.get('x-real-ip') || 
               context.clientAddress || 'unknown';

    const user = context.user;

    if (!user || !user.id) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Usuario no autenticado',
        code: 'USER_NOT_AUTHENTICATED'
      }), {
        status: 401,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    // Get detailed admin information
    const adminUser = await AdminService.getAdminByUserId(user.id);
    
    if (!adminUser) {
      console.warn(`Admin user not found for ID: ${user.id}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Información de administrador no encontrada',
        code: 'ADMIN_NOT_FOUND'
      }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }

    const responseTime = Date.now() - startTime;

    console.log(`User info request for admin: ${user.email} (${user.role}) from IP: ${clientIP}`);

    return new Response(JSON.stringify({
      success: true,
      data: {
        id: user.id,
        email: user.email,
        role: adminUser.role,
        created_at: adminUser.created_at,
        permissions: {
          can_manage_users: adminUser.role === 'super_admin' || adminUser.role === 'admin',
          can_manage_products: true,
          can_manage_orders: true,
          can_manage_coupons: adminUser.role === 'super_admin' || adminUser.role === 'admin',
          can_view_analytics: true,
          can_manage_admins: adminUser.role === 'super_admin'
        },
        session_info: {
          last_activity: new Date().toISOString(),
          client_ip: clientIP.replace(/\d+$/, 'xxx'), // Partially mask IP for privacy
          user_agent: context.request.headers.get('user-agent')?.substring(0, 100) || 'Unknown'
        }
      },
      metadata: {
        request_time: new Date().toISOString(),
        response_time_ms: responseTime
      }
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Response-Time': `${responseTime}ms`,
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Critical error in GET /api/auth/me:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined,
      userId: context.user?.id || 'unknown',
      clientIP,
      timestamp: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor al obtener información del usuario',
      code: 'INTERNAL_SERVER_ERROR'
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
}));

export const OPTIONS: APIRoute = withCors(async () => {
  return new Response(null, { 
    status: 200,
    headers: {
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
});
