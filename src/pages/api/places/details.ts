import type { APIRoute } from "astro";
import { withAuth } from "../../../middleware/auth";
import { PlacesService } from "../../../services/placesService";
import {
  PLACE_ID_RE,
  SESSION_TOKEN_RE,
  jsonResponse,
  runPlacesEndpoint,
} from "./_shared";

// Admin-only place details (Google Places New). CORS handled by global middleware.
export const POST: APIRoute = withAuth((context) =>
  runPlacesEndpoint(context, async (body) => {
    const placeId = body.placeId;
    const sessionToken = body.sessionToken;
    if (
      typeof placeId !== "string" ||
      !PLACE_ID_RE.test(placeId) ||
      typeof sessionToken !== "string" ||
      !SESSION_TOKEN_RE.test(sessionToken)
    ) {
      return jsonResponse(
        { success: false, error: "La solicitud no es válida." },
        400,
      );
    }
    return PlacesService.details({ placeId, sessionToken });
  }),
);
