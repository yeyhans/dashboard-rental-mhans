import React, { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, ChevronRight, Loader2, RefreshCw } from 'lucide-react';
import { formatDay, type BodegaBoard as BodegaBoardData, type BodegaCard } from '../../lib/bodega';
import { apiClient } from '../../services/apiClient';

/**
 * The garage board: Retiros (leaving today or tomorrow) and Devoluciones (due back today or
 * overdue). Each card is one big link to the order's scan screen — the whole card is the tap
 * target, because the worker is holding a phone in one hand and a gun in the other.
 *
 * Server-rendered, then refreshed on demand through `/api/bodega/board`; no polling here — the
 * worker refreshes when they come back to the phone, and the scan screen is where time is spent.
 */
interface BodegaBoardProps {
  initialBoard: BodegaBoardData;
  todayLabel: string;
}

export default function BodegaBoard({ initialBoard, todayLabel }: BodegaBoardProps) {
  const [board, setBoard] = useState<BodegaBoardData>(initialBoard);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = async () => {
    setRefreshing(true);
    setError(null);
    try {
      const response = await apiClient.get('/api/bodega/board');
      const result = await response.json();
      if (!response.ok || !result.success) {
        throw new Error(result.error || 'No se pudo actualizar el tablero');
      }
      setBoard(result.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se pudo actualizar el tablero');
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold capitalize">{todayLabel}</h1>
          <p className="text-sm text-[var(--color-text-secondary)]">Toca una orden para escanear</p>
        </div>
        <button
          type="button"
          onClick={() => void refresh()}
          disabled={refreshing}
          className="inline-flex min-h-[44px] items-center gap-2 rounded-[10px] border border-[var(--color-border)] bg-white px-4 text-sm font-medium disabled:opacity-60"
          aria-label="Actualizar tablero"
        >
          {refreshing ? <Loader2 className="h-5 w-5 animate-spin" /> : <RefreshCw className="h-5 w-5" />}
          <span className="hidden sm:inline">Actualizar</span>
        </button>
      </div>

      {error && (
        <p role="alert" className="rounded-[10px] border border-[var(--color-crit)] bg-[var(--color-crit-bg)] p-3 text-sm text-[var(--color-crit)]">
          {error}
        </p>
      )}

      <BoardSection
        title="Retiros"
        icon={<ArrowUpFromLine className="h-5 w-5" />}
        cards={board.pickups}
        empty="No hay retiros para hoy ni mañana."
      />
      <BoardSection
        title="Devoluciones"
        icon={<ArrowDownToLine className="h-5 w-5" />}
        cards={board.returns}
        empty="No hay devoluciones pendientes."
      />
    </div>
  );
}

interface BoardSectionProps {
  title: string;
  icon: React.ReactNode;
  cards: BodegaCard[];
  empty: string;
}

function BoardSection({ title, icon, cards, empty }: BoardSectionProps) {
  return (
    <section aria-labelledby={`bodega-${title}`}>
      <h2 id={`bodega-${title}`} className="mb-2 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
        {icon}
        {title}
        <span className="ml-auto rounded-full bg-[var(--color-neutral-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-neutral)]">
          {cards.length}
        </span>
      </h2>
      {cards.length === 0 ? (
        <p className="rounded-[10px] border border-dashed border-[var(--color-border)] p-4 text-center text-sm text-[var(--color-text-secondary)]">
          {empty}
        </p>
      ) : (
        <ul className="space-y-2">
          {cards.map((card) => (
            <li key={card.orderId}>
              <OrderCard card={card} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function OrderCard({ card }: { card: BodegaCard }) {
  const complete = card.totalUnits > 0 && card.scannedUnits >= card.totalUnits;
  return (
    <a
      href={`/bodega/orden/${card.orderId}`}
      className="flex items-center gap-3 rounded-[10px] border border-[var(--color-border)] bg-white p-4 active:bg-[var(--color-surface-2)]"
    >
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-semibold">{card.reference}</span>
          {card.overdue && (
            <span className="rounded-full bg-[var(--color-warn-bg)] px-2 py-0.5 text-xs font-medium text-[var(--color-warn)]">
              Atrasada
            </span>
          )}
        </div>
        <p className="truncate text-sm">{card.client}</p>
        <p className="truncate text-sm text-[var(--color-text-secondary)]">{card.project}</p>
        <p className="mt-1 text-xs text-[var(--color-text-secondary)]">
          {formatDay(card.startDate)} → {formatDay(card.endDate)}
        </p>
      </div>
      <div className="text-right">
        <p className={`text-lg font-semibold tabular-nums ${complete ? 'text-[var(--color-ok)]' : ''}`}>
          {card.scannedUnits}/{card.totalUnits}
        </p>
        <p className="text-xs text-[var(--color-text-secondary)]">unidades</p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-[var(--color-text-secondary)]" />
    </a>
  );
}
