import { MOVEMENT_TRANSITION_ERRORS, validateMovementTransition } from '../lib/assetMovements';
import { isOverdueRow, kpis, overdueOrderIds, startOfBusinessDay, type MovementsKpis } from '../lib/movementsFeed';
import { clientName, isoDay, projectLabel } from '../lib/bodega';
import { supabaseAdmin } from '../lib/supabase';
import {
  isMovementDirection,
  type AssetMovement,
  type AssetMovementInput,
  type MovementDirection,
} from '../types/assetMovements';

/** Postgres unique-violation error code. */
const UNIQUE_VIOLATION = '23505';

/**
 * One row of the central feed (batch 3): the movement with its unit, model, order and operator
 * resolved through PostgREST embeds — the same style `deliveryService.getBoard` uses. Every
 * relation is a real FK (0004 `serialised_assets.product_id`, 0006 `asset_id` / `order_id` /
 * `checked_by_admin_id`), so PostgREST can follow them without a hint.
 */
export interface FeedMovement {
  id: number;
  direction: MovementDirection;
  checked_at: string;
  condition_notes: string | null;
  asset: { id: number; asset_tag: string; serial_number: string; product_id: number } | null;
  product: { name: string } | null;
  order: { id: number; client: string; project: string; endDate: string | null } | null;
  operator: { id: number; email: string } | null;
  /** A checkout still open on an order whose end date is past. */
  overdue: boolean;
}

export interface FeedQuery {
  since?: string | null;
  until?: string | null;
  direction?: MovementDirection | null;
  adminId?: number | null;
  limit?: number;
}

export interface MovementsFeed {
  movements: FeedMovement[];
  kpis: MovementsKpis;
  /** Distinct operators seen in the window, for the filter bar. */
  operators: Array<{ id: number; email: string }>;
  generatedAt: string;
}

const FEED_SELECT =
  'id, asset_id, order_id, direction, condition_notes, checked_by_admin_id, checked_at, ' +
  'serialised_assets (id, asset_tag, serial_number, product_id, products (name)), ' +
  'orders (id, billing_first_name, billing_last_name, billing_company, order_proyecto, order_fecha_termino), ' +
  'admin_users (id, email)';

/** `asset_current_state` (0012): one row per unit, its latest movement. Filtered to checkouts = units out. */
const STATE_SELECT = 'asset_id, order_id, direction, checked_at';

export const FEED_DEFAULT_LIMIT = 200;
export const FEED_MAX_LIMIT = 500;

/**
 * Asset movements — checkout/checkin audit trail against `serialised_assets` (T-026 gap 1/4).
 *
 * NOTE: `asset_movements` (`0006_t026_schema_gaps.sql`) has not been applied to any database yet
 * (pending staging rehearsal, see `apply-progress.md` "T-026 resuelto"). This service is written
 * and tested against the migration's contract ahead of that rehearsal — same "schema-first" shape
 * `serialisedAssetService.ts` used for `serialised_assets` in 0004.
 *
 * The transition rule (no double checkout, no checkin without an open checkout) lives in the pure
 * `lib/assetMovements.ts` — this class only fetches the asset's history and applies it.
 */
export class AssetMovementService {
  /**
   * `as any`: `asset_movements` is not yet in the generated `Database` type (the migration has
   * not been applied to any database — see the module note above), so the typed client rejects
   * `.from('asset_movements')`. Replace with the typed client once
   * `npx supabase gen types typescript` is re-run after the migration lands, same as
   * `serialisedAssetService.ts` did after 0004.
   */
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin) {
      throw new Error('Supabase admin client not available');
    }
    return supabaseAdmin as any;
  }

  /**
   * Full movement history for one asset, newest first. Used both to validate the next transition
   * and to render a Check-In screen's per-unit timeline.
   */
  static async getHistoryForAsset(assetId: number): Promise<AssetMovement[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .select('*')
      .eq('asset_id', assetId)
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('[AssetMovementService] Error al obtener el historial del equipo:', {
        assetId,
        error,
      });
      throw error;
    }

    return (data as AssetMovement[]) || [];
  }

  /**
   * Records a checkout or checkin against an asset, after validating the transition against that
   * asset's own history. Rejects before hitting the database if `direction` is not one of the
   * CHECK constraint's values.
   *
   * The transition rule itself lives ONLY in `validateMovementTransition` (R3-103, review R3 on
   * `4de3c5c`) — this method does not reimplement the "no double checkout" / "no checkin without
   * an open checkout" logic, so the rule and its error strings cannot drift from the pure
   * function `lib/__tests__/assetMovements.test.ts` already covers.
   *
   * This history-based check is still subject to a TOCTOU race between two concurrent requests
   * for the same asset (R3-102): the DB-level partial unique index added in 0006
   * (`asset_movements_one_open_checkout_idx`) is the actual guard against that race, and the
   * `catch` below maps its 23505 violation to the same message (R3-102b).
   */
  static async recordMovement(input: AssetMovementInput): Promise<AssetMovement> {
    if (!isMovementDirection(input.direction)) {
      throw new Error('Dirección inválida. Debe ser "checkout" o "checkin"');
    }
    if (!Number.isInteger(input.asset_id) || input.asset_id <= 0) {
      throw new Error('Debes indicar un equipo válido');
    }
    if (!Number.isInteger(input.order_id) || input.order_id <= 0) {
      throw new Error('Debes indicar una orden válida');
    }

    const history = await this.getHistoryForAsset(input.asset_id);
    const transition = validateMovementTransition(input.direction, history);
    if (!transition.valid) {
      throw new Error(transition.error);
    }

    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .insert({
        asset_id: input.asset_id,
        order_id: input.order_id,
        direction: input.direction,
        condition_notes: input.condition_notes ?? null,
        checked_by_admin_id: input.checked_by_admin_id ?? null,
      })
      .select()
      .single();

    if (error) {
      if ((error as { code?: string }).code === UNIQUE_VIOLATION) {
        // R3-102b: the app-level history check above raced and lost — the DB's partial unique
        // index caught the second concurrent checkout. Same message the synchronous path throws,
        // so the endpoint's CLIENT_ERRORS matcher needs no second branch.
        throw new Error(MOVEMENT_TRANSITION_ERRORS.OPEN_CHECKOUT_EXISTS);
      }

      console.error('[AssetMovementService] Error al registrar el movimiento:', {
        assetId: input.asset_id,
        orderId: input.order_id,
        direction: input.direction,
        error,
      });
      throw error;
    }

    console.log('[AssetMovementService] Movimiento registrado:', {
      movementId: (data as AssetMovement).id,
      assetId: input.asset_id,
      direction: input.direction,
    });

    return data as AssetMovement;
  }

  /** Lists movements for one order — the Check-In screen's per-order view. */
  static async listByOrder(orderId: number): Promise<AssetMovement[]> {
    const client = this.ensureSupabaseAdmin();
    const { data, error } = await client
      .from('asset_movements')
      .select('*')
      .eq('order_id', orderId)
      .order('checked_at', { ascending: false });

    if (error) {
      console.error('[AssetMovementService] Error al listar movimientos de la orden:', {
        orderId,
        error,
      });
      throw error;
    }

    return (data as AssetMovement[]) || [];
  }

  /**
   * The central feed: recent movements with everything the admin's table shows, plus the KPIs.
   * Filters are applied server-side (`since`/`until` on `checked_at`, `direction`, operator);
   * the KPIs are NOT filtered — "units out now" is a fact about the whole garage, not about the
   * rows on screen — and come from the `asset_current_state` view (0012) plus a count of today's
   * movements. No row window anywhere: an old checkout with no later checkin is out, full stop.
   */
  static async listFeed(query: FeedQuery = {}, now: Date = new Date()): Promise<MovementsFeed> {
    const client = this.ensureSupabaseAdmin();
    const limit = Math.min(FEED_MAX_LIMIT, Math.max(1, query.limit ?? FEED_DEFAULT_LIMIT));

    let feedQuery = client.from('asset_movements').select(FEED_SELECT);
    if (query.since) feedQuery = feedQuery.gte('checked_at', query.since);
    if (query.until) feedQuery = feedQuery.lt('checked_at', query.until);
    if (query.direction) feedQuery = feedQuery.eq('direction', query.direction);
    if (query.adminId != null) feedQuery = feedQuery.eq('checked_by_admin_id', query.adminId);
    feedQuery = feedQuery.order('checked_at', { ascending: false }).limit(limit);

    const [
      { data: rows, error: feedError },
      { data: openRows, error: stateError },
      { count: todayCount, error: todayError },
    ] = await Promise.all([
      feedQuery,
      client.from('asset_current_state').select(STATE_SELECT).eq('direction', 'checkout'),
      client.from('asset_movements').select('id', { count: 'exact', head: true }).gte('checked_at', startOfBusinessDay(now)),
    ]);

    if (feedError) {
      console.error('[AssetMovementService] Error al cargar el feed de movimientos:', { query, error: feedError });
      throw feedError;
    }
    if (stateError) {
      console.error('[AssetMovementService] Error al cargar el estado actual de las unidades:', { error: stateError });
      throw stateError;
    }
    if (todayError) {
      console.error('[AssetMovementService] Error al contar los movimientos de hoy:', { error: todayError });
      throw todayError;
    }

    const open = (openRows as Array<Pick<AssetMovement, 'asset_id' | 'order_id' | 'direction' | 'checked_at'> & { id?: number }>) || [];
    const openAssetIds = new Set(open.map((movement) => movement.asset_id));

    // End dates for every order with something out — the overdue rule needs them, and the feed
    // rows only carry their own order.
    const openOrderIds = [...new Set(open.map((movement) => movement.order_id))];
    let orders: Array<{ id: number; order_fecha_termino: string | null }> = [];
    if (openOrderIds.length > 0) {
      const { data, error } = await client.from('orders').select('id, order_fecha_termino').in('id', openOrderIds);
      if (error) {
        console.error('[AssetMovementService] Error al cargar las órdenes con unidades afuera:', { error });
        throw error;
      }
      orders = (data as typeof orders) || [];
    }
    const overdueOrders = overdueOrderIds(orders, isoDay(now));

    const operators = new Map<number, string>();
    const movements: FeedMovement[] = ((rows as any[]) || []).map((row) => {
      const asset = row.serialised_assets ?? null;
      const order = row.orders ?? null;
      const admin = row.admin_users ?? null;
      if (admin?.id != null) operators.set(admin.id, admin.email ?? '');
      return {
        id: row.id,
        direction: row.direction,
        checked_at: row.checked_at,
        condition_notes: row.condition_notes ?? null,
        asset: asset
          ? { id: asset.id, asset_tag: asset.asset_tag, serial_number: asset.serial_number, product_id: asset.product_id }
          : null,
        product: asset?.products?.name ? { name: asset.products.name } : null,
        order: order
          ? {
              id: order.id,
              client: clientName(order),
              project: projectLabel(order),
              endDate: order.order_fecha_termino ? isoDay(order.order_fecha_termino) : null,
            }
          : null,
        operator: admin ? { id: admin.id, email: admin.email } : null,
        overdue: isOverdueRow(
          { id: row.id, asset_id: row.asset_id, order_id: row.order_id, direction: row.direction, checked_at: row.checked_at },
          openAssetIds,
          overdueOrders
        ),
      };
    });

    return {
      movements,
      kpis: kpis(open.map((row) => ({ ...row, id: row.id ?? 0 })), orders, now, todayCount ?? 0),
      operators: [...operators.entries()].map(([id, email]) => ({ id, email })).sort((a, b) => a.email.localeCompare(b.email)),
      generatedAt: now.toISOString(),
    };
  }
}

export default AssetMovementService;
