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
import { SiteSettingsService } from "../../../services/siteSettingsService";

/**
 * Public subset of the business settings (legal name, privacy contact, etc.) for the frontend's
 * server side. Auth: X-API-Key matching FRONTEND_API_SECRET. CORS: handled by the global middleware.
 */

const SITE_SETTINGS_RATE_LIMIT = {
  name: "external-site-settings",
  maxRequests: 120,
  windowMs: 60 * 1000,
};

function json(body: unknown, status: number, extra?: HeadersInit): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...extra },
  });
}

export const GET: APIRoute = async ({ request }) => {
  const rl = checkRateLimit(getClientIp(request), SITE_SETTINGS_RATE_LIMIT);
  if (!rl.allowed) return rateLimitResponse(rl.retryAfterMs);

  if (!validateFrontendApiKey(request)) {
    console.error("[GET /api/external/site-settings] Solicitud no autorizada");
    return unauthorizedResponse();
  }

  try {
    const data = await SiteSettingsService.getPublicProfile();
    return json({ success: true, data }, 200, {
      "Cache-Control": "private, max-age=60",
    });
  } catch (error) {
    console.error("[GET /api/external/site-settings] Error interno:", {
      error: error instanceof Error ? error.message : "Error desconocido",
    });
    return json(
      { success: false, error: "Error interno al obtener la configuración" },
      500,
    );
  }
};
