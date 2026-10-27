import type { APIRoute } from "astro";
import { InventoryError } from "../../../../../lib/inventoryUnits";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../lib/serverApiAuth";
import { SerialisedAssetService } from "../../../../../services/serialisedAssetService";

/**
 * Service-to-service: registers one serialised unit for the MCP server. The asset tag is assigned
 * by the Service; only the allowlisted fields below are forwarded (the Service validates values).
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (no fallback to other secrets).
 * CORS: handled by the global middleware.
 */

const OPTIONAL_FIELDS = [
  "serial_number",
  "condition",
  "wear",
  "location_id",
  "location",
  "kit_code",
  "notes",
  "acquisition_cost",
  "purchase_date",
  "market_price",
] as const;

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[POST /api/external/inventory/units] Solicitud no autorizada",
    );
    return unauthorizedResponse();
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

  const productId = body.product_id;
  if (
    typeof productId !== "number" ||
    !Number.isInteger(productId) ||
    productId <= 0
  ) {
    return json(
      { success: false, error: "product_id debe ser un entero positivo" },
      400,
    );
  }

  const input: Record<string, unknown> = { product_id: productId };
  for (const key of OPTIONAL_FIELDS) {
    if (key in body) input[key] = body[key];
  }

  try {
    const unit = await SerialisedAssetService.createUnit(input as never);
    console.log("[POST /api/external/inventory/units] Unidad registrada:", {
      unitId: unit.id,
      productId,
    });
    return json({ success: true, data: unit }, 201);
  } catch (error) {
    if (error instanceof InventoryError) {
      return json(
        { success: false, error: error.message, code: error.code },
        error.status,
      );
    }
    console.error("[POST /api/external/inventory/units] Error:", {
      productId,
      error,
    });
    return json(
      { success: false, error: "Error interno al registrar la unidad" },
      500,
    );
  }
};
