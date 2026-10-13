import React, { useEffect, useMemo, useState } from "react";
import { toast, Toaster } from "sonner";
import {
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  Eye,
  Package,
  Percent,
  PiggyBank,
  Receipt,
  RotateCcw,
  Search,
  SlidersHorizontal,
  TrendingUp,
  Wallet,
} from "lucide-react";
import { formatCLP } from "../../lib/delivery";
import { PAYMENT_DOCUMENT_MAX_LENGTH } from "../../lib/finance";
import type {
  FinanceBoard as FinanceBoardData,
  FinanceRow,
  SavedPayment,
} from "../../services/financeService";
import { PageHeader } from "../shared/PageHeader";
import { KpiCard } from "../shared/KpiCard";
import { StatusBadge } from "../shared/StatusBadge";
import { RowActionsMenu } from "../shared/RowActionsMenu";
import { Button } from "../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";
import {
  applySavedPayment,
  PAGE_SIZE_OPTIONS,
  reserveChip,
  type FinanceLists,
} from "./financePaymentState";
import { formatMonthDelta, paidMonthOverMonth } from "./financePaidDelta";
import { FinanceCharts } from "./FinanceCharts";
import {
  dueSoon,
  type FinanceCharts as FinanceChartsData,
} from "../../lib/financeCharts";
import {
  financeRowsToCsv,
  formatDay,
  buildFinanceExportBlob,
  buildFinanceExportFilename,
} from "./financeExport";
import {
  recomputePaidKpis,
  recomputePendingKpis,
  recomputeSummary,
} from "./financePeriodKpis";
import {
  matchesPaymentFilter,
  PAYMENT_FILTER_OPTIONS,
  type PaymentFilterKey,
} from "./financePaymentFilter";
import {
  financeActiveFilterChips,
  financeSummaryFilterLabel,
} from "./financeActiveFilters";
import {
  filterByPeriod,
  periodRangeFor,
  PERIOD_OPTIONS,
  type PeriodKey,
} from "../../lib/periodRange";
import { monthlyBucketSums } from "../../lib/sparkline";
import { paginate, paginationLabel, type Page } from "../../lib/pagination";

/**
 * Finanzas & Cobranza.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Finanzas_Cobranza_Canonical_RC2.1.4.html`: tres
 * pestañas — Pendientes, Pagados, Finanzas — cada una con su fila de indicadores y su tabla.
 * RC2.1.2 se comparó con RC2.1.4 y tienen el mismo contenido; manda la revisión más nueva.
 */
interface FinanceBoardProps {
  data: FinanceBoardData;
  periodLabel: string;
  /**
   * D-27 (R3-sparkline-test-vacuous-time-dependent): injectable "now", defaulting to the real
   * current date. Lets tests fix the sparkline's trailing 6-month window instead of depending on
   * whatever date the suite happens to run on.
   */
  now?: Date;
  /** Tab shown first; Pendientes unless a test needs another one rendered. */
  initialTab?: Tab;
  /** R-03b: `FinanceService.getCharts`; null when it failed to load. */
  charts?: FinanceChartsData | null;
}

type Tab = "pendientes" | "pagados" | "finanzas";

/** R-03a: one payment change waiting for the admin's confirmation. */
interface PendingConfirmation {
  row: FinanceRow;
  paid: boolean;
}

async function patchPayment(
  id: number,
  body: Record<string, unknown>,
): Promise<SavedPayment> {
  // `PATCH /api/payments/[id]` exige sesión de admin (`withAuth`), que se resuelve por cookie.
  const response = await fetch(`/api/payments/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(body),
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.error ?? "No se pudo guardar el pago");
  }
  return payload.data as SavedPayment;
}

/**
 * R-03a: OC / Factura typed in place. Saves on blur (or Enter) only when the value changed, and
 * goes back to the saved value when the request fails.
 */
function DocumentInput({
  row,
  field,
  label,
  disabled,
  onSave,
}: {
  row: FinanceRow;
  field: "purchaseOrder" | "invoiceNumber";
  label: string;
  disabled: boolean;
  onSave: (value: string) => Promise<boolean>;
}) {
  const saved = row[field] ?? "";
  const [value, setValue] = useState(saved);
  useEffect(() => setValue(saved), [saved]);

  const commit = async () => {
    if (value.trim() === saved) {
      setValue(saved);
      return;
    }
    const isSaved = await onSave(value);
    if (!isSaved) setValue(saved);
  };

  return (
    <input
      type="text"
      value={value}
      disabled={disabled}
      maxLength={PAYMENT_DOCUMENT_MAX_LENGTH}
      placeholder="—"
      aria-label={`${label} pedido ${row.reference}`}
      onChange={(e) => setValue(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.currentTarget.blur();
      }}
      className="w-24 rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 font-mono text-[11px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
    />
  );
}

const TABS: ReadonlyArray<{ value: Tab; label: string }> = [
  { value: "pendientes", label: "Pendientes" },
  { value: "pagados", label: "Pagados" },
  { value: "finanzas", label: "Finanzas" },
];

function matches(row: FinanceRow, needle: string): boolean {
  if (!needle) return true;
  const n = needle.toLowerCase();
  return (
    row.reference.toLowerCase().includes(n) ||
    row.client.toLowerCase().includes(n) ||
    row.project.toLowerCase().includes(n) ||
    (row.invoiceNumber ?? "").toLowerCase().includes(n)
  );
}

/** 07.1: "Mostrando X a Y de N resultados" footer with prev/next, shared by both tables. */
function Pager({
  page,
  onPageChange,
  pageSize,
  onPageSizeChange,
}: {
  page: Page<unknown>;
  onPageChange: (next: number) => void;
  pageSize: number;
  onPageSizeChange: (next: number) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 border-t border-[var(--color-border)] px-3 py-2 text-[11px] text-[var(--color-text-secondary)]">
      <div className="flex items-center gap-3">
        <span>{paginationLabel(page)}</span>
        {/* R-03a: the canon's "10 por página" select. */}
        <label className="flex items-center gap-1.5">
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            aria-label="Filas por página"
            className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-1.5 py-0.5 text-[11px]"
          >
            {PAGE_SIZE_OPTIONS.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
          por página
        </label>
      </div>
      {page.totalPages > 1 && (
        <div className="flex items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!page.hasPrev}
            onClick={() => onPageChange(page.page - 1)}
          >
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={!page.hasNext}
            onClick={() => onPageChange(page.page + 1)}
          >
            Siguiente
          </Button>
        </div>
      )}
    </div>
  );
}

/** Thin wrapper over the shared KpiCard: keeps the D-10 tone-colored value, icon and footer meta. */
function Kpi({
  icon,
  label,
  value,
  meta,
  tone,
  sparkline,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  meta: string;
  tone?: string;
  /** D-24 07d: optional trend line, forwarded straight to `KpiCard`. */
  sparkline?: readonly number[];
}) {
  return (
    <KpiCard
      icon={icon}
      label={label}
      value={<span className={tone}>{value}</span>}
      footer={meta}
      sparkline={sparkline}
    />
  );
}

export default function FinanceBoard({
  data,
  periodLabel,
  now: nowProp,
  initialTab = "pendientes",
  charts,
}: FinanceBoardProps) {
  const [tab, setTab] = useState<Tab>(initialTab);
  // R-03a: the rows live in state so a saved payment moves between tabs without a reload.
  const [lists, setLists] = useState<FinanceLists>({
    pendingRows: data.pendingRows,
    paidRows: data.paidRows,
  });
  const [pageSize, setPageSize] = useState<number>(PAGE_SIZE_OPTIONS[0]);
  const [confirmation, setConfirmation] = useState<PendingConfirmation | null>(
    null,
  );
  const [savingId, setSavingId] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("all");
  const [paymentFilter, setPaymentFilter] = useState<PaymentFilterKey>("all");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [pageNumber, setPageNumber] = useState(1);
  const now = useMemo(() => nowProp ?? new Date(), [nowProp]);

  // D-27 (R3-finance-search-hidden-when-collapsed / R3-finance-summary-hidden-filters): the
  // client search and "Estado de pago" filter keep hiding rows (and KPI totals) once the
  // "Filtros" panel collapses, with nothing on screen explaining why — these chips and the
  // summary label below make that explicit regardless of panel state.
  const activeFilterChips = useMemo(
    () =>
      financeActiveFilterChips({
        search,
        paymentFilter,
        // `paymentFilter` only ever filters `pendingRows` (see the memo above), but that feeds
        // both the Pendientes table AND the Finanzas summary — only Pagados is unaffected.
        showPaymentFilter: tab !== "pagados",
      }),
    [search, paymentFilter, tab],
  );
  // The "Período" dropdown's own label ("Este mes", "Todo", …), not the `periodLabel` prop —
  // that one is the page header's generic current-date caption, unrelated to this selector.
  const periodOptionLabel =
    PERIOD_OPTIONS.find((o) => o.value === period)?.label ?? period;
  const summaryLabel = useMemo(
    () =>
      financeSummaryFilterLabel({
        periodLabel: periodOptionLabel,
        chips: activeFilterChips,
      }),
    [periodOptionLabel, activeFilterChips],
  );
  const clearActiveFilters = () => {
    setSearch("");
    setPaymentFilter("all");
  };

  // D-24 07c: a period selector filtering the rows `FinanceService.getBoard` already loaded (it
  // fetches every non-cancelled order without a date window, so there is no second query here —
  // just a client-side `endDate`/`paidAt` cut). KPIs below are recomputed from whatever rows
  // survive period + "Filtros" (estado de pago) + the search box.
  const range = useMemo(() => periodRangeFor(period, now), [period, now]);

  const pendingRows = useMemo(() => {
    const byPeriod = filterByPeriod(lists.pendingRows, range, (r) => r.endDate);
    const byPayment = byPeriod.filter((r) =>
      matchesPaymentFilter(r, paymentFilter),
    );
    return byPayment.filter((r) => matches(r, search.trim()));
  }, [lists.pendingRows, range, paymentFilter, search]);

  const paidRows = useMemo(() => {
    const byPeriod = filterByPeriod(lists.paidRows, range, (r) => r.paidAt);
    return byPeriod.filter((r) => matches(r, search.trim()));
  }, [lists.paidRows, range, search]);

  // 07.1: any change to what the table lists sends it back to the first page.
  useEffect(() => {
    setPageNumber(1);
  }, [tab, period, paymentFilter, search, pageSize]);

  const pendingPage = useMemo(
    () => paginate(pendingRows, pageNumber, pageSize),
    [pendingRows, pageNumber, pageSize],
  );
  const paidPage = useMemo(
    () => paginate(paidRows, pageNumber, pageSize),
    [paidRows, pageNumber, pageSize],
  );

  // R-03a: "% vs mes anterior" — this month against the previous one, over every loaded paid
  // row, independent of the Período selector (see `paidMonthOverMonth`).
  const paidDelta = useMemo(
    () => paidMonthOverMonth(lists.paidRows, now),
    [lists.paidRows, now],
  );

  // R-03b: "Por Vencer — Próximos 7 Días", from every loaded pending row (not the filtered view).
  const dueSoonRows = useMemo(
    () => dueSoon(lists.pendingRows, now),
    [lists.pendingRows, now],
  );

  const savePayment = async (
    row: FinanceRow,
    body: Record<string, unknown>,
    successMessage: string,
  ): Promise<boolean> => {
    setSavingId(row.id);
    try {
      const saved = await patchPayment(row.id, body);
      setLists((current) => applySavedPayment(current, saved, new Date()));
      toast.success(successMessage);
      return true;
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo guardar el pago",
      );
      return false;
    } finally {
      setSavingId(null);
    }
  };

  const confirmPayment = () => {
    const target = confirmation;
    setConfirmation(null);
    if (!target) return;
    void savePayment(
      target.row,
      { paid: target.paid },
      target.paid
        ? `${target.row.reference} quedó pagado`
        : `${target.row.reference} volvió a Pendientes`,
    );
  };

  const rowActions = (row: FinanceRow) => [
    {
      id: "view",
      label: "Ver pedido",
      icon: Eye,
      onSelect: () => {
        window.location.href = `/orders/${row.id}`;
      },
    },
    row.fullyPaid
      ? {
          id: "unpay",
          label: "Marcar como no pagado",
          icon: RotateCcw,
          disabled: savingId === row.id,
          onSelect: () => setConfirmation({ row, paid: false }),
        }
      : {
          id: "pay",
          label: "Marcar como pagado",
          icon: CheckCircle2,
          disabled: savingId === row.id,
          onSelect: () => setConfirmation({ row, paid: true }),
        },
  ];

  const saveDocument =
    (row: FinanceRow, field: "purchaseOrder" | "invoiceNumber") =>
    (value: string) =>
      savePayment(
        row,
        { [field]: value },
        field === "purchaseOrder"
          ? "Orden de compra guardada"
          : "Número de factura guardado",
      );

  const pendingKpis = useMemo(
    () => recomputePendingKpis(pendingRows),
    [pendingRows],
  );
  const paidKpisData = useMemo(() => recomputePaidKpis(paidRows), [paidRows]);
  const summary = useMemo(
    () => recomputeSummary(pendingRows, paidRows),
    [pendingRows, paidRows],
  );

  // D-24 07d: trailing 6-month trend for the two headline KPIs, from the board's own loaded
  // rows (not the period-filtered subset above — a sparkline is meant to show the trend
  // regardless of which period the admin is currently looking at).
  const pendingSparkline = useMemo(
    () =>
      monthlyBucketSums(
        lists.pendingRows,
        (r) => r.endDate,
        (r) => r.outstanding,
        now,
        6,
      ),
    [lists.pendingRows, now],
  );
  const paidSparkline = useMemo(
    () =>
      monthlyBucketSums(
        lists.paidRows,
        (r) => r.paidAt,
        (r) => r.total,
        now,
        6,
      ),
    [lists.paidRows, now],
  );

  // D-10/D-24: "Exportar" descarga en CSV, sin dependencias nuevas, las filas ya
  // cargadas/filtradas (período + estado de pago + búsqueda) de la pestaña activa.
  const handleExport = () => {
    if (typeof window === "undefined" || tab === "finanzas") return;
    const rows = tab === "pendientes" ? pendingRows : paidRows;
    const csv = financeRowsToCsv(rows, tab);
    // D-16/D-18: BOM + filename built by pure, unit-tested helpers (`financeExport.ts`); the
    // file's date is the Chilean business day, not the server's UTC one (R3-104).
    const blob = new Blob([buildFinanceExportBlob(csv)], {
      type: "text/csv;charset=utf-8;",
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = buildFinanceExportFilename(tab, new Date());
    // Attached to the DOM before the click, same reason as F-04/D-13's warning: Firefox and
    // Safari can silently ignore `click()` on a detached anchor. Revoking the object URL is
    // deferred so the browser has started the download before the URL is invalidated.
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 0);
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="Finanzas & Cobranza"
        subtitle="¿Cuánto dinero ingresó y qué dinero falta cobrar?"
        date={periodLabel}
        actions={
          <div className="flex items-center gap-2">
            {/* 07.4: date-range look (calendar icon + select); behaviour is unchanged. */}
            <span className="relative inline-flex items-center">
              <Calendar
                className="pointer-events-none absolute left-2 h-3.5 w-3.5 text-[var(--color-text-secondary)]"
                aria-hidden="true"
              />
              <select
                value={period}
                onChange={(e) => setPeriod(e.target.value as PeriodKey)}
                aria-label="Período"
                className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1 pl-7 pr-2 text-xs"
              >
                {PERIOD_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </span>
            {tab !== "finanzas" && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="mr-1 h-3.5 w-3.5" />
                Exportar
              </Button>
            )}
          </div>
        }
      />

      <div
        role="tablist"
        aria-label="Vistas de cobranza"
        className="flex gap-0.5 border-b border-[var(--color-border)]"
      >
        {TABS.map((item) => (
          <button
            key={item.value}
            role="tab"
            type="button"
            aria-selected={tab === item.value}
            onClick={() => setTab(item.value)}
            className={`-mb-px border-b-2 px-3 py-2 text-xs transition-colors ${
              tab === item.value
                ? "border-[var(--color-text-primary)] font-medium text-[var(--color-text-primary)]"
                : "border-transparent text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab !== "finanzas" && (
        <div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setFiltersOpen((open) => !open)}
            aria-expanded={filtersOpen}
            aria-controls="finance-filters-panel"
          >
            <SlidersHorizontal className="mr-1 h-3.5 w-3.5" />
            Filtros
          </Button>

          {filtersOpen && (
            <div
              id="finance-filters-panel"
              className="mt-2 flex flex-wrap items-end gap-3 rounded-[8px] border border-[var(--color-border)] bg-[var(--color-surface)] p-3"
            >
              <div className="relative max-w-sm flex-1">
                <label
                  htmlFor="finance-client-search"
                  className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
                >
                  Cliente
                </label>
                <Search
                  className="pointer-events-none absolute left-2.5 top-[26px] h-3.5 w-3.5 text-[var(--color-text-faint)]"
                  aria-hidden="true"
                />
                <input
                  id="finance-client-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={
                    tab === "pendientes"
                      ? "Buscar en pendientes"
                      : "Buscar en pagados"
                  }
                  className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] py-1.5 pl-8 pr-3 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]"
                />
              </div>

              {tab === "pendientes" && (
                <div>
                  <label
                    htmlFor="finance-payment-filter"
                    className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
                  >
                    Estado de pago
                  </label>
                  <select
                    id="finance-payment-filter"
                    value={paymentFilter}
                    onChange={(e) =>
                      setPaymentFilter(e.target.value as PaymentFilterKey)
                    }
                    className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
                  >
                    {PAYMENT_FILTER_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>
          )}

          {/* D-27 (R3-finance-search-hidden-when-collapsed): with the panel collapsed, this is
              the only visible sign that Cliente/Estado are still filtering the rows below. */}
          {!filtersOpen && activeFilterChips.length > 0 && (
            <div className="mt-2 flex flex-wrap items-center gap-1.5">
              {activeFilterChips.map((chip) => (
                <span
                  key={chip.key}
                  className="rounded-full border border-[var(--color-border)] bg-[var(--color-surface)] px-2 py-0.5 text-[11px] text-[var(--color-text-secondary)]"
                >
                  {chip.label}
                </span>
              ))}
              <button
                type="button"
                onClick={clearActiveFilters}
                className="text-[11px] underline underline-offset-2 text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]"
              >
                Limpiar
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "pendientes" && (
        <>
          {/* D-27 (R3-finance-summary-hidden-filters): names the period + any hidden filter so
              these KPI totals' scope is explicit, not just implied by a collapsed panel. */}
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Mostrando: {summaryLabel}
          </p>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Kpi
              icon={Wallet}
              label="Monto Pendiente"
              value={formatCLP(pendingKpis.montoPendiente)}
              meta={`${pendingKpis.documentosPendientes} documentos`}
              sparkline={pendingSparkline}
            />
            <Kpi
              icon={Package}
              label="Pedidos Pendientes"
              value={String(pendingKpis.pedidosPendientes)}
              meta="Órdenes de arriendo"
            />
            <Kpi
              icon={PiggyBank}
              label="Reservas Pendientes"
              value={String(pendingKpis.reservasPendientes)}
              meta={formatCLP(pendingKpis.montoReservasPendientes)}
              tone="text-[var(--color-warn)]"
            />
            <Kpi
              icon={AlertTriangle}
              label="Pagos Vencidos"
              value={formatCLP(pendingKpis.montoVencido)}
              meta={`${pendingKpis.documentosVencidos} documentos`}
              tone="text-[var(--color-crit)]"
            />
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Facturas pendientes de cobro: cliente, total, reserva, saldo y
                  estado de pago
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">
                      ID Pedido
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Proyecto
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Total
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Reserva
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Saldo Pendiente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      OC
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Factura
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Pago
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Acciones
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {pendingRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={10}
                        className="p-8 text-center text-[var(--color-text-secondary)]"
                      >
                        {search
                          ? "Ningún documento coincide con la búsqueda."
                          : "No hay cobros pendientes."}
                      </td>
                    </tr>
                  )}
                  {pendingPage.items.map((row) => {
                    const reserve = reserveChip(row);
                    const isSaving = savingId === row.id;
                    return (
                      <tr
                        key={row.id}
                        className="border-b border-[var(--color-border-soft)]"
                      >
                        <td className="px-3 py-2 font-mono text-[11px]">
                          <a
                            href={`/orders/${row.id}`}
                            className="underline underline-offset-2"
                          >
                            {row.reference}
                          </a>
                        </td>
                        <td className="px-3 py-2">{row.client}</td>
                        <td className="max-w-[180px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                          {row.project}
                        </td>
                        <td className="px-3 py-2 text-right font-mono">
                          {formatCLP(row.total)}
                        </td>
                        <td className="px-3 py-2 text-right">
                          {/* R-03a: the canon's reserve chip, beside the amount actually agreed. */}
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono text-[var(--color-text-secondary)]">
                              {formatCLP(row.reserve)}
                            </span>
                            <StatusBadge
                              tone={reserve.tone}
                              label={reserve.label}
                            />
                          </div>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <span className="font-mono font-semibold">
                              {formatCLP(row.outstanding)}
                            </span>
                            {row.overdue && (
                              <StatusBadge tone="crit" label="Vencido" />
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-2">
                          <DocumentInput
                            row={row}
                            field="purchaseOrder"
                            label="Orden de compra"
                            disabled={isSaving}
                            onSave={saveDocument(row, "purchaseOrder")}
                          />
                        </td>
                        <td className="px-3 py-2">
                          <DocumentInput
                            row={row}
                            field="invoiceNumber"
                            label="Número de factura"
                            disabled={isSaving}
                            onSave={saveDocument(row, "invoiceNumber")}
                          />
                        </td>
                        <td className="px-3 py-2">
                          {/* Pendientes only lists unpaid rows, so this sits on "No pagado";
                              choosing "Pagado" asks for confirmation before saving. */}
                          <select
                            value="no-pagado"
                            disabled={isSaving}
                            aria-label={`Estado de pago pedido ${row.reference}`}
                            onChange={(e) => {
                              if (e.target.value === "pagado") {
                                setConfirmation({ row, paid: true });
                              }
                            }}
                            className="rounded-[6px] border border-[var(--color-crit)] bg-[var(--color-crit-bg)] px-2 py-1 text-[11px] font-medium text-[var(--color-crit)]"
                          >
                            <option value="pagado">Pagado</option>
                            <option value="no-pagado">No pagado</option>
                          </select>
                        </td>
                        <td className="px-3 py-2 text-right">
                          <RowActionsMenu
                            items={rowActions(row)}
                            label={`Acciones del pedido ${row.reference}`}
                          />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <Pager
              page={pendingPage}
              onPageChange={setPageNumber}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </section>
        </>
      )}

      {tab === "pagados" && (
        <>
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Mostrando: {summaryLabel}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Kpi
              icon={CheckCircle2}
              label="Cobrado Período"
              value={formatCLP(paidKpisData.cobradoPeriodo)}
              meta={formatMonthDelta(paidDelta.cobrado)}
              tone="text-[var(--color-ok)]"
              sparkline={paidSparkline}
            />
            <Kpi
              icon={Package}
              label="Pedidos Pagados"
              value={String(paidKpisData.pedidosPagados)}
              meta={formatMonthDelta(paidDelta.pedidos)}
            />
            <Kpi
              icon={Receipt}
              label="Ticket Promedio"
              value={formatCLP(paidKpisData.ticketPromedio)}
              meta={formatMonthDelta(paidDelta.ticket)}
            />
          </div>

          <section className="overflow-hidden rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <caption className="sr-only">
                  Facturas pagadas: cliente, fecha de pago, total y documentos
                  asociados
                </caption>
                <thead>
                  <tr className="border-b border-[var(--color-border)] text-left text-[var(--color-text-secondary)]">
                    <th scope="col" className="px-3 py-2 font-medium">
                      ID Pedido
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Cliente
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Proyecto
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Fecha Pago
                    </th>
                    <th
                      scope="col"
                      className="px-3 py-2 text-right font-medium"
                    >
                      Total
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      OC
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Factura
                    </th>
                    <th scope="col" className="px-3 py-2 font-medium">
                      Acción
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {paidRows.length === 0 && (
                    <tr>
                      <td
                        colSpan={8}
                        className="p-8 text-center text-[var(--color-text-secondary)]"
                      >
                        {search
                          ? "Ningún documento coincide con la búsqueda."
                          : "Todavía no hay pagos registrados."}
                      </td>
                    </tr>
                  )}
                  {paidPage.items.map((row) => (
                    <tr
                      key={row.id}
                      className="border-b border-[var(--color-border-soft)]"
                    >
                      <td className="px-3 py-2 font-mono text-[11px]">
                        <a
                          href={`/orders/${row.id}`}
                          className="underline underline-offset-2"
                        >
                          {row.reference}
                        </a>
                      </td>
                      <td className="px-3 py-2">{row.client}</td>
                      <td className="max-w-[200px] truncate px-3 py-2 text-[var(--color-text-secondary)]">
                        {row.project}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px]">
                        {formatDay(row.paidAt)}
                        {/* Before R-03a nothing wrote `date_paid`; those orders show their
                            closing date instead, and say so. */}
                        {row.paidAtSource === "date_completed" && (
                          <span
                            title="Fecha de cierre del pedido: no hay fecha de pago registrada"
                            className="ml-1 font-sans text-[var(--color-text-faint)]"
                          >
                            (cierre)
                          </span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-mono">
                        {formatCLP(row.total)}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.purchaseOrder || "—"}
                      </td>
                      <td className="px-3 py-2 font-mono text-[11px] text-[var(--color-text-secondary)]">
                        {row.invoiceNumber || "—"}
                      </td>
                      <td className="px-3 py-2 text-right">
                        <RowActionsMenu
                          items={rowActions(row)}
                          label={`Acciones del pedido ${row.reference}`}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={paidPage}
              onPageChange={setPageNumber}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
            />
          </section>
        </>
      )}

      {tab === "finanzas" && (
        <div className="space-y-4">
          {/* No filter UI renders on this tab, but `paymentFilter`/`search` set on another tab
              still narrow `pendingRows`/`paidRows` feeding this summary — state above makes that
              carry-over explicit instead of a silently different total. */}
          <p className="text-[11px] text-[var(--color-text-secondary)]">
            Mostrando: {summaryLabel}
          </p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              icon={TrendingUp}
              label="Ingresos Período"
              value={formatCLP(summary.ingresosPeriodo)}
              meta="Facturado, sin cancelados"
            />
            <Kpi
              icon={CheckCircle2}
              label="Cobros Recibidos"
              value={formatCLP(summary.cobrosRecibidos)}
              meta="Reservas incluidas"
              tone="text-[var(--color-ok)]"
            />
            <Kpi
              icon={Clock}
              label="Por Cobrar"
              value={formatCLP(summary.porCobrar)}
              meta="Diferencia"
              tone="text-[var(--color-warn)]"
            />
            <Kpi
              icon={Percent}
              label="Tasa de Cobranza"
              value={`${summary.tasaCobranza}%`}
              meta="Cobrado sobre facturado"
            />
          </div>

          {/* R-03b: the canon's charts, over their own 12-month window. */}
          <FinanceCharts charts={charts ?? null} dueSoon={dueSoonRows} />
        </div>
      )}

      <AlertDialog
        open={confirmation !== null}
        onOpenChange={(open) => {
          if (!open) setConfirmation(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmation?.paid
                ? `¿Marcar ${confirmation.row.reference} como pagado?`
                : `¿Marcar ${confirmation?.row.reference ?? ""} como no pagado?`}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmation?.paid
                ? `Se registra el pago completo de ${formatCLP(confirmation.row.total)} con fecha de hoy y el pedido pasa a Pagados.`
                : "El pedido vuelve a Pendientes con su saldo por cobrar. La reserva queda como está."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={confirmPayment}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <Toaster position="top-right" richColors />
    </div>
  );
}
