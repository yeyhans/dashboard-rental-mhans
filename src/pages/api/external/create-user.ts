import type { APIRoute } from 'astro';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';
import { UserService } from '../../../services/userService';

/**
 * External API endpoint para crear clientes desde Hermes (agente Telegram).
 *
 * Auth: X-API-Key debe igualar HERMES_API_SECRET (secreto dedicado para Hermes).
 * Fallback a FRONTEND_API_SECRET si HERMES_API_SECRET no está configurado en Vercel,
 * para facilitar el despliegue inicial sin agregar otro secreto.
 *
 * CORS: manejado por el middleware global (src/middleware/index.ts) para todas
 * las rutas /api/*. No se duplican headers aquí.
 */

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Valida formato email básico (RFC-compatible para inputs de negocio) */
function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
}

/**
 * Valida RUT chileno con dígito verificador módulo 11.
 * Acepta formatos: "12345678-9", "12.345.678-9", "12345678-K"
 * Retorna true si el RUT es estructuralmente válido y el DV coincide.
 */
function isValidRut(rut: string): boolean {
  // Normalizar: quitar puntos, espacios; aceptar mayúsculas
  const cleaned = rut.replace(/\./g, '').replace(/\s/g, '').toUpperCase();
  if (!/^\d{7,8}-[\dK]$/.test(cleaned)) return false;

  // El regex garantiza exactamente un '-', por lo que body y dv siempre existen
  const parts = cleaned.split('-');
  const body = parts[0]!;
  const dv = parts[1]!;
  let sum = 0;
  let multiplier = 2;

  for (let i = body.length - 1; i >= 0; i--) {
    sum += parseInt(body[i]!, 10) * multiplier;
    multiplier = multiplier === 7 ? 2 : multiplier + 1;
  }

  const remainder = 11 - (sum % 11);
  const expectedDv =
    remainder === 11 ? '0' : remainder === 10 ? 'K' : String(remainder);

  return dv === expectedDv;
}

/** Valida la X-API-Key contra HERMES_API_SECRET con fallback a FRONTEND_API_SECRET */
function validateApiKey(request: Request): boolean {
  const providedKey = request.headers.get('X-API-Key');
  if (!providedKey) return false;

  // Secreto dedicado para Hermes (recomendado)
  const hermesSecret = import.meta.env.HERMES_API_SECRET;
  if (hermesSecret && providedKey === hermesSecret) return true;

  // Fallback al secreto compartido del frontend si el operador no configuró uno dedicado
  const frontendSecret = import.meta.env.FRONTEND_API_SECRET;
  if (frontendSecret && providedKey === frontendSecret) return true;

  return false;
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export const POST: APIRoute = async ({ request }) => {
  // Rate limiting: 5 solicitudes por minuto por IP
  const ip = getClientIp(request);
  const rl = checkRateLimit(ip, RATE_LIMITS.userManagement);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  // Validar autenticación
  if (!validateApiKey(request)) {
    console.error('[POST /api/external/create-user] Solicitud no autorizada — X-API-Key inválida o ausente');
    return new Response(
      JSON.stringify({ success: false, error: 'No autorizado' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Parsear body
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return new Response(
      JSON.stringify({ success: false, error: 'JSON inválido en el cuerpo de la solicitud' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Validaciones de entrada ──────────────────────────────────────────────

  // Email: requerido y con formato válido
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email) {
    return new Response(
      JSON.stringify({ success: false, error: 'El campo email es requerido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }
  if (!isValidEmail(email)) {
    return new Response(
      JSON.stringify({ success: false, error: 'El formato del email no es válido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // RUT persona: opcional, validar si viene
  const rut = typeof body.rut === 'string' ? body.rut.trim() : undefined;
  if (rut !== undefined && rut !== '') {
    if (!isValidRut(rut)) {
      return new Response(
        JSON.stringify({ success: false, error: 'El RUT ingresado no es válido (verifique el dígito verificador)' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // tipo_cliente: opcional, pero si viene debe ser válido
  const tipoCliente = typeof body.tipo_cliente === 'string' ? body.tipo_cliente.trim() : undefined;
  if (tipoCliente !== undefined && tipoCliente !== '') {
    if (!['natural', 'empresa'].includes(tipoCliente)) {
      return new Response(
        JSON.stringify({ success: false, error: 'tipo_cliente debe ser "natural" o "empresa"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  console.log('[POST /api/external/create-user] Solicitud autorizada:', { email, tipo_cliente: tipoCliente });

  try {
    // ── Idempotencia: verificar si ya existe un perfil con este email ────────
    const existingUser = await UserService.getUserByEmail(email);
    if (existingUser) {
      console.error('[POST /api/external/create-user] Email duplicado:', { email, user_id: existingUser.user_id });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ya existe una cuenta con este email',
          code: 'DUPLICATE_EMAIL',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Construir payload para UserService.createUser ──────────────────────
    // Solo se aceptan campos que el esquema de user_profiles admite en Insert.
    // Los campos auth_uid, url_*, terminos_aceptados, user_id NO se toman del body.
    const userData = {
      email,
      ...(typeof body.nombre === 'string' && body.nombre.trim() ? { nombre: body.nombre.trim() } : {}),
      ...(typeof body.apellido === 'string' && body.apellido.trim() ? { apellido: body.apellido.trim() } : {}),
      ...(typeof body.telefono === 'string' && body.telefono.trim() ? { telefono: body.telefono.trim() } : {}),
      ...(rut ? { rut } : {}),
      ...(tipoCliente ? { tipo_cliente: tipoCliente } : {}),
      ...(typeof body.instagram === 'string' && body.instagram.trim() ? { instagram: body.instagram.trim() } : {}),
      ...(typeof body.empresa_nombre === 'string' && body.empresa_nombre.trim() ? { empresa_nombre: body.empresa_nombre.trim() } : {}),
      ...(typeof body.empresa_rut === 'string' && body.empresa_rut.trim() ? { empresa_rut: body.empresa_rut.trim() } : {}),
    };

    // ── Delegar en UserService (gestiona Auth + RPC + rollback + email) ────
    const newUser = await UserService.createUser(userData);

    console.log('[POST /api/external/create-user] Usuario creado exitosamente:', {
      user_id: newUser.user_id,
      email: newUser.email,
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user_id: newUser.user_id,
          email: newUser.email,
          nombre: newUser.nombre,
          apellido: newUser.apellido,
          tipo_cliente: newUser.tipo_cliente,
        },
      }),
      { status: 201, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    // UserService.createUser ya distingue "already been registered" → lanza Error con mensaje claro
    const message = error instanceof Error ? error.message : 'Error desconocido';

    // Duplicado detectado tarde (race entre getUserByEmail y createUser)
    if (message.includes('Ya existe una cuenta con este email') || message.includes('already been registered')) {
      console.error('[POST /api/external/create-user] Conflicto de email (race condition):', { email });
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Ya existe una cuenta con este email',
          code: 'DUPLICATE_EMAIL',
        }),
        { status: 409, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('[POST /api/external/create-user] Error interno al crear usuario:', {
      email,
      error: message,
    });

    return new Response(
      JSON.stringify({ success: false, error: 'Error interno al crear el usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
