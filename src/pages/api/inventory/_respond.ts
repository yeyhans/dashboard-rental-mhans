import { InventoryError } from '../../../lib/inventoryUnits';

/**
 * Response helpers shared by the 0021 inventory endpoints. The leading underscore keeps Astro
 * from routing this file.
 */
export function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

export function fail(error: string, status: number, code?: string): Response {
  return json(code ? { success: false, error, code } : { success: false, error }, status);
}

/** `{}` for an empty body; `null` for malformed JSON or a non-object. */
export async function readJsonObject(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await request.text();
    if (!text.trim()) return {};
    const parsed = JSON.parse(text);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** A positive integer from a route param, query value or body field; `null` otherwise. */
export function positiveInt(value: unknown): number | null {
  if (typeof value === 'number') return Number.isInteger(value) && value > 0 ? value : null;
  if (typeof value !== 'string' || !/^\d+$/.test(value.trim())) return null;
  const parsed = Number(value.trim());
  return parsed > 0 ? parsed : null;
}

/**
 * An `InventoryError` is a sentence the operator can act on, answered with its own status. Anything
 * else is internal: logged with context, answered with the generic `fallback` (no DB details).
 */
export function errorResponse(error: unknown, fallback: string, context: Record<string, unknown>): Response {
  if (error instanceof InventoryError) return fail(error.message, error.status, error.code);
  console.error(`[${String(context.endpoint ?? 'inventory')}] Error:`, { ...context, error });
  return fail(fallback, 500);
}

export function sessionUserId(locals: unknown): string | null {
  return (locals as { user?: { id?: string } })?.user?.id ?? null;
}
