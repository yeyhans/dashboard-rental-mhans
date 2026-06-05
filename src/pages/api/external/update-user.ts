import type { APIRoute } from 'astro';
import { checkRateLimit, getClientIp, rateLimitResponse, RATE_LIMITS } from '../../../lib/rateLimit';
import { UserService } from '../../../services/userService';
import type { Database } from '../../../types/database';

/**
 * External API endpoint para actualizar datos de clientes desde Hermes (agente Telegram).
 *
 * Auth: X-API-Key debe igualar HERMES_API_SECRET (secreto dedicado para Hermes).
 * Fallback a FRONTEND_API_SECRET si HERMES_API_SECRET no está configurado en Vercel.
 *
 * CORS: manejado por el middleware global (src/middleware/index.ts).
 */

type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update'];

// ─── Allowlist de campos editables ───────────────────────────────────────────
// EXACTA: solo estos campos pueden ser modificados por Hermes.
// Campos PROHIBIDOS (nunca aceptar en fields):
//   rut, email, auth_uid, url_* (todos), terminos_aceptados, user_id,
//   empresa_ciudad, empresa_direccion (no están en el allowlist del plan).
//
// Nota: "region" del plan fue excluida porque no existe en el schema
// de user_profiles (database.ts). Si se agrega al schema en el futuro,
// incluirla aquí.
const ALLOWED_UPDATE_FIELDS = new Set<string>([
  'nombre',
  'apellido',
  'telefono',
  'direccion',
  'ciudad',
  'empresa_nombre',
  'empresa_rut',
  'instagram',
  'tipo_cliente',
]);

// ─── Helpers ────────────────────────────────────────────────────────────────

/**
 * Valida RUT chileno con dígito verificador módulo 11.
 * Acepta: "12345678-9", "12.345.678-9", "12345678-K"
 */
function isValidRut(rut: string): boolean {
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

  const hermesSecret = import.meta.env.HERMES_API_SECRET;
  if (hermesSecret && providedKey === hermesSecret) return true;

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
    console.error('[POST /api/external/update-user] Solicitud no autorizada — X-API-Key inválida o ausente');
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

  // ── Validar user_id ──────────────────────────────────────────────────────
  const rawUserId = body.user_id;
  const userId = typeof rawUserId === 'number'
    ? rawUserId
    : typeof rawUserId === 'string'
      ? parseInt(rawUserId, 10)
      : NaN;

  if (!Number.isFinite(userId) || userId <= 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'user_id debe ser un número entero positivo válido' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Validar fields ───────────────────────────────────────────────────────
  const fields = body.fields;
  if (!fields || typeof fields !== 'object' || Array.isArray(fields)) {
    return new Response(
      JSON.stringify({ success: false, error: 'El campo "fields" es requerido y debe ser un objeto' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  const incomingKeys = Object.keys(fields as Record<string, unknown>);
  if (incomingKeys.length === 0) {
    return new Response(
      JSON.stringify({ success: false, error: 'El campo "fields" no puede estar vacío' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // Verificar que no venga ninguna key fuera del allowlist
  const rejectedKeys = incomingKeys.filter((k) => !ALLOWED_UPDATE_FIELDS.has(k));
  if (rejectedKeys.length > 0) {
    console.error('[POST /api/external/update-user] Campos no permitidos recibidos:', {
      userId,
      rejectedKeys,
    });
    return new Response(
      JSON.stringify({
        success: false,
        error: `Los siguientes campos no están permitidos: ${rejectedKeys.join(', ')}. Campos editables: ${[...ALLOWED_UPDATE_FIELDS].join(', ')}`,
      }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  // ── Validaciones de valores ──────────────────────────────────────────────
  const fieldsObj = fields as Record<string, unknown>;

  // tipo_cliente: si viene, debe ser válido
  if ('tipo_cliente' in fieldsObj) {
    const tc = fieldsObj.tipo_cliente;
    if (typeof tc !== 'string' || !['natural', 'empresa'].includes(tc.trim())) {
      return new Response(
        JSON.stringify({ success: false, error: 'tipo_cliente debe ser "natural" o "empresa"' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  }

  // empresa_rut: si viene, validar módulo 11
  if ('empresa_rut' in fieldsObj) {
    const er = fieldsObj.empresa_rut;
    if (typeof er === 'string' && er.trim() !== '') {
      if (!isValidRut(er.trim())) {
        return new Response(
          JSON.stringify({ success: false, error: 'El RUT de empresa no es válido (verifique el dígito verificador)' }),
          { status: 400, headers: { 'Content-Type': 'application/json' } }
        );
      }
    }
  }

  console.log('[POST /api/external/update-user] Solicitud autorizada:', {
    userId,
    fields: incomingKeys,
  });

  try {
    // ── Verificar existencia del usuario ─────────────────────────────────
    const existingUser = await UserService.getUserById(userId);
    if (!existingUser) {
      console.error('[POST /api/external/update-user] Usuario no encontrado:', { userId });
      return new Response(
        JSON.stringify({ success: false, error: `No se encontró un usuario con ID ${userId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Construir update payload con solo los campos del allowlist ────────
    // Segunda capa de defensa: filtrar explícitamente aunque el check de arriba
    // ya rechazó keys inválidas. Defensa en profundidad (mirrors del plan B2).
    const safeUpdate: UserProfileUpdate = {};

    for (const key of ALLOWED_UPDATE_FIELDS) {
      if (key in fieldsObj) {
        const value = fieldsObj[key];
        // Aceptar string, null, y para tipo_cliente también string vacío que normalizamos
        (safeUpdate as Record<string, unknown>)[key] =
          typeof value === 'string' ? value.trim() || null : value ?? null;
      }
    }

    // ── Delegar en UserService.updateUser ─────────────────────────────────
    const updatedUser = await UserService.updateUser(userId, safeUpdate);

    console.log('[POST /api/external/update-user] Usuario actualizado exitosamente:', {
      userId,
      updatedFields: Object.keys(safeUpdate),
    });

    return new Response(
      JSON.stringify({ success: true, data: updatedUser }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error desconocido';

    // Usuario no encontrado detectado tarde (UserService lo lanza explícitamente)
    if (message.includes('no encontrado')) {
      return new Response(
        JSON.stringify({ success: false, error: `No se encontró un usuario con ID ${userId}` }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    console.error('[POST /api/external/update-user] Error interno al actualizar usuario:', {
      userId,
      error: message,
    });

    return new Response(
      JSON.stringify({ success: false, error: 'Error interno al actualizar el usuario' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
};
