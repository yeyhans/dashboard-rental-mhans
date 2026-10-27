import type { APIRoute } from "astro";
import { InventoryError } from "../../../../../lib/inventoryUnits";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../lib/serverApiAuth";
import { SerialisedAssetService } from "../../../../../services/serialisedAssetService";

/**
 * Service-to-service: edits one serialised unit for the MCP server, under optimistic
 * concurrency (`row_version`). Location moves are NOT editable here: they must go through
 * AssetRelocationService so they leave an audit row.
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (no fallback to other secrets).
 * CORS: handled by the global middleware.
 */

const EDITABLE_FIELDS = [
  "serial_number",
  "condition",
  "wear",
  "kit_code",
  "notes",
  "acquisition_cost",
  "purchase_date",
  "market_price",
] as const;

const LOCATION_FIELDS = ["location", "location_id"] as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PUT: APIRoute = async ({ request, params }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[PUT /api/external/inventory/units/[id]] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  const unitId = Number(params.id);
  if (!Number.isInteger(unitId) || unitId <= 0) {
    return json({ success: false, error: "ID de unidad inválido" }, 400);
  }

  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed))
      throw new Error("not an object");
    body = parsed as Record<string, unknown>;
  } catch {
    return json(
      { success: false, error: "JSON inválido en el cuerpo de la solicitud" },
      400,
    );
  }

  const rowVersion = body.row_version;
  if (
    typeof rowVersion !== "number" ||
    !Number.isInteger(rowVersion) ||
    rowVersion <= 0
  ) {
    return json(
      {
        success: false,
        error: "Falta la versión de la unidad (row_version); recarga la unidad",
      },
      400,
    );
  }

  if (LOCATION_FIELDS.some((key) => key in body)) {
    return json(
      {
        success: false,
        error:
          "La ubicación no se edita aquí; los traslados se registran como reubicación",
      },
      400,
    );
  }

  const patch: Record<string, unknown> = {};
  for (const key of EDITABLE_FIELDS) {
    if (key in body) patch[key] = body[key];
  }
  if (Object.keys(patch).length === 0) {
    return json({ success: false, error: "No hay cambios para guardar" }, 400);
  }

  try {
    const unit = await SerialisedAssetService.updateAsset(
      unitId,
      patch,
      rowVersion,
    );
    return json({ success: true, data: unit }, 200);
  } catch (error) {
    if (error instanceof InventoryError) {
      return json(
        { success: false, error: error.message, code: error.code },
        error.status,
      );
    }
    console.error("[PUT /api/external/inventory/units/[id]] Error:", {
      unitId,
      error,
    });
    return json(
      { success: false, error: "Error interno al actualizar la unidad" },
      500,
    );
  }
};
