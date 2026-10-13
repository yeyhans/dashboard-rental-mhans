import React, { useEffect, useMemo, useRef, useState } from "react";
import { Calendar as CalendarIcon, Package, Search, X } from "lucide-react";
import { formatIsoDateLabel, openDatePicker } from "../../lib/dateInput";
import {
  checkInTotals,
  formatCheckInItemCount,
  formatReturnDeadlineLabel,
  itemsFromLineItems,
  type ReturnUrgency,
} from "../../lib/checkIn";
import {
  checkInBandTitle,
  filterByReturnDate,
  resolveVisibleSelection,
} from "../../lib/checkInDateFilter";
import { statusBadgeClass, statusLabel } from "../../lib/orderStatus";
import { Button } from "../ui/button";
import { KpiCard } from "../shared/KpiCard";
import { PageHeader } from "../shared/PageHeader";
import type {
  CheckInBoard as CheckInBoardData,
  CheckInListEntry,
} from "../../services/checkInService";
import CheckInReceptionPanel from "./CheckInReceptionPanel";

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
 *
 * R-04: el detalle (estado por línea con botones, incidencias y cierre de la devolución) vive en
 * `CheckInReceptionPanel`; el control de check-in por número de serie, en `AssetCheckInControl`.
 * T-01: la lista viene paginada desde el servidor (solo `in-rental` y `return`), así que la
 * búsqueda y "Filtrar fecha" actúan sobre la página cargada.
 */
interface CheckInBoardProps {
  data: CheckInBoardData;
  /** Fecha de la cabecera. Se inyecta desde el servidor para no depender del reloj del cliente. */
  todayLabel: string;
  /**
   * Día calendario de hoy (`YYYY-MM-DD`, D-15), también resuelto en el servidor. Decide si
   * "Vence 13:00" de una fila muestra además su fecha (ver `formatReturnDeadlineLabel`).
   */
  todayIsoDay: string;
}

const URGENCY_STYLES: Record<
  ReturnUrgency,
  { label: string; className: string }
> = {
  late: {
    label: "Atrasado",
    className: "text-[var(--color-crit)] font-semibold",
  },
  urgent: { label: "Hoy", className: "text-[var(--color-warn)] font-semibold" },
  soon: { label: "Próximo", className: "text-[var(--color-info)]" },
  scheduled: {
    label: "Agendado",
    className: "text-[var(--color-text-secondary)]",
  },
  done: { label: "Completado", className: "text-[var(--color-ok)]" },
};

export default function CheckInBoard({
  data,
  todayLabel,
  todayIsoDay,
}: CheckInBoardProps) {
  const pagination = data.pagination;
  // D-22 (03e): el panel derecho ya no arranca vacío cuando hay devoluciones que mostrar — se
  // preselecciona la primera de la lista, igual que cualquier maestro/detalle con datos.
  const [selectedId, setSelectedId] = useState<number | null>(
    data.entries[0]?.id ?? null,
  );
  const [search, setSearch] = useState("");
  // D-22 (03a): "Filtrar fecha" filtra la lista YA CARGADA por fecha de término exacta — sin
  // endpoint nuevo. Vacío (por defecto) sigue mostrando devoluciones abiertas + atrasadas.
  const [dateFilter, setDateFilter] = useState("");
  const dateInputRef = useRef<HTMLInputElement>(null);

  const visible = useMemo(() => {
    const byDate = filterByReturnDate(data.entries, dateFilter);
    const needle = search.trim().toLowerCase();
    if (!needle) return byDate;
    return byDate.filter(
      (e) =>
        e.reference.toLowerCase().includes(needle) ||
        e.client.toLowerCase().includes(needle) ||
        e.project.toLowerCase().includes(needle),
    );
  }, [data.entries, search, dateFilter]);

  // D-22 (03b): "Devoluciones hoy" solo cuando el filtro deja la lista acotada exactamente a hoy;
  // en cualquier otro caso (sin filtro, o un día distinto) se conserva "Devoluciones" porque la
  // vista sigue mezclando abiertas + atrasadas (ver docstring de más abajo, D-15).
  const bandTitle = checkInBandTitle(dateFilter, todayIsoDay);

  // D-25 (R3-checkin-preselect-hidden-by-filter): if "Filtrar fecha" hides the previously
  // selected entry, fall back to the first entry still visible instead of leaving the detail
  // panel showing a row that is no longer highlighted (or even visible) on the left.
  const effectiveSelectedId = resolveVisibleSelection(visible, selectedId);

  // D-27 (R3-checkin-effective-selection-not-persisted): `effectiveSelectedId` only recomputes
  // the fallback for THIS render; without writing it back, `selectedId` keeps pointing at the
  // hidden entry, so the next filter change re-derives from the stale id instead of the one the
  // admin is actually looking at. Persisting it keeps later actions (e.g. clearing the date
  // filter) consistent with what is currently shown.
  useEffect(() => {
    if (effectiveSelectedId !== selectedId) setSelectedId(effectiveSelectedId);
  }, [effectiveSelectedId, selectedId]);

  const selected: CheckInListEntry | null =
    data.entries.find((e) => e.id === effectiveSelectedId) ?? null;

  // Canon (m-chk, "Medio"): las 4 KPI no llevan ícono ni cifra en mono con cero tachado — solo
  // etiqueta + valor plano, con color semántico donde corresponde.
  const kpiCards = [
    {
      key: "pend",
      label: "Pendientes Hoy",
      value: data.kpis.pendientesHoy,
      meta: "Por recibir",
      tone: "",
    },
    {
      key: "rec",
      label: "Recibidos Hoy",
      value: data.kpis.recibidosHoy,
      meta: "Completados",
      tone: "text-[var(--color-ok)]",
    },
    {
      key: "inc",
      label: "Incidencias",
      value: data.kpis.incidencias,
      meta: "Requieren acción",
      tone: "text-[var(--color-crit)]",
    },
    {
      key: "atr",
      label: "Devoluciones Atrasadas",
      value: data.kpis.atrasadas,
      meta: "Fuera de hora",
      tone: "text-[var(--color-warn)]",
    },
  ];

  // Canon (m-chk, "Alto"): fila con hora de devolución. No hay una hora por pedido en el
  // esquema — `order_fecha_termino` es `date`, sin componente de hora — así que se muestra el
  // plazo fijo de la regla de negocio (13:00 del día siguiente al término, R3-105/checkIn.ts).
  // D-15: la FECHA de ese plazo es por pedido, así que cada fila la calcula con la suya
  // (`formatReturnDeadlineLabel`, más abajo) en vez de compartir una etiqueta fija.

  return (
    <div>
      <PageHeader
        title="Check-In / Devoluciones"
        subtitle="Recepción y cierre de equipos devueltos"
        date={todayLabel}
        actions={
          <>
            {/* 03.1: secondary button; the native input stays hidden behind it and opens via showPicker(). */}
            <span className="relative inline-flex">
              <Button
                type="button"
                variant="outline"
                aria-label="Filtrar fecha de devolución"
                onClick={() => openDatePicker(dateInputRef.current)}
              >
                <CalendarIcon className="mr-1.5 h-4 w-4" aria-hidden="true" />
                {formatIsoDateLabel(dateFilter) || "Filtrar fecha"}
              </Button>
              <input
                ref={dateInputRef}
                type="date"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value)}
                tabIndex={-1}
                aria-hidden="true"
                className="sr-only"
              />
            </span>
            {/* D-12: back to the "no date" state without having to open the picker. */}
            {dateFilter && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label="Quitar filtro de fecha"
                title="Quitar filtro de fecha"
                onClick={() => setDateFilter("")}
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </Button>
            )}
            <Button
              type="button"
              variant="outline"
              onClick={() => window.location.reload()}
            >
              Actualizar
            </Button>
          </>
        }
        className="mb-4"
      />

      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {kpiCards.map(({ key, label, value, meta, tone }) => (
          <KpiCard
            key={key}
            label={label}
            value={<span className={tone || undefined}>{value}</span>}
            footer={meta}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.4fr)]">
        <section
          className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
          aria-label="Devoluciones"
        >
          {/*
            Canon (m-chk, "Alto"): banda gris "Devoluciones hoy · N pedidos". Banda gris siempre;
            el título es "Devoluciones hoy" solo cuando "Filtrar fecha" (D-22 03a) acota la lista
            a exactamente hoy — recién ahí el conteo real ES "hoy". Sin filtro (por defecto) sigue
            "Devoluciones", porque mezcla TODAS las abiertas más las cerradas hoy (ver docstring
            de `CheckInService.getBoard`), no solo las de hoy — titularlo "hoy" con ese número
            confundiría de qué está compuesto. `checkInBandTitle` (`lib/checkInDateFilter.ts`)
            decide el título; esta sección solo lo pinta.
          */}
          <div className="border-b border-[var(--color-border)] bg-[var(--color-surface-2)] p-4">
            <div className="flex items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold">{bandTitle}</h2>
              <span className="rounded-full bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]">
                {visible.length} {visible.length === 1 ? "pedido" : "pedidos"}
              </span>
            </div>
            <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
              {todayLabel}
            </p>
            <div className="relative mt-3">
              <Search
                className="pointer-events-none absolute left-2.5 top-2.5 h-3.5 w-3.5 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar pedido o cliente"
                aria-label="Buscar pedido o cliente"
                className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
              />
            </div>
          </div>

          {/*
            D-25: capped height + internal scroll only from `lg:` up, where the list sits
            side-by-side with the detail panel. Below that the two sections stack in the page's
            own scroll, so a second independent scroll container here would be a double scroll.
          */}
          <ul className="lg:max-h-[560px] lg:overflow-y-auto">
            {visible.length === 0 && (
              <li className="p-8 text-center text-xs text-[var(--color-text-secondary)]">
                {search
                  ? "Ningún pedido coincide con la búsqueda."
                  : "No hay devoluciones pendientes."}
              </li>
            )}
            {visible.map((entry) => {
              const urgency = URGENCY_STYLES[entry.urgency];
              const isSelected = entry.id === effectiveSelectedId;
              // D-15: ya no se muestra un progreso "3 / 12 recibidos" — `itemsFromLineItems`
              // marca todo como pending (no hay columna de recepción por ítem en el esquema), así
              // que ese contador siempre leía "0 / N recibidos", un progreso falso. Se calcula
              // sobre las mismas `lineItems` que ya viajan con cada entrada — no hace falta otra
              // consulta — pero solo para el conteo honesto de unidades.
              const rowTotals = checkInTotals(
                itemsFromLineItems(entry.lineItems),
              );
              const deadlineLabel = formatReturnDeadlineLabel(
                entry.endDate,
                todayIsoDay,
              );
              return (
                <li key={entry.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(entry.id)}
                    aria-current={isSelected ? "true" : undefined}
                    className={`w-full border-b border-[var(--color-border-soft)] p-3 text-left transition-colors hover:bg-[var(--color-surface-soft)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--color-text-primary)] ${
                      isSelected
                        ? "border-l-4 border-l-[var(--color-info)] bg-[var(--color-info-bg)]"
                        : ""
                    }`}
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {entry.reference}
                      </span>
                      <span className={`text-[11px] ${urgency.className}`}>
                        {urgency.label}
                      </span>
                    </div>
                    <div className="mt-1 truncate text-xs font-medium">
                      {entry.client}
                    </div>
                    <div className="truncate text-[11px] text-[var(--color-text-secondary)]">
                      {entry.project}
                    </div>
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] ${statusBadgeClass(entry.status)}`}
                      >
                        {statusLabel(entry.status)}
                      </span>
                      <span className="text-[10px] text-[var(--color-text-faint)]">
                        {entry.itemCount}{" "}
                        {entry.itemCount === 1 ? "equipo" : "equipos"}
                      </span>
                      {entry.urgency !== "done" && (
                        <span className="text-[10px] text-[var(--color-text-faint)]">
                          Vence {deadlineLabel}
                        </span>
                      )}
                      <span className="text-[10px] text-[var(--color-text-faint)]">
                        {formatCheckInItemCount(rowTotals)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })}
          </ul>

          {/* T-01: server pagination. Plain links: the page is server-rendered per `?page=`. */}
          {pagination && pagination.totalPages > 1 && (
            <nav
              aria-label="Paginación de devoluciones"
              className="flex items-center justify-between gap-2 border-t border-[var(--color-border)] px-4 py-2 text-[11px] text-[var(--color-text-secondary)]"
            >
              {pagination.page > 1 ? (
                <a
                  href={`?page=${pagination.page - 1}`}
                  className="underline underline-offset-2"
                >
                  ← Anterior
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
              <span>
                Página {pagination.page} de {pagination.totalPages} ·{" "}
                {pagination.total} pedidos
              </span>
              {pagination.page < pagination.totalPages ? (
                <a
                  href={`?page=${pagination.page + 1}`}
                  className="underline underline-offset-2"
                >
                  Siguiente →
                </a>
              ) : (
                <span aria-hidden="true" />
              )}
            </nav>
          )}
        </section>

        <section
          className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
          aria-label="Detalle de la devolución"
        >
          {!selected ? (
            <div className="flex h-full min-h-[280px] flex-col items-center justify-center gap-2 p-8 text-center">
              <Package
                className="h-8 w-8 text-[var(--color-text-faint)]"
                aria-hidden="true"
              />
              <p className="text-xs text-[var(--color-text-secondary)]">
                Selecciona un pedido para revisar los equipos.
              </p>
            </div>
          ) : (
            <CheckInReceptionPanel
              key={selected.id}
              entry={selected}
              todayIsoDay={todayIsoDay}
            />
          )}
        </section>
      </div>
    </div>
  );
}
