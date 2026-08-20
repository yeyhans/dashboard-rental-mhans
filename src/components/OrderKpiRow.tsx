import React from 'react';
import { ArrowUp, ArrowDown, RotateCcw, Paperclip } from 'lucide-react';
import type { OperationalKpis } from '../services/dashboardService';

/**
 * `.kpi-row` de la pantalla canónica de Pedidos
 * (`Área 01 · Rental Técnico/OFF/MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html`).
 *
 * Cuatro tarjetas, cada una un enlace que filtra la lista por una pestaña. El canónico las marca
 * con `data-action="filter-tab" data-tab="…"`, así que no son solo indicadores: son la vía rápida
 * para saltar a la cola de trabajo del día.
 *
 * Los iconos siguen los `<use href="#i-…">` del canónico: `i-up` para retiros (sale de bodega),
 * `i-down` para entregas, `i-rotate` para devoluciones, `i-clip` para el total activo.
 */
interface OrderKpiRowProps {
  kpis: OperationalKpis;
  /** Salta a una pestaña de la lista. Recibe el `data-tab` del canónico. */
  onSelectTab: (tab: string) => void;
}

export default function OrderKpiRow({ kpis, onSelectTab }: OrderKpiRowProps) {
  const cards = [
    { tab: 'preparation', icon: ArrowUp, label: 'Retiros Hoy', value: kpis.retirosHoy, meta: 'Programados' },
    { tab: 'in-rental', icon: ArrowDown, label: 'Entregas Hoy', value: kpis.entregasHoy, meta: 'Programadas' },
    { tab: 'return', icon: RotateCcw, label: 'Devoluciones Hoy', value: kpis.devolucionesHoy, meta: 'Programadas' },
    { tab: 'todos', icon: Paperclip, label: 'Pedidos Activos', value: kpis.pedidosActivos, meta: 'En operación' },
  ];

  return (
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
      {cards.map(({ tab, icon: Icon, label, value, meta }) => (
        <button
          key={tab}
          type="button"
          onClick={() => onSelectTab(tab)}
          className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4 text-left transition-colors hover:bg-[var(--color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)] focus-visible:ring-offset-2"
        >
          <div className="mb-2 flex items-center gap-2">
            <Icon className="h-4 w-4 text-[var(--color-text-secondary)]" aria-hidden="true" />
            <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
          </div>
          {/* El canónico rellena a dos dígitos ("05"), en la mono del sistema. */}
          <div className="font-mono text-2xl font-semibold text-[var(--color-text-primary)]">
            {String(value).padStart(2, '0')}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-secondary)]">{meta} →</div>
        </button>
      ))}
    </div>
  );
}
