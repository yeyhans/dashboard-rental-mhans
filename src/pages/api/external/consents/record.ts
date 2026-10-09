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
import {
  ConsentService,
  MAX_CONSENT_VERSION_LENGTH,
  type ConsentInput,
} from "../../../../services/consentService";

/**
 * Records data-protection consents (append-only) on behalf of the public frontend.
 *
 * Auth: X-API-Key matching FRONTEND_API_SECRET (same helper as the other frontend-facing
 * external endpoints). Not withAuth: the caller is the frontend server, not an admin.
 *
 * CORS: handled by the global middleware (src/middleware/index.ts).
 */

// The caller is the frontend server, so many end users share one IP: a higher ceiling than the
// 5/min user-management limit.
const CONSENT_RATE_LIMIT = {
  name: "external-consents",
  maxRequests: 60,
  windowMs: 60 * 1000,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function badRequest(error: string): Response {
  return json({ success: false, error }, 400);
}

export const POST: APIRoute = async ({ request }) => {
  const rl = checkRateLimit(getClientIp(request), CONSENT_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  if (!validateFrontendApiKey(request)) {
    console.error(
      "[POST /api/external/consents/record] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return badRequest("JSON inválido en el cuerpo de la solicitud");
  }
  if (!body || typeof body !== "object")
    return badRequest("JSON inválido en el cuerpo de la solicitud");

  if (!ConsentService.isValidUuid(body.auth_uid)) {
    return badRequest("auth_uid debe ser un UUID válido");
  }
  const authUid = body.auth_uid;

  const consentVersion =
    typeof body.consent_version === "string" ? body.consent_version.trim() : "";
  if (!consentVersion || consentVersion.length > MAX_CONSENT_VERSION_LENGTH) {
    return badRequest(
      `consent_version es requerido (máximo ${MAX_CONSENT_VERSION_LENGTH} caracteres)`,
    );
  }

  if (!Array.isArray(body.consents) || body.consents.length === 0) {
    return badRequest(
      "consents debe ser una lista con al menos un consentimiento",
    );
  }
  const consents: ConsentInput[] = [];
  for (const item of body.consents as Array<Record<string, unknown> | null>) {
    if (
      !item ||
      !ConsentService.isPurpose(item.purpose) ||
      typeof item.granted !== "boolean"
    ) {
      return badRequest(
        "Cada consentimiento requiere purpose válido y granted booleano",
      );
    }
    consents.push({ purpose: item.purpose, granted: item.granted });
  }

  // Invalid IPs are dropped (not an error): the ledger row is still worth recording.
  const ipAddress = ConsentService.normalizeIp(body.ip_address);
  const userAgent = ConsentService.normalizeUserAgent(body.user_agent);

  try {
    if (!(await ConsentService.userExists(authUid))) {
      return json({ success: false, error: "Usuario no encontrado" }, 404);
    }

    const recorded = await ConsentService.record({
      authUid,
      consentVersion,
      consents,
      ipAddress,
      userAgent,
    });
    return json({ success: true, data: { recorded } }, 201);
  } catch (error) {
    console.error("[POST /api/external/consents/record] Error interno:", {
      authUid,
      error: error instanceof Error ? error.message : "Error desconocido",
    });
    return json(
      {
        success: false,
        error: "Error interno al registrar los consentimientos",
      },
      500,
    );
  }
};
