import React, { useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { operatorNextStatus } from "../../lib/operatorOrderStatus";
import { statusLabel } from "../../lib/orderStatus";
import { apiClient } from "../../services/apiClient";

/**
 * The order's status on the bodega sheet, with the one forward step the operator may take
 * (`lib/operatorOrderStatus.ts`: confirmed -> preparation -> in-rental -> return). The server
 * enforces the same allowlist; this only hides what it would refuse. Two taps (ask, then confirm)
 * so a pocket tap cannot move an order.
 */
interface BodegaOrderStatusProps {
  orderId: number;
  initialStatus: string | null;
}

export default function BodegaOrderStatus({
  orderId,
  initialStatus,
}: BodegaOrderStatusProps) {
  const [status, setStatus] = useState<string | null>(initialStatus);
  const [confirming, setConfirming] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const next = operatorNextStatus(status);

  const advance = async () => {
    if (!next) return;
    setSaving(true);
    setError(null);
    try {
      const response = await apiClient.put(`/api/orders/${orderId}/status`, {
        status: next,
      });
      const body = await response.json().catch(() => null);
      if (!response.ok || !body?.success) {
        setError(
          body?.error || "No se pudo cambiar el estado. Intenta de nuevo.",
        );
        return;
      }
      setStatus(next);
      setConfirming(false);
    } catch {
      setError(
        "No se pudo cambiar el estado. Revisa la conexión e intenta de nuevo.",
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2 pt-1">
      <p className="text-sm">
        Estado:{" "}
        <span className="font-medium">
          {status ? statusLabel(status) : "Sin estado"}
        </span>
      </p>

      {next &&
        (confirming ? (
          <div className="flex gap-2">
            <button
              type="button"
              onClick={advance}
              disabled={saving}
              className="flex min-h-[44px] flex-1 items-center justify-center gap-2 rounded-[10px] bg-[var(--color-text,#111)] px-3 text-sm font-medium text-white disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowRight className="h-4 w-4" />
              )}
              Confirmar: pasar a {statusLabel(next)}
            </button>
            <button
              type="button"
              onClick={() => setConfirming(false)}
              disabled={saving}
              className="min-h-[44px] rounded-[10px] border border-[var(--color-border,#EAEAEA)] px-3 text-sm"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="flex min-h-[44px] w-full items-center justify-center gap-2 rounded-[10px] border border-[var(--color-border,#EAEAEA)] px-3 text-sm font-medium"
          >
            <ArrowRight className="h-4 w-4" />
            Pasar a {statusLabel(next)}
          </button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-[var(--color-crit)]">
          {error}
        </p>
      )}
    </div>
  );
}
