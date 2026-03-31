import type { APIRoute } from 'astro';
import { supabaseAdmin } from '../../../lib/supabase';
import { withCors } from '../../../middleware/auth';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';

interface LoginRequest {
  email: string;
  password: string;
}

// Bloqueo de cuenta por email — independiente del rate limit por IP.
// En Vercel serverless se resetea en cada cold start, pero es efectivo
// contra ataques de fuerza bruta activos dentro de una instancia caliente.
interface LockoutEntry {
  count: number;
  lockedUntil: number | null;
}

const loginAttempts = new Map<string, LockoutEntry>();
const LOCKOUT_MAX_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 30 * 60 * 1000; // 30 minutos
let attemptCounter = 0;

function checkAccountLockout(email: string): { locked: boolean; retryAfterMs: number } {
  // Limpieza periódica: cada 100 intentos, eliminar entradas expiradas
  attemptCounter++;
  if (attemptCounter % 100 === 0) {
    const now = Date.now();
    for (const [key, entry] of loginAttempts.entries()) {
      if (entry.lockedUntil !== null && entry.lockedUntil <= now) {
        loginAttempts.delete(key);
      }
    }
  }

  const entry = loginAttempts.get(email);
  if (!entry || !entry.lockedUntil) return { locked: false, retryAfterMs: 0 };

  const now = Date.now();
  if (entry.lockedUntil > now) {
    return { locked: true, retryAfterMs: entry.lockedUntil - now };
  }

  // Bloqueo expirado — limpiar
  loginAttempts.delete(email);
  return { locked: false, retryAfterMs: 0 };
}

function recordFailedAttempt(email: string): number {
  const entry = loginAttempts.get(email) ?? { count: 0, lockedUntil: null };
  entry.count++;
  if (entry.count >= LOCKOUT_MAX_ATTEMPTS) {
    entry.lockedUntil = Date.now() + LOCKOUT_DURATION_MS;
    console.log(`[Auth] Cuenta bloqueada por intentos fallidos: ${email}, desbloqueada en ${new Date(entry.lockedUntil).toISOString()}`);
  }
  loginAttempts.set(email, entry);
  return entry.count;
}

function resetLockout(email: string): void {
  loginAttempts.delete(email);
}

export const POST: APIRoute = withCors(async (context) => {
  // Rate limit: 5 intentos por 15 minutos (por IP)
  const ip = getClientIp(context.request);
  const limit = checkRateLimit(ip, RATE_LIMITS.authLogin);
  if (!limit.allowed) return rateLimitResponse(limit.retryAfterMs);

  try {
    const { email, password }: LoginRequest = await context.request.json();

    // Basic validation
    if (!email || !password) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email y contraseña son requeridos'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Verificar bloqueo de cuenta por email (complementa el rate limit por IP)
    const lockout = checkAccountLockout(normalizedEmail);
    if (lockout.locked) {
      const minutesRemaining = Math.ceil(lockout.retryAfterMs / 60000);
      return new Response(JSON.stringify({
        success: false,
        error: `Cuenta temporalmente bloqueada. Intenta nuevamente en ${minutesRemaining} minuto${minutesRemaining !== 1 ? 's' : ''}.`
      }), {
        status: 429,
        headers: {
          'Content-Type': 'application/json',
          'Retry-After': String(Math.ceil(lockout.retryAfterMs / 1000))
        }
      });
    }

    // Authenticate with Supabase
    const { data: authData, error: authError } = await supabaseAdmin.auth.signInWithPassword({
      email: normalizedEmail,
      password
    });

    if (authError || !authData.user) {
      const failCount = recordFailedAttempt(normalizedEmail);
      const attemptsLeft = Math.max(0, LOCKOUT_MAX_ATTEMPTS - failCount);
      const errorMessage = attemptsLeft === 0
        ? 'Cuenta bloqueada por múltiples intentos fallidos. Intenta en 30 minutos.'
        : `Credenciales inválidas. ${attemptsLeft} intento${attemptsLeft !== 1 ? 's' : ''} restante${attemptsLeft !== 1 ? 's' : ''} antes del bloqueo.`;
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Login exitoso — resetear contador de intentos fallidos para este email
    resetLockout(normalizedEmail);

    // Verify admin user exists in admin_users table
    const { data: adminUser, error: adminError } = await supabaseAdmin
      .from('admin_users')
      .select('*')
      .eq('user_id', authData.user.id)
      .in('role', ['admin', 'super_admin'])
      .single();

    if (adminError || !adminUser) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Acceso denegado. Permisos de administrador requeridos.'
      }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Configurar sesión extendida para administradores (30 días)
    if (authData.session) {
      const { access_token, refresh_token } = authData.session;
      
      // Configuración profesional de cookies para sesión extendida
      const EXTENDED_SESSION_DAYS = 30;
      const extendedMaxAge = 60 * 60 * 24 * EXTENDED_SESSION_DAYS; // 30 días en segundos
      const isProduction = import.meta.env.PROD;
      
      // Configuración base de cookies
      const cookieConfig = {
        path: '/',
        maxAge: extendedMaxAge,
        httpOnly: true,
        secure: isProduction,
        sameSite: 'strict' as const,
      };
      
      // Tokens de autenticación
      context.cookies.set('sb-access-token', access_token, cookieConfig);
      context.cookies.set('sb-refresh-token', refresh_token, cookieConfig);
      
      // Marcador de sesión administrativa extendida
      const expiryDate = new Date(Date.now() + extendedMaxAge * 1000);
      context.cookies.set('sb-admin-session', 'true', {
        ...cookieConfig,
        httpOnly: true,
      });

      // Fecha de expiración (solo para uso servidor)
      context.cookies.set('sb-session-expiry', expiryDate.toISOString(), {
        ...cookieConfig,
        httpOnly: true,
      });
      
      console.log('✅ Sesión extendida configurada hasta:', expiryDate.toLocaleDateString());
    }

    // Preparar respuesta con información de sesión extendida
    const sessionExpiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    
    return new Response(JSON.stringify({
      success: true,
      data: {
        user: {
          id: authData.user.id,
          email: authData.user.email,
          role: adminUser.role,
          admin_id: adminUser.id
        },
        session: {
          access_token: authData.session?.access_token,
          expires_at: sessionExpiry.toISOString(),
          is_extended: true,
          duration_days: 30
        },
        admin: {
          verified: true,
          role: adminUser.role,
          email: adminUser.email
        }
      },
      message: `✅ Bienvenido ${adminUser.email} - Sesión configurada hasta ${sessionExpiry.toLocaleDateString('es-ES')}`
    }), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-cache, no-store, must-revalidate'
      }
    });

  } catch (error) {
    console.error('Login error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Error interno del servidor'
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
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  });
});
