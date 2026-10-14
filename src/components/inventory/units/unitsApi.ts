import type { InventoryUnitView } from "../../../services/serialisedAssetService";
import type { LocationTreeNode } from "../../../lib/warehouseLocations";
import type { AssetRelocation, InventoryUnit, UnitCondition, UnitWear } from "../../../types/inventory";
import type { UnitPatch } from "../../../lib/inventoryUnits";

/**
 * Browser client for the 0021 inventory endpoints. `fetchImpl` is injectable so the tab logic is
 * tested without a DOM; the session travels in the httpOnly cookies, plus the bearer token when the
 * page has one (same as `ProductAPI`).
 */
export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; code?: string; isConflict: boolean };

export interface UnitsApiOptions {
  fetchImpl?: typeof fetch;
  accessToken?: string | undefined;
}

export interface BulkUnitsPayload {
  count: number;
  wear: UnitWear;
  condition: Exclude<UnitCondition, "retired">;
  location_id?: string;
  location?: string;
  serial_prefix?: string;
}

const NETWORK_ERROR = "No pudimos conectar con el servidor. Revisa tu conexión e inténtalo de nuevo.";
const GENERIC_ERROR = "Ocurrió un error inesperado. Inténtalo de nuevo.";

export async function requestJson<T>(
  url: string,
  init: { method?: string; body?: unknown },
  options: UnitsApiOptions,
): Promise<ApiResult<T>> {
  const fetchImpl = options.fetchImpl ?? fetch;
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  let response: Response;
  try {
    response = await fetchImpl(url, {
      method: init.method ?? "GET",
      headers,
      credentials: "same-origin",
      ...(init.body !== undefined ? { body: JSON.stringify(init.body) } : {}),
    });
  } catch {
    return { ok: false, status: 0, error: NETWORK_ERROR, isConflict: false };
  }

  let payload: { success?: boolean; data?: T; error?: string; code?: string } | null = null;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  if (response.ok && payload?.success) return { ok: true, data: payload.data as T };

  const code = payload?.code;
  return {
    ok: false,
    status: response.status,
    error: payload?.error || GENERIC_ERROR,
    ...(code ? { code } : {}),
    isConflict: response.status === 409 && code === "CONFLICT",
  };
}

type Versioned = Pick<InventoryUnit, "id" | "row_version">;

export function createUnitsApi(options: UnitsApiOptions = {}) {
  return {
    listUnits(productId: number) {
      return requestJson<{ units: InventoryUnitView[]; total: number }>(`/api/inventory/products/${productId}/units`, {}, options);
    },
    updateUnit(unit: Versioned, patch: UnitPatch) {
      return requestJson<InventoryUnit>(
        `/api/inventory/assets/${unit.id}`,
        { method: "PUT", body: { ...patch, row_version: unit.row_version } },
        options,
      );
    },
    archiveUnit(unit: Versioned) {
      return requestJson<InventoryUnit>(
        `/api/inventory/assets/${unit.id}/archive`,
        { method: "POST", body: { row_version: unit.row_version } },
        options,
      );
    },
    relocateUnit(unit: Versioned, toLocationId: string, notes?: string) {
      const trimmed = notes?.trim();
      return requestJson<{ relocation: AssetRelocation; unit: InventoryUnit }>(
        `/api/inventory/assets/${unit.id}/relocate`,
        { method: "POST", body: { to_location_id: toLocationId, row_version: unit.row_version, ...(trimmed ? { notes: trimmed } : {}) } },
        options,
      );
    },
    bulkCreate(productId: number, payload: BulkUnitsPayload) {
      return requestJson<{ units: InventoryUnit[]; total: number }>(
        `/api/inventory/products/${productId}/units`,
        { method: "POST", body: payload },
        options,
      );
    },
    listLocationTree() {
      return requestJson<{ tree: LocationTreeNode[] }>("/api/inventory/locations?view=tree", {}, options);
    },
  };
}

export type UnitsApi = ReturnType<typeof createUnitsApi>;
