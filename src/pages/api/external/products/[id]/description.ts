import type { APIRoute } from "astro";
import {
  unauthorizedResponse,
  validateMcpApiKey,
} from "../../../../../lib/serverApiAuth";
import { ProductService } from "../../../../../services/productService";

/**
 * Service-to-service: updates the descriptions of a product for the MCP server.
 *
 * Auth: X-API-Key against the dedicated MCP_API_SECRET (no fallback to other secrets).
 * CORS: handled by the global middleware.
 */

const JSON_HEADERS = { "Content-Type": "application/json" };

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

export const PUT: APIRoute = async ({ request, params }) => {
  if (!validateMcpApiKey(request)) {
    console.error(
      "[PUT /api/external/products/[id]/description] Solicitud no autorizada",
    );
    return unauthorizedResponse();
  }

  const productId = Number(params.id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return json({ success: false, error: "ID de producto inválido" }, 400);
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

  const fields: {
    short_description?: string | null;
    description?: string | null;
  } = {};
  for (const key of ["short_description", "description"] as const) {
    if (!(key in body)) continue;
    const value = body[key];
    if (value !== null && typeof value !== "string") {
      return json(
        { success: false, error: `El campo ${key} debe ser texto` },
        400,
      );
    }
    fields[key] = value;
  }
  if (Object.keys(fields).length === 0) {
    return json(
      { success: false, error: "Debes enviar short_description o description" },
      400,
    );
  }

  try {
    const product = await ProductService.updateDescription(productId, fields);
    if (!product) {
      return json({ success: false, error: "El producto no existe" }, 404);
    }
    console.log(
      "[PUT /api/external/products/[id]/description] Descripción actualizada:",
      {
        productId,
        fields: Object.keys(fields),
      },
    );
    return json({ success: true, data: product }, 200);
  } catch (error) {
    console.error("[PUT /api/external/products/[id]/description] Error:", {
      productId,
      error,
    });
    return json(
      { success: false, error: "Error interno al actualizar la descripción" },
      500,
    );
  }
};
