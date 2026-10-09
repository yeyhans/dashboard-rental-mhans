import type { APIRoute } from "astro";
import { withAuth } from "../../../middleware/auth";
import { PlacesService } from "../../../services/placesService";
import { SESSION_TOKEN_RE, jsonResponse, runPlacesEndpoint } from "./_shared";

// Admin-only address autocomplete (Google Places New). CORS handled by global middleware.
export const POST: APIRoute = withAuth((context) =>
  runPlacesEndpoint(context, async (body) => {
    const input = typeof body.input === "string" ? body.input.trim() : "";
    if (input.length < 3 || input.length > 120) {
      return jsonResponse(
        {
          success: false,
          error: "La dirección debe tener entre 3 y 120 caracteres.",
        },
        400,
      );
    }
    const sessionToken = body.sessionToken;
    if (
      typeof sessionToken !== "string" ||
      !SESSION_TOKEN_RE.test(sessionToken)
    ) {
      return jsonResponse(
        { success: false, error: "La solicitud no es válida." },
        400,
      );
    }
    return PlacesService.autocomplete({ input, sessionToken });
  }),
);
