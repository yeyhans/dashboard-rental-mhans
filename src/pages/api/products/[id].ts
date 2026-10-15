import type { APIRoute } from "astro";
import { parseValuationUpdates } from "../../../lib/productValuation";
import { ProductService } from "../../../services/productService";
import { withAuth } from "../../../middleware/auth";
// withCors removed - global middleware handles CORS

type ProductUpdates = Parameters<typeof ProductService.updateProduct>[1];

const arrayJsonFields = [
  "categories_ids",
  "images",
  "tags",
  "related_ids",
] as const;

function invalidJsonArrayResponse() {
  return new Response(
    JSON.stringify({
      success: false,
      error:
        "Algunos datos del producto tienen un formato inválido. Revisa los campos de categorías, imágenes, etiquetas o relacionados.",
    }),
    {
      status: 400,
      headers: {
        "Content-Type": "application/json",
      },
    },
  );
}

function normalizeCategoryIds(value: unknown[]): string[] | null {
  const normalizedCategoryIds: string[] = [];

  for (const item of value) {
    if (typeof item === "string") {
      normalizedCategoryIds.push(item);
      continue;
    }

    if (typeof item === "number" && Number.isFinite(item)) {
      normalizedCategoryIds.push(item.toString());
      continue;
    }

    return null;
  }

  return normalizedCategoryIds;
}

function normalizeArrayJsonFields(
  updates: ProductUpdates,
): ProductUpdates | null {
  const normalizedUpdates: ProductUpdates = { ...updates };

  for (const field of arrayJsonFields) {
    if (!(field in normalizedUpdates)) continue;

    const value = normalizedUpdates[field];

    if (value === null || value === undefined) continue;

    if (Array.isArray(value)) {
      if (field === "categories_ids") {
        const normalizedCategoryIds = normalizeCategoryIds(value);
        if (!normalizedCategoryIds) return null;
        normalizedUpdates[field] = normalizedCategoryIds;
      }

      continue;
    }

    if (typeof value !== "string") return null;

    if (value.trim() === "") {
      normalizedUpdates[field] = null;
      continue;
    }

    try {
      const parsedValue = JSON.parse(value);
      if (!Array.isArray(parsedValue)) return null;
      if (field === "categories_ids") {
        const normalizedCategoryIds = normalizeCategoryIds(parsedValue);
        if (!normalizedCategoryIds) return null;
        normalizedUpdates[field] = normalizedCategoryIds;
      } else {
        normalizedUpdates[field] = parsedValue;
      }
    } catch {
      return null;
    }
  }

  return normalizedUpdates;
}

export const GET: APIRoute = withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);

    if (isNaN(productId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID de producto inválido",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const product = await ProductService.getProductById(productId);

    if (!product) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Producto no encontrado",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: product,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in GET /api/products/[id]:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error al obtener el producto",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});

export const PUT: APIRoute = withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);
    const updates = await context.request.json();

    if (isNaN(productId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID de producto inválido",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Verificar que el producto existe
    const existingProduct = await ProductService.getProductById(productId);
    if (!existingProduct) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Producto no encontrado",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Valuation fields (0010) are the one part of the body validated here: a negative or decimal
    // value would otherwise hit the CHECK constraint and surface as a bare 500. Only the keys
    // present are touched, blanks clear the value, and a derived `total_value_clp` is never
    // written — it is computed from quantity × used value and has no column.
    const { total_value_clp: _ignoredTotal, ...forwarded } = updates as Record<
      string,
      unknown
    >;
    const valuation = parseValuationUpdates(forwarded);
    if (valuation.error) {
      return new Response(
        JSON.stringify({
          success: false,
          error: valuation.error,
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    const normalizedUpdates = normalizeArrayJsonFields(
      forwarded as ProductUpdates,
    );
    if (!normalizedUpdates) {
      return invalidJsonArrayResponse();
    }

    const updatedProduct = await ProductService.updateProduct(productId, {
      ...normalizedUpdates,
      ...valuation.values,
      updated_at: new Date().toISOString(),
    });

    return new Response(
      JSON.stringify({
        success: true,
        data: updatedProduct,
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in PUT /api/products/[id]:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error al actualizar el producto",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});

export const DELETE: APIRoute = withAuth(async (context) => {
  try {
    const productId = parseInt(context.params.id as string);

    if (isNaN(productId)) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "ID de producto inválido",
        }),
        {
          status: 400,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    // Verificar que el producto existe
    const existingProduct = await ProductService.getProductById(productId);
    if (!existingProduct) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Producto no encontrado",
        }),
        {
          status: 404,
          headers: {
            "Content-Type": "application/json",
          },
        },
      );
    }

    await ProductService.deleteProduct(productId);

    return new Response(
      JSON.stringify({
        success: true,
        message: "Producto eliminado correctamente",
      }),
      {
        status: 200,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  } catch (error) {
    console.error("Error in DELETE /api/products/[id]:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: "Error al eliminar el producto",
      }),
      {
        status: 500,
        headers: {
          "Content-Type": "application/json",
        },
      },
    );
  }
});

// OPTIONS handler removed - handled by global middleware
