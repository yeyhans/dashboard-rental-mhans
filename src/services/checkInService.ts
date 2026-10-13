import { supabaseAdmin } from "../lib/supabase";
import { canonicalStatus } from "../lib/orderStatus";
import { businessDay } from "../lib/businessDay";
import {
  checkInKpis,
  returnUrgency,
  type CheckInKpis,
  type ReturnUrgency,
} from "../lib/checkIn";
import type { LineItem } from "../types/order";

/** One row of the canonical `.list-panel`. */
export interface CheckInListEntry {
  id: number;
  reference: string;
  client: string;
  project: string;
  status: string;
  endDate: string | null;
  urgency: ReturnUrgency;
  itemCount: number;
  lineItems: LineItem[];
}

export interface CheckInPagination {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
}

export interface CheckInBoard {
  kpis: CheckInKpis;
  entries: CheckInListEntry[];
  pagination: CheckInPagination;
}

/** The stages whose equipment is out and still has to come back (T-01). */
export const CHECK_IN_STATUSES = ["in-rental", "return"] as const;

export const CHECK_IN_PAGE_SIZE = { default: 50, max: 100 } as const;

/** Upper bound on the rows each KPI query reads (H-2). */
export const CHECK_IN_KPI_ROW_LIMIT = 2000;

const LIST_COLUMNS =
  "id, order_key, status, order_proyecto, order_fecha_termino, billing_first_name, billing_last_name, billing_company, line_items";

function clampInt(value: unknown, fallback: number, min: number, max: number) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/**
 * Data for Check-In / Devoluciones.
 *
 * T-01: the list holds only orders still to be received — `in-rental` (out with the client) and
 * `return` (due back) — ordered by return date, earliest first, so a return three days late sits
 * at the top. It is paginated on the server: the old fixed `.limit(200)` over every active stage
 * plus every completed order silently dropped returns once the table grew.
 *
 * The KPI strip is computed from two light queries over all open returns (two columns each), not
 * from the current page, so the counters do not change when the admin pages through the list.
 */
export class CheckInService {
  private static ensureSupabaseAdmin() {
    if (!supabaseAdmin)
      throw new Error("Supabase admin client is not initialized");
  }

  /** `now` is injected so the board is deterministic and testable. */
  static async getBoard(
    now: Date = new Date(),
    options: { page?: number; pageSize?: number } = {},
  ): Promise<CheckInBoard> {
    CheckInService.ensureSupabaseAdmin();

    const pageSize = clampInt(
      options.pageSize,
      CHECK_IN_PAGE_SIZE.default,
      1,
      CHECK_IN_PAGE_SIZE.max,
    );
    let page = clampInt(options.page, 1, 1, Number.MAX_SAFE_INTEGER);

    const fetchPage = (pageNumber: number) => {
      const offset = (pageNumber - 1) * pageSize;
      return supabaseAdmin!
        .from("orders")
        .select(LIST_COLUMNS, { count: "exact" })
        .in("status", [...CHECK_IN_STATUSES])
        .order("order_fecha_termino", { ascending: true })
        .order("id", { ascending: true })
        .range(offset, offset + pageSize - 1);
    };

    let { data, error, count } = await fetchPage(page);
    if (error) throw error;

    // H-2: a stale `?page=` past the end (returns closed since the link was made) lands on the
    // last page instead of an empty list that reads as "no returns".
    const lastPage = Math.max(1, Math.ceil((count ?? 0) / pageSize));
    if ((data ?? []).length === 0 && (count ?? 0) > 0 && page > lastPage) {
      page = lastPage;
      ({ data, error, count } = await fetchPage(page));
      if (error) throw error;
    }

    const entries: CheckInListEntry[] = (data ?? []).map((row: any) => {
      const lineItems = Array.isArray(row.line_items)
        ? (row.line_items as LineItem[])
        : [];
      const company = row.billing_company?.trim();
      const person =
        `${row.billing_first_name ?? ""} ${row.billing_last_name ?? ""}`.trim();

      return {
        id: row.id,
        reference: row.order_key || `PED-${row.id}`,
        client: company || person || "Sin cliente",
        project: row.order_proyecto || "Sin proyecto",
        status: canonicalStatus(row.status) ?? row.status,
        endDate: row.order_fecha_termino,
        urgency: returnUrgency({
          endDate: row.order_fecha_termino,
          status: row.status,
          now,
        }),
        itemCount: lineItems.reduce(
          (sum, item) => sum + (Number(item.quantity) || 0),
          0,
        ),
        lineItems,
      };
    });

    const total = count ?? entries.length;
    const kpis = await CheckInService.getKpis(now);

    return {
      kpis,
      entries,
      pagination: {
        page,
        pageSize,
        total,
        totalPages: Math.max(1, Math.ceil(total / pageSize)),
      },
    };
  }

  /**
   * Open returns plus the ones closed whose return date is today ("Recibidos Hoy"). Two columns
   * per row and bounded by `CHECK_IN_KPI_ROW_LIMIT` (H-2): far above the rental's real volume of
   * open returns, so the counters are exact in practice and the query can never grow unbounded.
   */
  private static async getKpis(now: Date): Promise<CheckInKpis> {
    const [open, closedToday] = await Promise.all([
      supabaseAdmin!
        .from("orders")
        .select("status, order_fecha_termino")
        .in("status", [...CHECK_IN_STATUSES])
        .order("order_fecha_termino", { ascending: true })
        .limit(CHECK_IN_KPI_ROW_LIMIT),
      supabaseAdmin!
        .from("orders")
        .select("status, order_fecha_termino")
        .eq("status", "completed")
        .eq("order_fecha_termino", businessDay(now))
        .limit(CHECK_IN_KPI_ROW_LIMIT),
    ]);
    if (open.error) throw open.error;
    if (closedToday.error) throw closedToday.error;

    // H-3: hitting the bound means the counters may be short; say so in the logs.
    for (const [query, rows] of [
      ["devoluciones abiertas", open.data],
      ["cerradas hoy", closedToday.data],
    ] as const) {
      if ((rows?.length ?? 0) >= CHECK_IN_KPI_ROW_LIMIT) {
        console.warn(
          "[CheckInService] Indicadores truncados: la consulta llegó al límite de filas",
          { query, limit: CHECK_IN_KPI_ROW_LIMIT },
        );
      }
    }

    const rows = [...(open.data ?? []), ...(closedToday.data ?? [])];
    return checkInKpis(
      rows.map((row: any) => ({
        status: row.status,
        endDate: row.order_fecha_termino,
      })),
      now,
    );
  }
}
