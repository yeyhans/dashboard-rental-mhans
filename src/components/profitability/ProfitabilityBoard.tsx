import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../services/apiClient";
import { formatCLP } from "../../lib/delivery";
import {
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  type Expense,
  type ExpenseCategory,
} from "../../types/expenses";
import type { ProfitabilityBoard as ProfitabilityBoardData } from "../../services/profitabilityService";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "../ui/tabs";
import { KpiCard } from "../shared/KpiCard";
import { PROFITABILITY_TABS, roiDisplay } from "./profitabilityView";
import {
  Boxes,
  CalendarRange,
  Coins,
  DollarSign,
  Package,
  Receipt,
  ShoppingCart,
  TrendingDown,
  Wallet,
} from "lucide-react";

/**
 * Rentabilidad.
 *
 * Estructura del canónico `MarioHans_OS_Area01_Rentabilidad_Canonical_RC2.1.2.html`: 4 pestañas
 * (D-11, Q-5 resuelta) — Resumen Económico, Gastos Operacionales, Activos e Inversiones e
 * Inteligencia de Activos. "Activos e Inversiones" no tiene fuente de datos (ver
 * `profitabilityView.ts`) y muestra un estado vacío explicativo en vez de cifras inventadas.
 *
 * T-026 (2026-08-23, cableado de UI): Costos Directos, Gastos Operacionales, Margen Bruto,
 * Utilidad Operacional y ROI ahora tienen esquema detrás (`0006_t026_schema_gaps.sql`:
 * `expenses` + `serialised_assets.acquisition_cost`) y se calculan en
 * `profitabilityService.getCosts` — ver el header de `lib/profitability.ts` para la confirmación
 * de fórmula contra el canónico. `data.costs` es `null` mientras esa migración no esté aplicada
 * en la base conectada (requisito 6: degradar con gracia, no romper la página).
 */
interface ProfitabilityBoardProps {
  data: ProfitabilityBoardData;
  periodLabel: string;
}

/** Sección "Registrar Gasto" del canónico. Lista + alta, sobre `/api/expenses`. */
function ExpensesPanel() {
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [state, setState] = useState<"loading" | "error" | "data">("loading");
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    category: EXPENSE_CATEGORIES[0] as ExpenseCategory,
    amount: "",
    expense_date: new Date().toISOString().slice(0, 10),
    notes: "",
  });

  const load = async () => {
    setState("loading");
    try {
      const response = await apiClient.get("/api/expenses?page=1&limit=10");
      const result = await apiClient.handleJsonResponse<{
        success: boolean;
        data: { expenses: Expense[] };
      }>(response);
      setExpenses(result.data.expenses);
      setState("data");
    } catch {
      setState("error");
    }
  };

  useEffect(() => {
    load();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!Number.isFinite(amount) || amount <= 0) {
      toast.error("El monto debe ser mayor a cero");
      return;
    }

    setSaving(true);
    try {
      const response = await apiClient.post("/api/expenses", {
        category: form.category,
        amount,
        expense_date: form.expense_date,
        notes: form.notes.trim() || undefined,
      });
      await apiClient.handleJsonResponse(response);
      toast.success("Gasto registrado");
      setForm((prev) => ({ ...prev, amount: "", notes: "" }));
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "No se pudo registrar el gasto",
      );
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    try {
      const response = await apiClient.delete(`/api/expenses/${id}`);
      await apiClient.handleJsonResponse(response);
      toast.success("Gasto eliminado");
      await load();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "No se pudo eliminar el gasto",
      );
    }
  };

  return (
    <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
      <div className="border-b border-[var(--color-border)] p-4">
        <h2 className="text-sm font-semibold">Registrar Gasto</h2>
        <p className="mt-0.5 text-xs text-[var(--color-text-secondary)]">
          Gastos fijos u operacionales relacionados con la operación
        </p>
      </div>

      <form
        onSubmit={handleSubmit}
        className="grid grid-cols-2 gap-3 border-b border-[var(--color-border)] p-4 sm:grid-cols-4"
      >
        <div className="sm:col-span-1">
          <label
            htmlFor="exp-cat"
            className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
          >
            Categoría
          </label>
          <select
            id="exp-cat"
            value={form.category}
            onChange={(e) =>
              setForm((prev) => ({
                ...prev,
                category: e.target.value as ExpenseCategory,
              }))
            }
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
          >
            {EXPENSE_CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>
                {EXPENSE_CATEGORY_LABELS[cat]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label
            htmlFor="exp-amount"
            className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
          >
            Monto
          </label>
          <input
            id="exp-amount"
            type="number"
            min="0"
            value={form.amount}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, amount: e.target.value }))
            }
            placeholder="$ 0"
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label
            htmlFor="exp-date"
            className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
          >
            Fecha
          </label>
          <input
            id="exp-date"
            type="date"
            value={form.expense_date}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, expense_date: e.target.value }))
            }
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
          />
        </div>
        <div>
          <label
            htmlFor="exp-notes"
            className="mb-1 block text-[11px] font-medium text-[var(--color-text-secondary)]"
          >
            Notas
          </label>
          <input
            id="exp-notes"
            type="text"
            value={form.notes}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, notes: e.target.value }))
            }
            placeholder="Opcional"
            className="w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs"
          />
        </div>
        <div className="col-span-2 sm:col-span-4">
          <button
            type="submit"
            disabled={saving}
            className="rounded-[6px] bg-[var(--color-text-primary)] px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50"
          >
            {saving ? "Guardando…" : "Guardar Gasto"}
          </button>
        </div>
      </form>

      {state === "loading" && (
        <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
          Cargando gastos…
        </p>
      )}
      {state === "error" && (
        <p className="p-6 text-center text-xs text-[var(--color-crit)]">
          No se pudieron cargar los gastos.
        </p>
      )}
      {state === "data" && expenses.length === 0 && (
        <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
          Aún no hay gastos registrados.
        </p>
      )}
      {state === "data" && expenses.length > 0 && (
        <ul className="divide-y divide-[var(--color-border-soft)]">
          {expenses.map((expense) => (
            <li
              key={expense.id}
              className="flex items-center justify-between gap-3 px-4 py-2.5"
            >
              <div className="min-w-0">
                <div className="truncate text-xs font-medium">
                  {EXPENSE_CATEGORY_LABELS[expense.category]}
                </div>
                <div className="text-[11px] text-[var(--color-text-secondary)]">
                  {expense.expense_date}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <span className="whitespace-nowrap font-mono text-xs">
                  {formatCLP(expense.amount)}
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(expense.id)}
                  className="text-[11px] text-[var(--color-crit)] underline underline-offset-2"
                >
                  Eliminar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="text-[11px] text-[var(--color-text-faint)]">
        sin referencia
      </span>
    );
  }
  const up = value >= 0;
  return (
    <span
      className={`text-[11px] ${up ? "text-[var(--color-ok)]" : "text-[var(--color-crit)]"}`}
    >
      {up ? "▲" : "▼"} {Math.abs(value)}% vs. mes anterior
    </span>
  );
}

function monthShort(key: string): string {
  const [, m] = key.split("-");
  return (
    [
      "",
      "Ene",
      "Feb",
      "Mar",
      "Abr",
      "May",
      "Jun",
      "Jul",
      "Ago",
      "Sep",
      "Oct",
      "Nov",
      "Dic",
    ][Number(m)] ?? key
  );
}

export default function ProfitabilityBoard({
  data,
  periodLabel,
}: ProfitabilityBoardProps) {
  const peak = Math.max(1, ...data.series.map((m) => m.ingresos));

  const metrics = [
    {
      label: "Jornadas vendidas",
      value: String(data.current.jornadasVendidas),
      delta: data.deltas.jornadasVendidas,
      icon: CalendarRange,
    },
    {
      label: "Ticket promedio",
      value: formatCLP(data.current.ticketPromedio),
      delta: data.deltas.ticketPromedio,
      icon: ShoppingCart,
    },
    {
      label: "Pedidos realizados",
      value: String(data.current.pedidosRealizados),
      delta: data.deltas.pedidosRealizados,
      icon: Package,
    },
    {
      label: "Equipos utilizados",
      value: String(data.current.equiposUtilizados),
      delta: data.deltas.equiposUtilizados,
      icon: Boxes,
    },
  ];

  return (
    <Tabs defaultValue="resumen" className="space-y-5">
      <TabsList className="flex h-auto w-full flex-wrap justify-start gap-1 bg-transparent p-0">
        {PROFITABILITY_TABS.map((tab) => (
          <TabsTrigger
            key={tab.value}
            value={tab.value}
            className="border border-border data-[state=active]:border-foreground"
          >
            {tab.label}
          </TabsTrigger>
        ))}
      </TabsList>

      <TabsContent value="resumen" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {periodLabel} · {data.diasPeriodo} días
          </span>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <KpiCard
            icon={DollarSign}
            label="Ingresos del Período"
            value={formatCLP(data.current.ingresos)}
            footer={<Delta value={data.deltas.ingresos} />}
          />

          {data.costs === null ? (
            <div className="rounded-[10px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-soft)] p-4">
              <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                Costos, márgenes y utilidad
              </div>
              <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                Costos Directos, Gastos Operacionales, Margen Bruto, Utilidad
                Operacional y ROI por activo todavía no están disponibles: la
                migración que agrega <code>expenses</code> y el costo de
                adquisición de los equipos no se ha aplicado en esta base de
                datos.
              </p>
            </div>
          ) : (
            <KpiCard
              icon={Coins}
              label="Margen Bruto"
              value={formatCLP(data.costs.margenBruto.margin)}
              footer={
                data.costs.margenBruto.marginPercentage === null
                  ? "sin referencia"
                  : `${Math.round(data.costs.margenBruto.marginPercentage * 10) / 10}% de los ingresos`
              }
            />
          )}
        </div>

        {data.costs !== null && (
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <KpiCard
              icon={Receipt}
              label="Costos Directos"
              value={formatCLP(data.costs.costosDirectos)}
            />
            <KpiCard
              icon={Wallet}
              label="Gastos Operacionales"
              value={formatCLP(data.costs.gastosOperacionales)}
            />
            <KpiCard
              icon={TrendingDown}
              label="Utilidad Operacional"
              value={
                <span
                  className={
                    data.costs.utilidadOperacional.margin < 0
                      ? "text-[var(--color-crit)]"
                      : undefined
                  }
                >
                  {formatCLP(data.costs.utilidadOperacional.margin)}
                </span>
              }
            />
            {(() => {
              const roi = roiDisplay(data.costs.roiPromedioActivos);
              return roi === null ? (
                <div className="rounded-[10px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-soft)] p-4">
                  <div className="text-xs font-medium text-[var(--color-text-secondary)]">
                    ROI promedio activos
                  </div>
                  <p className="mt-1.5 text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
                    Sin costo de adquisición registrado para los equipos del
                    catálogo: no hay base para calcular el ROI.
                  </p>
                </div>
              ) : (
                <KpiCard
                  icon={Boxes}
                  label="ROI promedio activos"
                  value={roi}
                />
              );
            })()}
          </div>
        )}

        <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">
            Evolución de ingresos (12 meses)
          </h2>
          <div
            className="flex h-40 items-end gap-1.5"
            role="img"
            aria-label="Ingresos de los últimos doce meses"
          >
            {data.series.map((month) => (
              <div
                key={month.month}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t-sm bg-[var(--color-text-primary)]"
                  style={{
                    height: `${Math.round((month.ingresos / peak) * 100)}%`,
                    minHeight: month.ingresos > 0 ? "2px" : "0",
                  }}
                  title={`${monthShort(month.month)}: ${formatCLP(month.ingresos)}`}
                />
                <span className="text-[9px] text-[var(--color-text-faint)]">
                  {monthShort(month.month)}
                </span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Ingresos por mes</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Ingresos</th>
                <th scope="col">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{formatCLP(month.ingresos)}</td>
                  <td>{month.pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {metrics.map((metric) => (
            <KpiCard
              key={metric.label}
              icon={metric.icon}
              label={metric.label}
              value={metric.value}
              footer={<Delta value={metric.delta} />}
            />
          ))}
        </div>
      </TabsContent>

      <TabsContent value="gastos">
        <ExpensesPanel />
      </TabsContent>

      <TabsContent value="activos">
        <div className="rounded-[10px] border border-dashed border-[var(--color-border-strong)] bg-[var(--color-surface-soft)] p-6 text-center">
          <p className="text-sm font-medium text-[var(--color-text-secondary)]">
            Activos e Inversiones no tiene fuente de datos todavía
          </p>
          <p className="mx-auto mt-1.5 max-w-md text-[11px] leading-relaxed text-[var(--color-text-secondary)]">
            El canónico no define un cálculo para esta pestaña (sin catálogo de
            inversiones ni vinculación entre pedidos y activos individuales) y
            esta vista no inventa cifras. Se deja como estado vacío hasta que
            exista un requisito y un esquema detrás.
          </p>
        </div>
      </TabsContent>

      <TabsContent value="inteligencia" className="space-y-4">
        <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] p-4">
          <h2 className="mb-4 text-sm font-semibold">
            Evolución de ingresos (12 meses)
          </h2>
          <div
            className="flex h-40 items-end gap-1.5"
            role="img"
            aria-label="Ingresos de los últimos doce meses"
          >
            {data.series.map((month) => (
              <div
                key={month.month}
                className="flex flex-1 flex-col items-center gap-1"
              >
                <div
                  className="w-full rounded-t-sm bg-[var(--color-text-primary)]"
                  style={{
                    height: `${Math.round((month.ingresos / peak) * 100)}%`,
                    minHeight: month.ingresos > 0 ? "2px" : "0",
                  }}
                  title={`${monthShort(month.month)}: ${formatCLP(month.ingresos)}`}
                />
                <span className="text-[9px] text-[var(--color-text-faint)]">
                  {monthShort(month.month)}
                </span>
              </div>
            ))}
          </div>
          <table className="sr-only">
            <caption>Ingresos por mes</caption>
            <thead>
              <tr>
                <th scope="col">Mes</th>
                <th scope="col">Ingresos</th>
                <th scope="col">Pedidos</th>
              </tr>
            </thead>
            <tbody>
              {data.series.map((month) => (
                <tr key={month.month}>
                  <td>{month.month}</td>
                  <td>{formatCLP(month.ingresos)}</td>
                  <td>{month.pedidos}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <div className="grid gap-4 lg:grid-cols-2">
          <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 className="border-b border-[var(--color-border)] p-4 text-sm font-semibold">
              Equipos que más facturaron
            </h2>
            {data.rotation.length === 0 ? (
              <p className="p-6 text-center text-xs text-[var(--color-text-secondary)]">
                No hay arriendos registrados en el período.
              </p>
            ) : (
              <ol className="divide-y divide-[var(--color-border-soft)]">
                {data.rotation.slice(0, 10).map((asset, index) => (
                  <li
                    key={asset.productId}
                    className="flex items-center gap-3 px-4 py-2"
                  >
                    <span className="w-5 font-mono text-[11px] text-[var(--color-text-faint)]">
                      {index + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-xs">
                      {asset.name}
                    </span>
                    <span className="whitespace-nowrap text-[11px] text-[var(--color-text-secondary)]">
                      {asset.rentals}{" "}
                      {asset.rentals === 1 ? "arriendo" : "arriendos"}
                    </span>
                    <span className="whitespace-nowrap font-mono text-xs">
                      {formatCLP(asset.revenue)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>

          <section className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]">
            <h2 className="border-b border-[var(--color-border)] p-4 text-sm font-semibold">
              Atención: equipos sin uso en el período
            </h2>
            {data.idle.length === 0 ? (
              <p className="p-6 text-center text-xs text-[var(--color-ok)]">
                Todo el catálogo publicado facturó al menos una vez.
              </p>
            ) : (
              <>
                <p className="px-4 pt-3 text-[11px] text-[var(--color-text-secondary)]">
                  {data.idle.length}{" "}
                  {data.idle.length === 1
                    ? "equipo publicado no facturó"
                    : "equipos publicados no facturaron"}{" "}
                  nada este período. Es capital detenido.
                </p>
                <ul className="mt-2 max-h-64 divide-y divide-[var(--color-border-soft)] overflow-y-auto">
                  {data.idle.map((asset) => (
                    <li key={asset.id} className="px-4 py-2 text-xs">
                      {asset.name}
                    </li>
                  ))}
                </ul>
              </>
            )}
          </section>
        </div>
      </TabsContent>
    </Tabs>
  );
}
