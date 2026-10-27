import type { APIRoute } from "astro";
import { InventoryError } from "../../../../../lib/inventoryUnits";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../lib/serverApiAuth";
import { WarehouseLocationService } from "../../../../../services/warehouseLocationService";

/**
 * Service-to-service: lists and creates warehouse locations for the MCP server.
 *
 * POST accepts one draft (`{ ...draft }`) or a batch (`{ locations: [...] }`, at most 50). A batch
 * is NOT atomic: each draft is validated and written on its own, and the answer says, per item,
 * whether it was created or why it was refused. Nothing is left half-written inside one item.
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (checked before the body is read).
 */

const MAX_BATCH = 50;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const GET: APIRoute = async ({ request }) => {
  if (!validateMcpApiKey(request)) return unauthorizedResponse();
  try {
    const locations = await WarehouseLocationService.list();
    return json({ success: true, data: locations }, 200);
  } catch (error) {
    console.error("[GET /api/external/warehouse/locations] Error:", { error });
    return json(
      { success: false, error: "Error interno al listar las ubicaciones" },
      500,
    );
  }
};

export const POST: APIRoute = async ({ request }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[POST /api/external/warehouse/locations] Solicitud no autorizada",
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
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return json({ success: false, error: "Se espera un objeto" }, 400);
  }

  const record = body as Record<string, unknown>;
  if ("locations" in record) {
    const drafts = record.locations;
    if (!Array.isArray(drafts) || drafts.length === 0) {
      return json(
        {
          success: false,
          error: "locations debe ser una lista con al menos una ubicación",
        },
        400,
      );
    }
    if (drafts.length > MAX_BATCH) {
      return json(
        { success: false, error: `Máximo ${MAX_BATCH} ubicaciones por lote` },
        400,
      );
    }

    const results: Array<Record<string, unknown>> = [];
    for (const [index, draft] of drafts.entries()) {
      try {
        const created = await WarehouseLocationService.create(draft, null);
        results.push({
          index,
          ok: true,
          location: created.location,
          warnings: created.warnings,
        });
      } catch (error) {
        results.push(itemFailure(index, error));
      }
    }
    const failed = results.filter((r) => r.ok !== true).length;
    return json(
      {
        success: failed === 0,
        data: {
          creadas: results.length - failed,
          fallidas: failed,
          resultados: results,
        },
      },
      failed === 0 ? 201 : 200,
    );
  }

  try {
    const created = await WarehouseLocationService.create(body, null);
    return json({ success: true, data: created }, 201);
  } catch (error) {
    if (error instanceof InventoryError) {
      return json(
        { success: false, error: error.message, code: error.code },
        error.status,
      );
    }
    console.error("[POST /api/external/warehouse/locations] Error:", { error });
    return json(
      { success: false, error: "Error interno al crear la ubicación" },
      500,
    );
  }
};

function itemFailure(index: number, error: unknown): Record<string, unknown> {
  if (error instanceof InventoryError) {
    return { index, ok: false, error: error.message, status: error.status };
  }
  console.error("[POST /api/external/warehouse/locations] Error en ítem:", {
    index,
    error,
  });
  return {
    index,
    ok: false,
    error: "Error interno al crear la ubicación",
    status: 500,
  };
}
