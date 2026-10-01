import type { APIRoute } from 'astro';
import { FORBIDDEN_ROLE_ERROR } from '../../../lib/accessControl';
import { ASSET_TAG_FORMAT_ERROR, ASSET_TAG_TAKEN_ERROR } from '../../../lib/assetTag';
import { withAuth } from '../../../middleware/auth';
import { SerialisedAssetService } from '../../../services/serialisedAssetService';
import type { AssetCondition } from '../../../types/inventory';

// Serialised inventory intake (M6, T-035). Admin-only: serial numbers and equipment locations are
// inventory-security data, and the underlying table is not readable by any other role (T-034).
// CORS handled by global middleware.

/**
 * Errors the service raises deliberately and phrases in Spanish for the operator. Anything else is
 * an internal failure and must not reach the client (rule 05: no stack traces, no DB codes).
 */
const CLIENT_ERRORS: Array<{ match: string; status: number }> = [
  { match: ASSET_TAG_TAKEN_ERROR, status: 409 },
  { match: 'Ya existe un equipo registrado con ese número de serie', status: 409 },
  { match: 'El producto indicado no existe', status: 404 },
  { match: ASSET_TAG_FORMAT_ERROR, status: 400 },
  { match: 'Condición inválida', status: 400 },
  { match: 'El número de serie es obligatorio', status: 400 },
  { match: 'La ubicación es obligatoria', status: 400 },
  { match: 'Debes seleccionar un producto válido', status: 400 },
];

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

function fail(error: string, status: number): Response {
  return json({ success: false, error }, status);
}

export const POST: APIRoute = withAuth(async ({ request, locals }) => {
  let body: Record<string, unknown>;
  try {
    body = await request.json();
  } catch {
    return fail('JSON inválido', 400);
  }

  const productId = Number(body.product_id);
  if (!Number.isInteger(productId) || productId <= 0) {
    return fail('Debes seleccionar un producto válido', 400);
  }

  // Presence only. The tag is forwarded as scanned: the service owns normalisation (lower case,
  // trailing Enter from a HID gun) and the format rule, and validating it twice would let the two
  // drift — same reasoning as `condition` below.
  const assetTag = typeof body.asset_tag === 'string' ? body.asset_tag : '';
  if (!assetTag.trim()) {
    return fail(ASSET_TAG_FORMAT_ERROR, 400);
  }

  const serialNumber = typeof body.serial_number === 'string' ? body.serial_number.trim() : '';
  if (!serialNumber) {
    return fail('El número de serie es obligatorio', 400);
  }

  const location = typeof body.location === 'string' ? body.location.trim() : '';
  if (!location) {
    return fail('La ubicación es obligatoria', 400);
  }

  const kitCode = typeof body.kit_code === 'string' ? body.kit_code.trim() : '';
  const notes = typeof body.notes === 'string' ? body.notes.trim() : '';

  try {
    const asset = await SerialisedAssetService.createAsset({
      product_id: productId,
      asset_tag: assetTag,
      serial_number: serialNumber,
      // The service owns the condition vocabulary; validating it twice would let the two drift.
      condition: body.condition as AssetCondition,
      location,
      // A kit field left blank means "no kit", not "a kit whose code is empty".
      kit_code: kitCode || null,
      notes: notes || null,
    });

    return json({ success: true, data: asset }, 201);
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    const known = CLIENT_ERRORS.find((candidate) => message.startsWith(candidate.match));
    if (known) {
      return fail(message, known.status);
    }

    console.error('[POST /api/inventory/assets] Error:', {
      error,
      productId,
      assetTag,
      serialNumber,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al registrar el equipo', 500);
  }
});

export const GET: APIRoute = withAuth(async ({ request, locals }) => {
  const url = new URL(request.url);
  const tag = url.searchParams.get('tag');
  const serial = url.searchParams.get('serial');
  const productIdParam = url.searchParams.get('product_id');

  if (!tag && !serial && !productIdParam) {
    return fail('Debes indicar un asset tag, un número de serie o un producto', 400);
  }

  // R1-101: `withAuth` lets an operator reach this route for the scan lookup only. The serial
  // and per-product listings are inventory views; an operator resolves the one label they hold.
  const role = (locals as { user?: { role?: string } })?.user?.role;
  if (role === 'operator' && !tag) {
    return fail(FORBIDDEN_ROLE_ERROR, 403);
  }

  try {
    // The scan path: a label read off the unit. Checked first because it is the identifier the
    // count is driven by; the serial lookup predates the roll and stays for units without a label.
    if (tag) {
      const asset = await SerialisedAssetService.getByAssetTag(tag);
      if (!asset) {
        return fail('No existe una unidad con ese asset tag', 404);
      }
      return json({ success: true, data: asset }, 200);
    }

    if (serial) {
      const asset = await SerialisedAssetService.getAssetBySerial(serial);
      if (!asset) {
        return fail('No hay ningún equipo registrado con ese número de serie', 404);
      }
      return json({ success: true, data: asset }, 200);
    }

    const productId = Number(productIdParam);
    if (!Number.isInteger(productId) || productId <= 0) {
      return fail('ID de producto inválido', 400);
    }

    const assets = await SerialisedAssetService.listAssetsByProduct(productId);
    return json({ success: true, data: { assets, total: assets.length } }, 200);
  } catch (error) {
    console.error('[GET /api/inventory/assets] Error:', {
      error,
      tag,
      serial,
      productIdParam,
      userId: (locals as { user?: { id: string } })?.user?.id,
    });
    return fail('Error al consultar los equipos', 500);
  }
});
