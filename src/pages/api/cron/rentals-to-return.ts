import type { APIRoute } from "astro";
import { businessDay } from "../../../lib/businessDay";
import { OrderService } from "../../../services/orderService";

/**
 * Hourly job (R-02), called by a Cloudflare Worker: moves every `in-rental` order whose end date
 * has passed to `return`. There is no admin session on a cron call, so this route authenticates
 * itself with `Authorization: Bearer <CRON_SECRET>` instead of `withAuth`. The global middleware
 * lets `/api/*` through to each route, so no bypass is needed there.
 */

const encoder = new TextEncoder();

function constantTimeEqual(a: string, b: string): boolean {
  const aBytes = encoder.encode(a);
  const bBytes = encoder.encode(b);
  const maxLength = Math.max(aBytes.length, bBytes.length, 1);
  let diff = aBytes.length ^ bBytes.length;

  for (let i = 0; i < maxLength; i += 1) {
    diff |= (aBytes[i] ?? 0) ^ (bBytes[i] ?? 0);
  }

  return diff === 0;
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export const POST: APIRoute = async ({ request }) => {
  const expectedSecret = import.meta.env.CRON_SECRET;
  if (!expectedSecret) {
    console.error("[Cron rentals-to-return] CRON_SECRET no está configurado");
    return json({ success: false, error: "Cron no configurado" }, 503);
  }

  const header = request.headers.get("Authorization") ?? "";
  const providedSecret = header.startsWith("Bearer ")
    ? header.slice("Bearer ".length)
    : "";
  if (!providedSecret || !constantTimeEqual(providedSecret, expectedSecret)) {
    return json({ success: false, error: "No autorizado" }, 401);
  }

  const today = businessDay(new Date());
  try {
    const result = await OrderService.moveExpiredRentalsToReturn(today);
    if (result.moved > 0) {
      console.log("[Cron rentals-to-return] Órdenes pasadas a devolución:", {
        today,
        ...result,
      });
    }
    return json({ success: true, data: result }, 200);
  } catch (error) {
    console.error(
      "[Cron rentals-to-return] Error al mover arriendos vencidos:",
      {
        today,
        error,
      },
    );
    return json(
      { success: false, error: "Error al procesar los arriendos vencidos" },
      500,
    );
  }
};
