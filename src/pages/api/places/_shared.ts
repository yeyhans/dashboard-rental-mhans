import { checkRateLimit, rateLimitResponse } from "../../../lib/rateLimit";
import { PlacesError } from "../../../services/placesService";

/** Local limit (60 requests per minute per admin, shared by both endpoints). */
const PLACES_RATE_LIMIT = {
  name: "places",
  maxRequests: 60,
  windowMs: 60 * 1000,
} as const;

export const SESSION_TOKEN_RE = /^[A-Za-z0-9-]{16,64}$/;
export const PLACE_ID_RE = /^[A-Za-z0-9_-]{1,256}$/;

export function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    },
  });
}

/**
 * Shared pipeline after `withAuth`: per-admin rate limit, JSON parsing and error mapping.
 * `handle` validates the body and returns the data, or a Response for validation errors.
 */
export async function runPlacesEndpoint(
  context: { request: Request; locals?: { user?: { id?: string } } },
  handle: (body: Record<string, unknown>) => Promise<unknown>,
): Promise<Response> {
  const adminId = context.locals?.user?.id ?? "unknown";

  const limit = checkRateLimit(adminId, PLACES_RATE_LIMIT);
  if (!limit.allowed) {
    const limited = rateLimitResponse(limit.retryAfterMs);
    limited.headers.set("Cache-Control", "no-store");
    return limited;
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await context.request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("shape");
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonResponse(
      { success: false, error: "La solicitud no es válida." },
      400,
    );
  }

  try {
    const result = await handle(body);
    if (result instanceof Response) return result;
    return jsonResponse({ success: true, data: result }, 200);
  } catch (error) {
    const code = error instanceof PlacesError ? error.code : "unexpected";
    // Never log the query, the place id or the address.
    console.error("[POST /api/places] Error consultando direcciones:", {
      adminId,
      code,
    });
    if (code === "not_found") {
      return jsonResponse(
        { success: false, error: "No encontramos esa dirección." },
        404,
      );
    }
    return jsonResponse(
      {
        success: false,
        error:
          "El buscador de direcciones no está disponible. Puedes escribirla a mano.",
      },
      503,
    );
  }
}
