import React, { useEffect, useState } from "react";
import { formatBusinessDateTimeFull } from "../../lib/businessDay";
import {
  RECEPTION_STATE_OPTIONS,
  isIncidentState,
  type ReceptionState,
} from "../../lib/checkInReception";
import { apiClient } from "../../services/apiClient";

/**
 * R-04b: `orders.return_report` (migration 0018), read-only, in the admin order detail. Written
 * once by "Finalizar devolución"; renders nothing when absent (older orders, or the migration not
 * applied) or when the stored value does not have the expected shape.
 *
 * Loaded on its own from `GET /api/bodega/orders/[id]/report`: `OrderService.getOrderById` names
 * its columns, and adding `return_report` there would break every order page until 0018 is
 * applied.
 */
export default function ReturnReportSummary({ orderId }: { orderId: number }) {
  const [report, setReport] = useState<unknown>(null);

  useEffect(() => {
    let cancelled = false;
    apiClient
      .get(`/api/bodega/orders/${orderId}/report`)
      .then((response) => response.json())
      .then((payload) => {
        if (!cancelled && payload?.success) setReport(payload.data);
      })
      .catch(() => {
        // Read-only extra: a failed load just shows nothing.
      });
    return () => {
      cancelled = true;
    };
  }, [orderId]);

  return <ReturnReportView report={report} />;
}

interface ReturnReportViewProps {
  report: unknown;
}

const STATE_LABEL = Object.fromEntries(
  RECEPTION_STATE_OPTIONS.map((option) => [option.value, option.label]),
) as Record<ReceptionState, string>;

interface StoredLine {
  key?: unknown;
  label?: unknown;
  state?: unknown;
  incident_type?: unknown;
  note?: unknown;
}

export function ReturnReportView({ report }: ReturnReportViewProps) {
  if (!report || typeof report !== "object") return null;
  const { lines, finalized_at } = report as {
    lines?: unknown;
    finalized_at?: unknown;
  };
  if (!Array.isArray(lines) || lines.length === 0) return null;

  return (
    <div className="mt-4 space-y-2">
      <p className="text-sm font-medium">Informe de devolución</p>
      {typeof finalized_at === "string" && (
        <p className="text-xs text-muted-foreground">
          Cerrada el {formatBusinessDateTimeFull(finalized_at)}
        </p>
      )}
      <ul className="space-y-1 text-xs">
        {(lines as StoredLine[]).map((line, index) => {
          const state = String(line.state ?? "") as ReceptionState;
          const incident = isIncidentState(state);
          return (
            <li
              key={String(line.key ?? index)}
              className="flex flex-wrap gap-x-2"
            >
              <span className="font-medium">{String(line.label ?? "")}</span>
              <span
                className={
                  incident
                    ? "text-[var(--color-crit)]"
                    : "text-[var(--color-ok)]"
                }
              >
                {STATE_LABEL[state] ?? state}
              </span>
              {incident && typeof line.incident_type === "string" && (
                <span className="text-muted-foreground">
                  · {line.incident_type}
                </span>
              )}
              {incident && typeof line.note === "string" && line.note && (
                <span className="text-muted-foreground">· {line.note}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
