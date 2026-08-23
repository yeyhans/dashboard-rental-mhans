import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle2, Clock, Package, Search } from 'lucide-react';
import {
  checkInTotals,
  itemsFromLineItems,
  type ItemReceiptState,
  type ReturnUrgency,
} from '../../lib/checkIn';
import { statusBadgeClass, statusLabel } from '../../lib/orderStatus';
import { apiClient } from '../../services/apiClient';
import type { CheckInBoard as CheckInBoardData, CheckInListEntry } from '../../services/checkInService';

/**
 * Check-In / Devoluciones.
 *
 * Estructura del canónico `MarioHans_OS_Area01_CheckIn_Devoluciones_Canonical_RC2.1.2.html`:
 * `.kpi-strip` de cuatro indicadores, y debajo un `.content-split` con la lista de devoluciones a
 * la izquierda y el detalle del pedido seleccionado a la derecha, que arranca vacío.
 *
 * T-026 (2026-08-23, cableado de UI): cada línea ahora puede registrar el check-in de un equipo
 * SERIALIZADO puntual contra `POST /api/inventory/movements` (`AssetMovementService`,
 * `validateMovementTransition`). Esto NO reemplaza el estado `pending/received/incomplete/damaged`
 * por línea del canónico — ese campo sigue sin existir en `orders.line_items` — sino que registra
 * el evento de auditoría real que el esquema SÍ sostiene: qué unidad con número de serie volvió,
 * de qué orden, y quién lo recibió (`checked_by_admin_id`, resuelto server-side). El control
 * exige elegir el número de serie exacto porque no hay ninguna tabla que asocie "estas unidades
 * fueron las que salieron con esta orden" — ver el header de `lib/assetMovements.ts`. Un 409 del
 * endpoint ("El equipo no tiene un checkout abierto para hacer check-in") es una respuesta real y
 * esperable mientras el flujo de despacho no registre el checkout correspondiente; se muestra tal
 * cual, en español, no como un error genérico.
 */
interface CheckInBoardProps {
  data: CheckInBoardData;
  /** Fecha de la cabecera. Se inyecta desde el servidor para no depender del reloj del cliente. */
  todayLabel: string;
}

const URGENCY_STYLES: Record<ReturnUrgency, { label: string; className: string }> = {
  late: { label: 'Atrasado', className: 'text-[var(--color-crit)] font-semibold' },
  urgent: { label: 'Hoy', className: 'text-[var(--color-warn)] font-semibold' },
  soon: { label: 'Próximo', className: 'text-[var(--color-info)]' },
  scheduled: { label: 'Agendado', className: 'text-[var(--color-text-secondary)]' },
  done: { label: 'Completado', className: 'text-[var(--color-ok)]' },
};

const ITEM_FILTERS: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'todos', label: 'Todos' },
  { value: 'pending', label: 'Pendientes' },
  { value: 'received', label: 'Recibidos' },
  { value: 'incidencias', label: 'Incidencias' },
];

function pad2(value: number): string {
  return String(value).padStart(2, '0');
}

interface AssetOption {
  id: number;
  serial_number: string;
}

/**
 * Búsqueda de número de serie + registro de check-in para UNA línea del pedido.
 *
 * Vive fuera de `CheckInBoard` porque cada línea necesita su propio estado de
 * búsqueda/selección/envío, y montarlo condicionalmente en el detalle evita pedir la lista de
 * equipos de un producto que el admin nunca abre.
 */
function AssetCheckInControl({ productId, orderId }: { productId: number; orderId: number }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AssetOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | ''>('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null);

  const loadOptions = async () => {
    setOpen(true);
    if (options !== null) return;
    setLoadingOptions(true);
    try {
      const response = await apiClient.get(`/api/inventory/assets?product_id=${productId}`);
      const payload = await apiClient.handleJsonResponse<{
        success: boolean;
        data: { assets: AssetOption[] };
      }>(response);
      setOptions(payload.data.assets);
    } catch {
      setOptions([]);
    } finally {
      setLoadingOptions(false);
    }
  };

  const handleCheckIn = async () => {
    if (!selectedAssetId) {
      toast.error('Selecciona un número de serie');
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const response = await apiClient.post('/api/inventory/movements', {
        asset_id: selectedAssetId,
        order_id: orderId,
        direction: 'checkin',
        condition_notes: notes.trim() || undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setResult({ ok: false, message: payload.error || 'No se pudo registrar el check-in' });
        return;
      }
      setResult({ ok: true, message: 'Check-in registrado' });
      toast.success('Check-in registrado');
    } catch (error) {
      setResult({ ok: false, message: error instanceof Error ? error.message : 'Error de conexión' });
    } finally {
      setSubmitting(false);
    }
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={loadOptions}
        className="whitespace-nowrap rounded-full border border-[var(--color-border)] px-2 py-0.5 text-[10px] text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
      >
        Registrar check-in
      </button>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      <select
        value={selectedAssetId}
        onChange={e => setSelectedAssetId(e.target.value ? Number(e.target.value) : '')}
        disabled={loadingOptions || (options?.length ?? 0) === 0}
        aria-label="Número de serie"
        className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
      >
        <option value="">
          {loadingOptions ? 'Cargando…' : options?.length ? 'Elige el número de serie' : 'Sin equipos registrados'}
        </option>
        {(options ?? []).map(asset => (
          <option key={asset.id} value={asset.id}>
            {asset.serial_number}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Notas (opcional)"
        aria-label="Notas del check-in"
        className="w-28 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
      />
      <button
        type="button"
        onClick={handleCheckIn}
        disabled={submitting || !selectedAssetId}
        className="rounded-[6px] bg-[var(--color-text-primary)] px-2 py-1 text-[11px] font-medium text-white disabled:opacity-50"
      >
        {submitting ? 'Guardando…' : 'Confirmar'}
      </button>
      {result && (
        <span
          className={`text-[11px] ${result.ok ? 'text-[var(--color-ok)]' : 'text-[var(--color-crit)]'}`}
          role="status"
        >
          {result.message}
        </span>
      )}
    </div>
  );
}

export default function CheckInBoard({ data, todayLabel }: CheckInBoardProps) {
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [itemFilter, setItemFilter] = useState('todos');

  const visible = useMemo(() => {
    const needle = search.trim().toLowerCase();
    if (!needle) return data.entries;
    return data.entries.filter(
      e =>
        e.reference.toLowerCase().includes(needle) ||
        e.client.toLowerCase().includes(needle) ||
        e.project.toLowerCase().includes(needle)
    );
  }, [data.entries, search]);

  const selected: CheckInListEntry | null =
    data.entries.find(e => e.id === selectedId) ?? null;

  const items = useMemo(() => itemsFromLineItems(selected?.lineItems), [selected]);
  const totals = useMemo(() => checkInTotals(items), [items]);

  const filteredItems = items.filter(item => {
    if (itemFilter === 'todos') return true;
    if (itemFilter === 'incidencias') return item.state === 'damaged' || item.state === 'incomplete';
    return item.state === (itemFilter as ItemReceiptState);
  });

  const kpiCards = [
    { key: 'pend', icon: Clock, label: 'Pendientes Hoy', value: data.kpis.pendientesHoy, meta: 'Por recibir', tone: '' },
    { key: 'rec', icon: CheckCircle2, label: 'Recibidos Hoy', value: data.kpis.recibidosHoy, meta: 'Completados', tone: 'text-[var(--color-ok)]' },
    { key: 'inc', icon: AlertTriangle, label: 'Incidencias', value: data.kpis.incidencias, meta: 'Requieren acción', tone: 'text-[var(--color-crit)]' },
    { key: 'atr', icon: AlertTriangle, label: 'Devoluciones Atrasadas', value: data.kpis.atrasadas, meta: 'Fuera de hora', tone: 'text-[var(--color-warn)]' },
  ];

  return (
    <div>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map(({ key, icon: Icon, label, value, meta, tone }) => (
          <div
            key={key}
            className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
          >
            <div className="mb-2 flex items-center gap-2">
              <Icon className={`h-4 w-4 ${tone || 'text-[var(--color-text-secondary)]'}`} aria-hidden="true" />
              <span className="text-xs text-[var(--color-text-secondary)]">{label}</span>
            </div>
            <div className={`font-mono text-2xl font-semibold ${tone}`}>{pad2(value)}</div>
            <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">{meta}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section
          className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
          aria-label="Devoluciones"
        >
          <div className="border-b border-[var(--color-border)] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">Devoluciones</h2>
              <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {visible.length} {visible.length === 1 ? 'pedido' : 'pedidos'}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">{todayLabel}</p>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar pedido o cliente"
                aria-label="Buscar pedido o cliente"
                className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
              />
            </div>
          </div>

          <ul className="max-h-[560px] overflow-y-auto">
            {visible.length === 0 && (
              <li className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
                {search ? 'Ningún pedido coincide con la búsqueda.' : 'No hay devoluciones pendientes.'}
              </li>
            )}
            {visible.map(entry => {
              const urgency = URGENCY_STYLES[entry.urgency];
              const isSelected = entry.id === selectedId;
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    aria-current={isSelected ? 'true' : undefined}
                    className={`w-full border-b border-[var(--color-border-soft)] p-3 text-left transition-colors hover:bg-[var(--color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-text-primary)] ${
                      isSelected ? 'bg-[var(--color-surface-2)]' : ''
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {entry.reference}
                      </span>
                      <span className={`text-[11px] ${urgency.className}`}>{urgency.label}</span>
                    </div>
                    <div className="mt-1 truncate text-xs font-medium">{entry.client}</div>
                    <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
                      {entry.project}
                    </div>
                    <div className="mt-1.5 flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadgeClass(entry.status)}`}>
                        {statusLabel(entry.status)}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-faint)]">
                        {entry.itemCount} {entry.itemCount === 1 ? 'equipo' : 'equipos'}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section
          className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
          aria-label="Detalle de la devolución"
        >
          {!selected ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
              <Package className="h-8 w-8 text-[var(--color-text-faint)]" aria-hidden="true" />
              <p className="text-xs text-[var(--color-text-secondary)]">
                Selecciona un pedido para revisar los equipos.
              </p>
            </div>
          ) : (
            <div>
              <div className="border-b border-[var(--color-border)] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                      {selected.reference}
                    </div>
                    <h2 className="truncate text-sm font-semibold">{selected.client}</h2>
                    <p className="truncate text-xs text-[var(--color-text-secondary)]">
                      Proyecto: {selected.project}
                    </p>
                    <p className="text-xs text-[var(--color-text-secondary)]">
                      Término del arriendo: {selected.endDate ?? 'sin fecha'}
                    </p>
                  </div>
                  <a
                    href={`/orders/${selected.id}`}
                    className="whitespace-nowrap text-xs text-[var(--color-text-primary)] underline underline-offset-2"
                  >
                    Ver pedido →
                  </a>
                </div>

                <div className="mt-4 grid grid-cols-5 gap-2">
                  {[
                    { label: 'Total', value: totals.total, tone: '' },
                    { label: 'Recibidos', value: totals.recibidos, tone: 'text-[var(--color-ok)]' },
                    { label: 'Incompletos', value: totals.incompletos, tone: 'text-[var(--color-warn)]' },
                    { label: 'Dañados', value: totals.danados, tone: 'text-[var(--color-crit)]' },
                    { label: 'Pendientes', value: totals.pendientes, tone: 'text-[var(--color-text-secondary)]' },
                  ].map(metric => (
                    <div key={metric.label} className="rounded-[6px] bg-[var(--color-surface-2)] p-2 text-center">
                      <div className={`font-mono text-base font-semibold ${metric.tone}`}>{metric.value}</div>
                      <div className="text-[10px] text-[var(--color-text-faint)]">{metric.label}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex flex-wrap gap-1 border-b border-[var(--color-border)] px-4 py-2">
                {ITEM_FILTERS.map(filter => (
                  <button
                    key={filter.value}
                    type="button"
                    onClick={() => setItemFilter(filter.value)}
                    className={`rounded-full px-2.5 py-1 text-[11px] transition-colors ${
                      itemFilter === filter.value
                        ? 'bg-[var(--color-text-primary)] text-white'
                        : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]'
                    }`}
                  >
                    {filter.label}
                  </button>
                ))}
              </div>

              <ul className="max-h-[300px] overflow-y-auto">
                {filteredItems.length === 0 && (
                  <li className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
                    Este pedido no tiene equipos en esa categoría.
                  </li>
                )}
                {filteredItems.map((item, index) => (
                  <li
                    key={`${item.sku}-${index}`}
                    className="flex items-start justify-between gap-3 border-b border-[var(--color-border-soft)] px-4 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="truncate text-xs font-medium">{item.name}</div>
                      <div className="font-mono text-[10px] text-[var(--color-text-faint)]">{item.sku}</div>
                      {item.productId !== null && selected && (
                        <AssetCheckInControl productId={item.productId} orderId={selected.id} />
                      )}
                    </div>
                    <span className="whitespace-nowrap font-mono text-xs text-[var(--color-text-secondary)]">
                      ×{item.quantity}
                    </span>
                  </li>
                ))}
              </ul>

              <p className="border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                "Registrar check-in" busca el número de serie exacto del equipo y registra su
                devolución en el historial de movimientos. El estado{' '}
                <strong>pendiente/recibido/incompleto/dañado</strong> por línea del canónico
                todavía no se guarda: <code>orders.line_items</code> es un jsonb sin ese campo, y
                asociar automáticamente qué unidades salieron con este pedido requeriría una
                tabla que hoy no existe. Si el equipo elegido no tiene un checkout abierto en el
                sistema, el check-in se rechaza con un aviso explícito en vez de fallar en
                silencio.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
