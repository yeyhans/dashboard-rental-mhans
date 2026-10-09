import type { APIRoute } from "astro";
import {
  checkRateLimit,
  getClientIp,
  rateLimitResponse,
} from "../../../lib/rateLimit";
import {
  unauthorizedResponse,
  validateFrontendApiKey,
} from "../../../lib/serverApiAuth";
import {
  buildContractPreview,
  validateContractPreviewInput,
} from "../../../services/contractPreviewService";
import { SiteSettingsService } from "../../../services/siteSettingsService";

/**
 * Read-only contract text for the frontend to show before signing. Built from the same clause
 * source as the signed PDF. Reads no user data and logs no request contents.
 *
 * Auth: X-API-Key matching FRONTEND_API_SECRET. CORS: handled by the global middleware.
 */

const CONTRACT_PREVIEW_RATE_LIMIT = {
  name: "external-contract-preview",
  maxRequests: 60,
  windowMs: 60 * 1000,
};

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const rl = checkRateLimit(getClientIp(request), CONTRACT_PREVIEW_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  if (!validateFrontendApiKey(request)) {
    console.error(
      "[POST /api/external/contract-preview] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json(
      { success: false, error: "JSON inválido en el cuerpo de la solicitud" },
      400,
    );
  }

  const parsed = validateContractPreviewInput(body);
  if (!parsed.ok) {
    return json({ success: false, error: parsed.error }, 400);
  }

  try {
    const settings = await SiteSettingsService.get();
    const data = buildContractPreview(parsed.value, new Date(), settings);
    return json({ success: true, data }, 200);
  } catch (error) {
    console.error("[POST /api/external/contract-preview] Error interno:", {
      error: error instanceof Error ? error.message : "Error desconocido",
    });
    return json(
      { success: false, error: "Error interno al generar el contrato" },
      500,
    );
  }
};
