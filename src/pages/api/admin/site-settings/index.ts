import type { APIRoute } from "astro";
import { requireRole } from "../../../../middleware/auth";
import {
  SiteSettingsService,
  SiteSettingsValidationError,
} from "../../../../services/siteSettingsService";

// Business settings (migration 0015). `super_admin` only: these values end up in contracts,
// budgets and the bank details customers pay into.
// CORS handled by global middleware.

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function fail(
  error: string,
  status: number,
  extra: Record<string, unknown> = {},
): Response {
  return json({ success: false, error, ...extra }, status);
}

function actorEmail(context: any): string {
  return context?.user?.email ?? context?.locals?.user?.email ?? "desconocido";
}

export const GET: APIRoute = requireRole("super_admin")(async (context) => {
  try {
    const settings = await SiteSettingsService.get();
    return json({ success: true, data: settings }, 200);
  } catch (error) {
    console.error("[GET /api/admin/site-settings] Error:", {
      error,
      admin: actorEmail(context),
    });
    return fail("Error al obtener la configuración del sitio", 500);
  }
});

export const PUT: APIRoute = requireRole("super_admin")(async (context) => {
  let body: unknown;
  try {
    body = await context.request.json();
  } catch {
    return fail("JSON inválido", 400);
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return fail(
      "El cuerpo debe ser un objeto con las secciones a guardar",
      400,
    );
  }

  try {
    const settings = await SiteSettingsService.update(
      body as Record<string, never>,
      actorEmail(context),
    );
    return json({ success: true, data: settings }, 200);
  } catch (error) {
    if (error instanceof SiteSettingsValidationError) {
      const { issues } = error.details;
      const summary = issues
        .map((issue) => `${issue.path}: ${issue.message}`)
        .join("; ");
      return fail(`${error.details.message}: ${summary}`, 400, {
        details: issues,
      });
    }

    console.error("[PUT /api/admin/site-settings] Error:", {
      error,
      admin: actorEmail(context),
    });
    return fail("Error al guardar la configuración del sitio", 500);
  }
});
