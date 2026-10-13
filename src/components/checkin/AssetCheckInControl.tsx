import React, { useState } from "react";
import { toast } from "sonner";
import { apiClient } from "../../services/apiClient";

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
 *
 * R-04: `incidentNote` es la incidencia registrada en la línea (estado + tipo + nota). Se antepone
 * a las notas del check-in, así queda guardada en `asset_movements.condition_notes` de la unidad,
 * que es el único lugar del esquema que hoy sostiene el estado de recepción de un equipo.
 */
export default function AssetCheckInControl({
  productId,
  orderId,
  incidentNote,
}: {
  productId: number;
  orderId: number;
  incidentNote?: string;
}) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<AssetOption[] | null>(null);
  const [loadingOptions, setLoadingOptions] = useState(false);
  const [selectedAssetId, setSelectedAssetId] = useState<number | "">("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  const loadOptions = async () => {
    setOpen(true);
    if (options !== null) return;
    setLoadingOptions(true);
    try {
      const response = await apiClient.get(
        `/api/inventory/assets?product_id=${productId}`,
      );
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
      toast.error("Selecciona un número de serie");
      return;
    }
    setSubmitting(true);
    setResult(null);
    try {
      const response = await apiClient.post("/api/inventory/movements", {
        asset_id: selectedAssetId,
        order_id: orderId,
        direction: "checkin",
        condition_notes:
          [incidentNote?.trim(), notes.trim()].filter(Boolean).join(" — ") ||
          undefined,
      });
      const payload = await response.json();
      if (!response.ok || !payload.success) {
        setResult({
          ok: false,
          message: payload.error || "No se pudo registrar el check-in",
        });
        return;
      }
      setResult({ ok: true, message: "Check-in registrado" });
      toast.success("Check-in registrado");
    } catch (error) {
      setResult({
        ok: false,
        message: error instanceof Error ? error.message : "Error de conexión",
      });
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
        onChange={(e) =>
          setSelectedAssetId(e.target.value ? Number(e.target.value) : "")
        }
        disabled={loadingOptions || (options?.length ?? 0) === 0}
        aria-label="Número de serie"
        className="rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1 text-[11px]"
      >
        <option value="">
          {loadingOptions
            ? "Cargando…"
            : options?.length
              ? "Elige el número de serie"
              : "Sin equipos registrados"}
        </option>
        {(options ?? []).map((asset) => (
          <option key={asset.id} value={asset.id}>
            {asset.serial_number}
          </option>
        ))}
      </select>
      <input
        type="text"
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
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
        {submitting ? "Guardando…" : "Confirmar"}
      </button>
      {result && (
        <span
          className={`text-[11px] ${result.ok ? "text-[var(--color-ok)]" : "text-[var(--color-crit)]"}`}
          role="status"
        >
          {result.message}
        </span>
      )}
    </div>
  );
}
