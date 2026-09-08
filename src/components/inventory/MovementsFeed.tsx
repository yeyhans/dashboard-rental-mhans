import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeftRight, Loader2, RefreshCw } from 'lucide-react';
import { DIRECTION_LABELS, hasActiveFilters, isLatestRequest } from '../../lib/movementsFeed';
import { formatBusinessDateTime } from '../../lib/businessDay';
import { apiClient } from '../../services/apiClient';
import type { FeedMovement, MovementsFeed as MovementsFeedData } from '../../services/assetMovementService';
import type { MovementDirection } from '../../types/assetMovements';
import { Badge } from '../ui/badge';
import { Button } from '../ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '../ui/table';

/**
 * Movimientos — the admin's window onto the garage (batch 3).
 *
 * Polls `GET /api/inventory/movements` every 30 s with the current filters, replacing the table
 * wholesale (no merge: the server orders and dedupes, the client displays). The interval is
 * cleared on unmount and skipped while the tab is hidden — a dashboard left open on a second
 * monitor should not hammer the API for nobody. No Supabase Realtime: `asset_movements` has no
 * grant to `anon` by design.
 *
 * KPIs are unfiltered on purpose ("units out now" is about the whole garage); only the table
 * follows the filter bar. Muted Área 01 tones throughout; `Atrasada` is a warning, not an alarm.
 */
interface MovementsFeedProps {
  initialFeed: MovementsFeedData;
}

export const POLL_INTERVAL_MS = 30_000;

const DIRECTION_BADGE: Record<MovementDirection, string> = {
  checkout: 'border-transparent bg-[var(--color-info-bg)] text-[var(--color-info)]',
  checkin: 'border-transparent bg-[var(--color-ok-bg)] text-[var(--color-ok)]',
};

interface Filters {
  direction: '' | MovementDirection;
  adminId: string;
  from: string;
  to: string;
}

const EMPTY_FILTERS: Filters = { direction: '', adminId: '', from: '', to: '' };

/** `YYYY-MM-DD` (local) → ISO instant at local midnight; `to` is exclusive so it takes the next day. */
function dayToInstant(day: string, endOfRange: boolean): string | null {
  if (!day) return null;
  const [y, m, d] = day.split('-').map(Number);
  if (!y || !m || !d) return null;
  const date = new Date(y, m - 1, d + (endOfRange ? 1 : 0));
  return date.toISOString();
}

function buildQuery(filters: Filters): string {
  const params = new URLSearchParams();
  if (filters.direction) params.set('direction', filters.direction);
  if (filters.adminId) params.set('admin_id', filters.adminId);
  const since = dayToInstant(filters.from, false);
  const until = dayToInstant(filters.to, true);
  if (since) params.set('since', since);
  if (until) params.set('until', until);
  const query = params.toString();
  return query ? `?${query}` : '';
}

export default function MovementsFeed({ initialFeed }: MovementsFeedProps) {
  const [feed, setFeed] = useState<MovementsFeedData>(initialFeed);
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const filtersRef = useRef(filters);
  filtersRef.current = filters;

  // R4-102: every request takes a sequence number; only the latest one may apply its response,
  // so a slow poll cannot overwrite a newer filter change. `inFlight` lets the poll skip a tick.
  const seqRef = useRef(0);
  const inFlightRef = useRef(false);

  const load = useCallback(async () => {
    const seq = ++seqRef.current;
    inFlightRef.current = true;
    setLoading(true);
    try {
      const response = await apiClient.get(`/api/inventory/movements${buildQuery(filtersRef.current)}`);
      const result = await response.json();
      if (!isLatestRequest(seq, seqRef.current)) return;
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudieron cargar los movimientos');
      }
      setFeed(result.data);
      setError(null);
    } catch (err) {
      if (!isLatestRequest(seq, seqRef.current)) return;
      setError(err instanceof Error ? err.message : 'No se pudieron cargar los movimientos');
    } finally {
      if (isLatestRequest(seq, seqRef.current)) {
        inFlightRef.current = false;
        setLoading(false);
      }
    }
  }, []);

  // Refetch when the filters change (after the first render, which is server data).
  const firstRender = useRef(true);
  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }
    void load();
  }, [filters, load]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.hidden || inFlightRef.current) return;
      void load();
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const operatorOptions = feed.operators;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <Kpi label="Unidades afuera" value={feed.kpis.unitsOutNow} tone="info" />
        <Kpi label="Atrasadas" value={feed.kpis.unitsOverdue} tone={feed.kpis.unitsOverdue > 0 ? 'warn' : 'neutral'} />
        <Kpi label="Movimientos hoy" value={feed.kpis.movementsToday} tone="neutral" />
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-[10px] border border-border p-3">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Dirección
          <select
            value={filters.direction}
            onChange={(event) => setFilters((prev) => ({ ...prev, direction: event.target.value as Filters['direction'] }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">Todas</option>
            <option value="checkout">{DIRECTION_LABELS.checkout}</option>
            <option value="checkin">{DIRECTION_LABELS.checkin}</option>
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Operario
          <select
            value={filters.adminId}
            onChange={(event) => setFilters((prev) => ({ ...prev, adminId: event.target.value }))}
            className="h-9 min-w-[10rem] rounded-md border border-input bg-background px-2 text-sm text-foreground"
          >
            <option value="">Todos</option>
            {operatorOptions.map((operator) => (
              <option key={operator.id} value={String(operator.id)}>
                {operator.email}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Desde
          <input
            type="date"
            value={filters.from}
            onChange={(event) => setFilters((prev) => ({ ...prev, from: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Hasta
          <input
            type="date"
            value={filters.to}
            onChange={(event) => setFilters((prev) => ({ ...prev, to: event.target.value }))}
            className="h-9 rounded-md border border-input bg-background px-2 text-sm text-foreground"
          />
        </label>
        <div className="ml-auto flex items-center gap-2">
          {hasActiveFilters(filters) && (
            <Button variant="ghost" size="sm" onClick={() => setFilters(EMPTY_FILTERS)}>
              Limpiar
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading} aria-label="Actualizar">
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          </Button>
        </div>
      </div>

      {error && (
        <div role="alert" className="flex items-center justify-between gap-3 rounded-[10px] border border-[var(--color-crit)] bg-[var(--color-crit-bg)] p-3 text-sm text-[var(--color-crit)]">
          <span>{error}</span>
          <Button variant="outline" size="sm" onClick={() => void load()}>
            Reintentar
          </Button>
        </div>
      )}

      {feed.movements.length === 0 ? (
        <div className="rounded-[10px] border border-border py-12 text-center text-muted-foreground">
          <ArrowLeftRight className="mx-auto mb-3 h-10 w-10 opacity-40" />
          <p>No hay movimientos con estos filtros.</p>
          <p className="mt-1 text-sm">Los escaneos de bodega aparecen aquí en cuanto se registran.</p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[10px] border border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Hora</TableHead>
                <TableHead>Dirección</TableHead>
                <TableHead>Asset tag</TableHead>
                <TableHead>Serie</TableHead>
                <TableHead>Modelo</TableHead>
                <TableHead>Orden</TableHead>
                <TableHead>Operario</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {feed.movements.map((movement) => (
                <FeedRow key={movement.id} movement={movement} />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Actualizado {formatBusinessDateTime(feed.generatedAt)} · se refresca cada {POLL_INTERVAL_MS / 1000} s
      </p>
    </div>
  );
}

function FeedRow({ movement }: { movement: FeedMovement }) {
  return (
    <TableRow>
      <TableCell className="whitespace-nowrap tabular-nums">{formatBusinessDateTime(movement.checked_at)}</TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Badge className={DIRECTION_BADGE[movement.direction]}>{DIRECTION_LABELS[movement.direction]}</Badge>
          {movement.overdue && (
            <Badge className="border-transparent bg-[var(--color-warn-bg)] text-[var(--color-warn)]">Atrasada</Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="font-mono">{movement.asset?.asset_tag ?? '—'}</TableCell>
      <TableCell className="font-mono text-muted-foreground">{movement.asset?.serial_number ?? '—'}</TableCell>
      <TableCell>{movement.product?.name ?? '—'}</TableCell>
      <TableCell>
        {movement.order ? (
          <a href={`/orders/${movement.order.id}`} className="underline-offset-2 hover:underline">
            #{movement.order.id} · {movement.order.client}
          </a>
        ) : (
          '—'
        )}
      </TableCell>
      <TableCell className="text-muted-foreground">{movement.operator?.email ?? '—'}</TableCell>
    </TableRow>
  );
}

function Kpi({ label, value, tone }: { label: string; value: number; tone: 'info' | 'warn' | 'neutral' }) {
  const color = tone === 'info' ? 'text-[var(--color-info)]' : tone === 'warn' ? 'text-[var(--color-warn)]' : 'text-foreground';
  return (
    <div className="rounded-[10px] border border-border bg-background p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tabular-nums ${color}`}>{value}</p>
    </div>
  );
}
