import React, { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Loader2, Pencil, Plus, Search, Trash2, Truck } from 'lucide-react';
import { itemsFromLineItems } from '../../lib/checkIn';
import { SHIPMENT_STATUSES, formatCLP, shipmentLabel } from '../../lib/delivery';
import {
  shippingMethodDeleteWarning,
  shippingMethodFromRecord,
  shippingMethodPayload,
  shippingTypeLabel,
  type ShippingMethodForm,
  type StoredShippingMethod,
} from '../../lib/shippingMethods';
import { apiClient } from '../../services/apiClient';
import { ConfirmDialog, ShippingTypeDialog } from './ShippingTypeDialog';
import type { DeliveryBoard as DeliveryBoardData, ShipmentRow } from '../../services/deliveryService';

/**
 * Delivery.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Delivery_Canonical_RC2.1.3.html`: fila de
 * indicadores, tabla de delivery activos, tabla de tipos de envío, e historial con filtros y una
 * fila de totales.
 *
 * Dos columnas del canónico no se muestran: **Conductor** y **Pago Delivery**. `shipping_usage`
 * tiene doce columnas y ninguna de las dos existe; solo hay un `metadata` jsonb sin forma
 * acordada. Una columna inventada se vería vacía para siempre y se leería como datos faltantes en
 * vez de una función faltante, así que se omiten y queda constancia.
 *
 * T-026 gap 2/4 (cierre de brecha, 2026-08-23): antes de este cambio ningún camino de código
 * registraba un movimiento `checkout` en `asset_movements`, así que el control de Check-In recién
 * cableado (`CheckInBoard.tsx`) siempre devolvía 409 "no hay checkout abierto" — el módulo no era
 * usable de punta a punta. Decisión: el checkout se registra aquí, en Delivery, no en el detalle
 * de la orden. Evidencia canónica: `MarioHans_OS_Area01_Pedidos_Canonical_RC2.1.2.html` declara la
 * acción explícitamente — el botón primario del estado `preparacion` es
 * `'Registrar entrega / Check-Out'` (línea ~1230, `act:{a:'change-estado',s:'arriendo'}`, nota
 * "Verifica el kit completo antes de registrar la salida"), y su historial de ejemplo registra
 * `'Entrega registrada · Check-out 6 equipos'`. El canónico de Delivery no tiene un botón propio
 * de check-out — expone despacho/tipo de envío/historial — así que Delivery es el LUGAR (el
 * equipo sale físicamente durante el despacho) y el control reutiliza el patrón de
 * `AssetCheckInControl` de `CheckInBoard.tsx`, solo que con `direction: 'checkout'` contra el
 * mismo `POST /api/inventory/movements`. No se duplica ninguna regla de transición ni string de
 * error: `validateMovementTransition`/`MOVEMENT_TRANSITION_ERRORS` en `lib/assetMovements.ts` ya
 * cubren checkout de forma genérica (`assetMovements.test.ts` ya los prueba con ambas
 * direcciones) — este componente solo le da una vía de entrada real.
 */
interface DeliveryBoardProps {
  data: DeliveryBoardData;
}

interface AssetOption {
  id: number;
  serial_number: string;
}

/**
 * Búsqueda de número de serie + registro de checkout para UNA línea del pedido en despacho.
 * Espejo de `AssetCheckInControl` (`CheckInBoard.tsx`), con `direction: 'checkout'`. Vive fuera de
 * `ShipmentTableRow` por la misma razón: cada línea necesita su propio estado de
 * búsqueda/selección/envío.
 */
function AssetCheckOutControl({ productId, orderId }: { productId: number; orderId: number }) {
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

  const handleCheckOut = async () => {
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
        direction: 'checkout',
        condition_notes: notes.trim() || undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setResult({ ok: false, message: payload.error || 'No se pudo registrar la salida' });
        return;
      }
      setResult({ ok: true, message: 'Salida registrada' });
      toast.success('Salida registrada');
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
        Registrar salida
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
        aria-label="Notas de la salida"
        className="w-28 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
      />
      <button
        type="button"
        onClick={handleCheckOut}
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

const STATUS_TONES: Record<string, string> = {
  pending: 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]',
  processing: 'bg-[var(--color-warn-bg)] text-[var(--color-warn)]',
  shipped: 'bg-[var(--color-info-bg)] text-[var(--color-info)]',
  delivered: 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]',
  cancelled: 'bg-[var(--color-neutral-bg)] text-[var(--color-muted)]',
};

function statusPill(status: string): string {
  return STATUS_TONES[status] ?? 'bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]';
}

function formatDay(value: string | null): string {
  if (!value) return '—';
  const [y, m, d] = value.slice(0, 10).split('-');
  return `${d}/${m}/${y}`;
}

/** El servidor entrega los tipos ordenados por nombre; un alta local mantiene ese orden. */
function byName(a: StoredShippingMethod, b: StoredShippingMethod): number {
  return a.name.localeCompare(b.name, 'es');
}

async function requestJson(url: string, init: RequestInit): Promise<any> {
  // Los endpoints exigen sesión de admin (`withAuth`), que se resuelve por cookie.
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    credentials: 'include',
    ...init,
  });
  const payload = await response.json().catch(() => null);

  if (!response.ok) {
    // El endpoint responde `{ error, details }`; `details` puede traer el mensaje crudo de
    // Postgres, así que solo se muestra `error`.
    throw new Error(payload?.error ?? 'No se pudo completar la operación');
  }

  return payload;
}

export default function DeliveryBoard({ data }: DeliveryBoardProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('todos');
  const [typeFilter, setTypeFilter] = useState('todos');

  const [types, setTypes] = useState<StoredShippingMethod[]>(data.types);
  const [editing, setEditing] = useState<StoredShippingMethod | 'new' | null>(null);
  const [deleting, setDeleting] = useState<StoredShippingMethod | null>(null);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [feedback, setFeedback] = useState<{ tone: 'ok' | 'crit'; message: string } | null>(null);

  /**
   * El filtro se indexa por `id` y no por nombre: `shipping_methods.name` no tiene UNIQUE, así que
   * dos métodos homónimos colapsarían en una sola opción y renombrar uno con el filtro activo
   * dejaría el historial vacío sin explicar por qué.
   */
  function keepTypeFilterValid(next: StoredShippingMethod[]) {
    setTypeFilter(current =>
      current === 'todos' || next.some(type => String(type.id) === current) ? current : 'todos'
    );
  }

  async function handleSubmitType(form: ShippingMethodForm) {
    if (editing === null) return;

    const isNew = editing === 'new';
    setSaving(true);
    setFeedback(null);

    try {
      const saved = shippingMethodFromRecord(
        await requestJson(
          isNew ? '/api/shipping/methods' : `/api/shipping/methods/${editing.id}`,
          { method: isNew ? 'POST' : 'PUT', body: JSON.stringify(shippingMethodPayload(form)) }
        )
      );

      setTypes(prev => {
        const next = isNew
          ? [...prev, saved].sort(byName)
          : prev.map(type => (type.id === saved.id ? saved : type));
        keepTypeFilterValid(next);
        return next;
      });

      setEditing(null);
      setFeedback({
        tone: 'ok',
        message: isNew ? 'Tipo de envío creado.' : 'Tipo de envío actualizado.',
      });
    } catch (error) {
      setFeedback({
        tone: 'crit',
        message: error instanceof Error ? error.message : 'No se pudo guardar el tipo de envío',
      });
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleType(type: StoredShippingMethod) {
    setBusyId(type.id);
    setFeedback(null);

    try {
      // Solo viaja `enabled`: mandar el registro completo reescribiría campos que nadie tocó.
      const saved = shippingMethodFromRecord(
        await requestJson(`/api/shipping/methods/${type.id}`, {
          method: 'PUT',
          body: JSON.stringify({ enabled: !type.enabled }),
        })
      );

      setTypes(prev => prev.map(item => (item.id === saved.id ? saved : item)));
      setFeedback({
        tone: 'ok',
        message: saved.enabled ? `"${saved.name}" quedó activo.` : `"${saved.name}" quedó inactivo.`,
      });
    } catch (error) {
      setFeedback({
        tone: 'crit',
        message: error instanceof Error ? error.message : 'No se pudo cambiar el estado',
      });
    } finally {
      setBusyId(null);
    }
  }

  async function handleDeleteType() {
    if (!deleting) return;

    setBusyId(deleting.id);
    setFeedback(null);

    try {
      await requestJson(`/api/shipping/methods/${deleting.id}`, { method: 'DELETE' });

      setTypes(prev => {
        const next = prev.filter(type => type.id !== deleting.id);
        keepTypeFilterValid(next);
        return next;
      });

      setFeedback({ tone: 'ok', message: `"${deleting.name}" fue eliminado.` });
      setDeleting(null);
    } catch (error) {
      setFeedback({
        tone: 'crit',
        message: error instanceof Error ? error.message : 'No se pudo eliminar el tipo de envío',
      });
    } finally {
      setBusyId(null);
    }
  }

  const history = useMemo(() => {
    const needle = search.trim().toLowerCase();
    return data.history.filter(row => {
      if (statusFilter !== 'todos' && row.status !== statusFilter) return false;
      if (typeFilter !== 'todos' && String(row.methodId) !== typeFilter) return false;
      if (!needle) return true;
      return (
        row.orderReference.toLowerCase().includes(needle) ||
        row.client.toLowerCase().includes(needle) ||
        (row.trackingNumber ?? '').toLowerCase().includes(needle)
      );
    });
  }, [data.history, search, statusFilter, typeFilter]);

  const variacion =
    data.kpis.variacionDiaria === null
      ? 'sin referencia'
      : `${data.kpis.variacionDiaria >= 0 ? '↑' : '↓'} ${Math.abs(data.kpis.variacionDiaria)}% vs ayer`;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Envíos Hoy</div>
          <div className="font-mono text-2xl font-semibold">{data.kpis.enviosHoy}</div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">{variacion}</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Por Despachar</div>
          <div className="font-mono text-2xl font-semibold text-[var(--color-warn)]">
            {data.kpis.porDespachar}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">Pendientes de salida</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="text-xs text-[var(--color-text-secondary)]">Entregados Hoy</div>
          <div className="font-mono text-2xl font-semibold text-[var(--color-ok)]">
            {data.kpis.entregadosHoy}
          </div>
          <div className="mt-1 text-[11px] text-[var(--color-text-faint)]">Confirmados</div>
        </div>
        <div className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <div className="mb-1.5 text-xs text-[var(--color-text-secondary)]">Costo Delivery</div>
          <dl className="space-y-0.5 text-[11px]">
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Hoy</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoHoy)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Semana</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoSemana)}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-[var(--color-text-faint)]">Mes</dt>
              <dd className="font-mono">{formatCLP(data.kpis.costoMes)}</dd>
            </div>
          </dl>
        </div>
      </div>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-baseline justify-between border-b border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">Delivery activos</h2>
          <span className="rounded-full bg-[var(--color-surface-2)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
            {data.active.length} {data.active.length === 1 ? 'activo' : 'activos'}
          </span>
        </div>
        {data.active.length === 0 ? (
          <div className="flex flex-col items-center gap-2 p-8 text-center">
            <Truck className="h-7 w-7 text-[var(--color-text-faint)]" aria-hidden="true" />
            <p className="text-xs text-[var(--color-text-secondary)]">
              No hay envíos en curso ahora mismo.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th scope="col" className="px-4 py-2 font-medium">Pedido</th>
                  <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                  <th scope="col" className="px-4 py-2 font-medium">Proyecto</th>
                  <th scope="col" className="px-4 py-2 font-medium">Tipo</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2 font-medium">Equipos</th>
                </tr>
              </thead>
              <tbody>
                {data.active.map(row => (
                  <ShipmentTableRow key={row.id} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="flex items-center justify-between gap-3 border-b border-[var(--color-border)] p-4">
          <h2 className="text-sm font-semibold">Tipos de Envío</h2>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                setFeedback(null);
                setEditing('new');
              }}
              className="inline-flex items-center gap-1.5 rounded-[6px] border border-[var(--color-border)] px-2.5 py-1.5 text-xs hover:bg-[var(--color-surface-2)]"
            >
              <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              Nuevo tipo
            </button>
          </div>
        </div>

        {feedback && (
          <p
            role="status"
            className={`border-b border-[var(--color-border)] px-4 py-2 text-[11px] ${
              feedback.tone === 'ok'
                ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]'
                : 'bg-[var(--color-crit-bg)] text-[var(--color-crit)]'
            }`}
          >
            {feedback.message}
          </p>
        )}

        {types.length === 0 ? (
          <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
            No hay métodos de envío configurados.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                  <th scope="col" className="px-4 py-2 font-medium">Tipo de Envío</th>
                  <th scope="col" className="px-4 py-2 font-medium">Modalidad</th>
                  <th scope="col" className="px-4 py-2 font-medium">Descripción</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                  <th scope="col" className="px-4 py-2 font-medium">Estado</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {types.map(type => (
                  <tr key={type.id} className="border-b border-[var(--color-border-soft)]">
                    <td className="px-4 py-2 font-medium">{type.name}</td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                      {shippingTypeLabel(type.shippingType)}
                    </td>
                    <td className="px-4 py-2 text-[var(--color-text-secondary)]">
                      {type.description || '—'}
                    </td>
                    <td className="px-4 py-2 text-right font-mono">{formatCLP(type.cost)}</td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => handleToggleType(type)}
                        disabled={busyId === type.id}
                        aria-label={
                          type.enabled ? `Desactivar ${type.name}` : `Activar ${type.name}`
                        }
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] disabled:opacity-60 ${
                          type.enabled
                            ? 'bg-[var(--color-ok-bg)] text-[var(--color-ok)]'
                            : 'bg-[var(--color-neutral-bg)] text-[var(--color-muted)]'
                        }`}
                      >
                        {busyId === type.id && (
                          <Loader2 className="h-2.5 w-2.5 animate-spin" aria-hidden="true" />
                        )}
                        {type.enabled ? 'Activo' : 'Inactivo'}
                      </button>
                    </td>
                    <td className="px-4 py-2">
                      <div className="flex justify-end gap-1">
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(null);
                            setEditing(type);
                          }}
                          aria-label={`Editar ${type.name}`}
                          className="rounded-[6px] p-1.5 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
                        >
                          <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setFeedback(null);
                            setDeleting(type);
                          }}
                          aria-label={`Eliminar ${type.name}`}
                          className="rounded-[6px] p-1.5 text-[var(--color-crit)] hover:bg-[var(--color-crit-bg)]"
                        >
                          <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
        <div className="border-b border-[var(--color-border)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Historial de Envíos</h2>
          <div className="flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar envío, cliente o pedido"
                aria-label="Buscar envío, cliente o pedido"
                className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
              />
            </div>
            <select
              value={typeFilter}
              onChange={e => setTypeFilter(e.target.value)}
              aria-label="Filtrar por tipo de envío"
              className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
            >
              <option value="todos">Todos los tipos</option>
              {types.map(type => (
                <option key={type.id} value={String(type.id)}>
                  {type.name}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              aria-label="Filtrar por estado del envío"
              className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
            >
              <option value="todos">Todos los estados</option>
              {SHIPMENT_STATUSES.map(status => (
                <option key={status} value={status}>
                  {shipmentLabel(status)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                <th scope="col" className="px-4 py-2 font-medium">Fecha</th>
                <th scope="col" className="px-4 py-2 font-medium">Pedido</th>
                <th scope="col" className="px-4 py-2 font-medium">Cliente</th>
                <th scope="col" className="px-4 py-2 font-medium">Tipo de Envío</th>
                <th scope="col" className="px-4 py-2 text-right font-medium">Valor</th>
                <th scope="col" className="px-4 py-2 font-medium">Estado</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 && (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[var(--color-text-secondary)]">
                    No se encontraron envíos con los filtros aplicados.
                  </td>
                </tr>
              )}
              {history.map(row => (
                <tr key={row.id} className="border-b border-[var(--color-border-soft)]">
                  <td className="whitespace-nowrap px-4 py-2 font-mono text-[11px]">
                    {formatDay(row.createdAt)}
                  </td>
                  <td className="px-4 py-2 font-mono text-[11px]">
                    <a href={`/orders/${row.orderId}`} className="underline underline-offset-2">
                      {row.orderReference}
                    </a>
                  </td>
                  <td className="px-4 py-2">{row.client}</td>
                  <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.methodName}</td>
                  <td className="px-4 py-2 text-right font-mono">{formatCLP(row.cost)}</td>
                  <td className="px-4 py-2">
                    <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusPill(row.status)}`}>
                      {shipmentLabel(row.status)}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="grid grid-cols-3 gap-3 border-t border-[var(--color-border)] p-4">
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Total Envíos</div>
            <div className="font-mono text-base font-semibold">{data.totals.totalEnvios}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Costo Total</div>
            <div className="font-mono text-base font-semibold">{formatCLP(data.totals.costoTotal)}</div>
          </div>
          <div>
            <div className="text-[10px] text-[var(--color-text-faint)]">Promedio por Envío</div>
            <div className="font-mono text-base font-semibold">
              {formatCLP(data.totals.promedioPorEnvio)}
            </div>
          </div>
        </div>

        <p className="border-t border-[var(--color-border)] bg-[var(--color-surface-soft)] p-3 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
          El canónico incluye además las columnas <strong>Conductor</strong> y{' '}
          <strong>Pago Delivery</strong>. <code>shipping_usage</code> no tiene ninguna de las dos:
          solo un <code>metadata</code> jsonb sin forma acordada. Se omiten hasta que el esquema
          las respalde — una columna vacía se lee como datos faltantes, no como una función que
          todavía no existe.
        </p>
      </section>

      {editing !== null && (
        <ShippingTypeDialog
          method={editing === 'new' ? null : editing}
          saving={saving}
          onSubmit={handleSubmitType}
          onClose={() => setEditing(null)}
        />
      )}

      {deleting && (
        <ConfirmDialog
          title="Eliminar tipo de envío"
          description={shippingMethodDeleteWarning(
            deleting.name,
            data.history.filter(row => row.methodId === deleting.id).length
          )}
          confirmLabel="Eliminar de todas formas"
          busy={busyId === deleting.id}
          onConfirm={handleDeleteType}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}

/**
 * Fila de "Delivery activos" con la lista de equipos con número de serie del pedido, cada uno con
 * su propio `AssetCheckOutControl` (T-026 gap 2/4). Órdenes sin ningún `product_id` numérico en
 * `line_items` (ver `itemsFromLineItems`) no muestran ningún control — no hay nada serializado que
 * registrar.
 */
function ShipmentTableRow({ row }: { row: ShipmentRow }) {
  const items = useMemo(() => itemsFromLineItems(row.lineItems), [row.lineItems]);
  const serialisableItems = items.filter(item => item.productId !== null);

  return (
    <tr className="border-b border-[var(--color-border-soft)]">
      <td className="px-4 py-2 font-mono text-[11px]">
        <a href={`/orders/${row.orderId}`} className="underline underline-offset-2">
          {row.orderReference}
        </a>
      </td>
      <td className="px-4 py-2">{row.client}</td>
      <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.project}</td>
      <td className="px-4 py-2 text-[var(--color-text-secondary)]">{row.methodName}</td>
      <td className="px-4 py-2 text-right font-mono">{formatCLP(row.cost)}</td>
      <td className="px-4 py-2">
        <span className={`rounded-full px-2 py-0.5 text-[10px] ${statusPill(row.status)}`}>
          {shipmentLabel(row.status)}
        </span>
      </td>
      <td className="px-4 py-2">
        {serialisableItems.length === 0 ? (
          <span className="text-[10px] text-[var(--color-text-faint)]">—</span>
        ) : (
          <div className="flex flex-col gap-1.5">
            {serialisableItems.map((item, index) => (
              <div key={`${item.sku}-${index}`}>
                <div className="truncate text-[10px] text-[var(--color-text-secondary)]">{item.name}</div>
                {/* `item.productId` no es null: filtrado arriba en `serialisableItems`. */}
                <AssetCheckOutControl productId={item.productId as number} orderId={row.orderId} />
              </div>
            ))}
          </div>
        )}
      </td>
    </tr>
  );
}
