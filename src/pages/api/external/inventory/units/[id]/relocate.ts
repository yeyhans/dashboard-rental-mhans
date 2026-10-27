import type { APIRoute } from "astro";
import { InventoryError } from "../../../../../../lib/inventoryUnits";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../../lib/serverApiAuth";
import { AssetRelocationService } from "../../../../../../services/assetRelocationService";

/**
 * Service-to-service: moves one serialised unit to another warehouse location for the MCP server.
 *
 * The move is one INSERT into asset_relocations (its trigger moves the unit), so the audit row and
 * the move cannot disagree. `source` is always 'mcp'. Requires the unit's `row_version`; a stale
 * one answers 409 and nothing moves.
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (checked before the body is read).
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request, params }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[POST /api/external/inventory/units/[id]/relocate] Solicitud no autorizada",
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

  const toLocationId =
    typeof body.to_location_id === "string" ? body.to_location_id : "";
  const notes = typeof body.notes === "string" ? body.notes : null;

  try {
    const result = await AssetRelocationService.relocateAsset({
      assetId: unitId,
      toLocationId,
      movedByUserId: null,
      source: "mcp",
      expectedRowVersion: rowVersion,
      notes,
    });
    return json({ success: true, data: result }, 200);
  } catch (error) {
    if (error instanceof InventoryError) {
      return json(
        { success: false, error: error.message, code: error.code },
        error.status,
      );
    }
    console.error("[POST /api/external/inventory/units/[id]/relocate] Error:", {
      unitId,
      error,
    });
    return json(
      { success: false, error: "Error interno al mover la unidad" },
      500,
    );
  }
};
