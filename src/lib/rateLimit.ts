/**
 * In-memory rate limiter.
 * On Vercel serverless this resets per cold start, but still catches
 * burst attacks within a warm instance. For persistent rate limiting,
 * consider Upstash Redis.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

interface RateLimitConfig {
  name: string;
  maxRequests: number;
  windowMs: number;
}

interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterMs: number;
}

function getStore(name: string): Map<string, RateLimitEntry> {
  if (!stores.has(name)) {
    stores.set(name, new Map());
  }
  return stores.get(name)!;
}

export function checkRateLimit(ip: string, config: RateLimitConfig): RateLimitResult {
  const store = getStore(config.name);
  const now = Date.now();
  const entry = store.get(ip);

  if (!entry || now > entry.resetAt) {
    store.set(ip, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, remaining: config.maxRequests - 1, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs: entry.resetAt - now,
    };
  }

  entry.count++;
  return { allowed: true, remaining: config.maxRequests - entry.count, retryAfterMs: 0 };
}

export function getClientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    'unknown'
  );
}

export function rateLimitResponse(retryAfterMs: number): Response {
  const retryAfterSeconds = Math.ceil(retryAfterMs / 1000);
  return new Response(
    JSON.stringify({
      success: false,
      error: 'Demasiadas solicitudes. Intentá de nuevo más tarde.',
    }),
    {
      status: 429,
      headers: {
        'Content-Type': 'application/json',
        'Retry-After': String(retryAfterSeconds),
      },
    }
  );
}

export const RATE_LIMITS = {
  /** Login admin: 5 intentos por 15 minutos */
  authLogin: { name: 'auth-login', maxRequests: 5, windowMs: 15 * 60 * 1000 },
  /** Emails manuales: 10 por minuto */
  email: { name: 'email', maxRequests: 10, windowMs: 60 * 1000 },
  /** PDF generation: 5 por minuto */
  pdfGeneration: { name: 'pdf-generation', maxRequests: 5, windowMs: 60 * 1000 },
} as const;
