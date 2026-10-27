import type { APIRoute } from "astro";
import { InventoryError } from "../../../../../lib/inventoryUnits";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../lib/serverApiAuth";
import { WarehouseLocationService } from "../../../../../services/warehouseLocationService";

/**
 * Service-to-service: edits one warehouse location for the MCP server, under optimistic
 * concurrency (`row_version`). Partial update: absent fields keep their stored value.
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (checked before the body is read).
 */

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const PUT: APIRoute = async ({ request, params }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[PUT /api/external/warehouse/locations/[id]] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  const id = params.id;
  if (!id)
    return json({ success: false, error: "ID de ubicación inválido" }, 400);

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
        error: "Falta la versión de la ubicación (row_version); recárgala",
      },
      400,
    );
  }

  const { row_version: _ignored, ...draft } = body;

  try {
    const updated = await WarehouseLocationService.update(
      id,
      draft,
      rowVersion,
      null,
    );
    return json({ success: true, data: updated }, 200);
  } catch (error) {
    if (error instanceof InventoryError) {
      return json(
        { success: false, error: error.message, code: error.code },
        error.status,
      );
    }
    console.error("[PUT /api/external/warehouse/locations/[id]] Error:", {
      id,
      error,
    });
    return json(
      { success: false, error: "Error interno al actualizar la ubicación" },
      500,
    );
  }
};
