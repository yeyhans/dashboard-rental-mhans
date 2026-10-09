import type { APIRoute } from "astro";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "../../../../lib/rateLimit";
import {
  unauthorizedResponse,
  validateFrontendApiKey,
} from "../../../../lib/serverApiAuth";
import { ConsentService } from "../../../../services/consentService";

/**
 * Returns the current consent state per purpose (latest ledger row wins) for one user.
 *
 * Auth: X-API-Key matching FRONTEND_API_SECRET. CORS: handled by the global middleware.
 */

const CONSENT_RATE_LIMIT = {
  name: "external-consents-status",
  maxRequests: 120,
  windowMs: 60 * 1000,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const rl = checkRateLimit(getClientIp(request), CONSENT_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  if (!validateFrontendApiKey(request)) {
    console.error(
      "[POST /api/external/consents/status] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: "JSON inválido en el cuerpo de la solicitud" },
      400,
    );
  }

  if (!body || !ConsentService.isValidUuid(body.auth_uid)) {
    return json(
      { success: false, error: "auth_uid debe ser un UUID válido" },
      400,
    );
  }
  const authUid = body.auth_uid;

  try {
    if (!(await ConsentService.userExists(authUid))) {
      return json({ success: false, error: "Usuario no encontrado" }, 404);
    }

    const status = await ConsentService.getStatus(authUid);
    return json({ success: true, data: status }, 200);
  } catch (error) {
    console.error("[POST /api/external/consents/status] Error interno:", {
      authUid,
      error: error instanceof Error ? error.message : "Error desconocido",
    });
    return json(
      {
        success: false,
        error: "Error interno al consultar los consentimientos",
      },
      500,
    );
  }
};
