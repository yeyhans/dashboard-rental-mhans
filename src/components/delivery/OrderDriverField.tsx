import React, { useCallback, useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { DRIVER_NAME_MAX_LENGTH } from "../../lib/delivery";
import { apiClient } from "../../services/apiClient";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";

/**
 * R-06: assign the driver (conductor) of an order's shipment from the order edit screen.
 *
 * Free text with suggestions from drivers already used (`<datalist>`), saved on its own through
 * `PUT /api/delivery/orders/[orderId]/driver` — it does not ride on the order's main "Guardar",
 * because the driver lives in `shipping_usage`, not in `orders`. The server validates (trim, at
 * most 80 characters) and explains when the order has no shipment yet or migration 0017 is not
 * applied; those messages are shown verbatim.
 */
interface OrderDriverFieldProps {
  orderId: number;
}

type Feedback = { tone: "ok" | "error"; message: string } | null;

export default function OrderDriverField({ orderId }: OrderDriverFieldProps) {
  const inputId = `order-driver-${orderId}`;
  const listId = `${inputId}-options`;
  const [value, setValue] = useState("");
  const [saved, setSaved] = useState("");
  const [knownDrivers, setKnownDrivers] = useState<string[]>([]);
  const [hasShipment, setHasShipment] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<Feedback>(null);

  // An unsaved edit survives a background reload (H-2): only a clean field is overwritten.
  const dirtyRef = useRef(false);
  dirtyRef.current = value.trim() !== saved;
  const aliveRef = useRef(true);
  // H-3: focus reloads can overlap; only the latest one may write state.
  const loadSeq = useRef(0);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    const isCurrent = () => aliveRef.current && seq === loadSeq.current;
    try {
      const response = await apiClient.get(
        `/api/delivery/orders/${orderId}/driver`,
      );
      const payload = await response.json().catch(() => null);
      if (!aliveRef.current || seq !== loadSeq.current) return;
      if (!response.ok || !payload?.success) {
        setFeedback({
          tone: "error",
          message: payload?.error || "No se pudo cargar el conductor.",
        });
        return;
      }
      const current = payload.data.driverName ?? "";
      if (!dirtyRef.current) setValue(current);
      setSaved(current);
      setKnownDrivers(payload.data.knownDrivers ?? []);
      setHasShipment(payload.data.shipmentId !== null);
      // A good reload clears an earlier load error; a "guardado" message stays.
      setFeedback((prev) => (prev?.tone === "error" ? null : prev));
    } catch {
      if (isCurrent())
        setFeedback({ tone: "error", message: "Error de conexión." });
    } finally {
      if (isCurrent()) setLoading(false);
    }
  }, [orderId]);

  useEffect(() => {
    aliveRef.current = true;
    void load();
    // H-2: the shipment row appears when the order is saved with a shipping method, often in
    // another tab or after a reload; "no shipment yet" must not stick, so re-check on focus.
    const onFocus = () => void load();
    window.addEventListener("focus", onFocus);
    return () => {
      aliveRef.current = false;
      window.removeEventListener("focus", onFocus);
    };
  }, [load]);

  const handleSave = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const response = await apiClient.put(
        `/api/delivery/orders/${orderId}/driver`,
        { driver_name: value },
      );
      const payload = await response.json().catch(() => null);
      if (!response.ok || !payload?.success) {
        setFeedback({
          tone: "error",
          message: payload?.error || "No se pudo guardar el conductor.",
        });
        return;
      }
      const stored = payload.data.driverName ?? "";
      setValue(stored);
      setSaved(stored);
      setFeedback({
        tone: "ok",
        message: stored ? "Conductor guardado." : "Conductor quitado.",
      });
    } catch {
      setFeedback({ tone: "error", message: "Error de conexión." });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId} className="text-sm font-medium text-gray-700">
        Conductor
      </Label>
      <div className="flex gap-2">
        <Input
          id={inputId}
          list={listId}
          value={value}
          maxLength={DRIVER_NAME_MAX_LENGTH}
          onChange={(e) => setValue(e.target.value)}
          placeholder={loading ? "Cargando…" : "Nombre del conductor"}
          disabled={loading || saving || !hasShipment}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          onClick={handleSave}
          disabled={loading || saving || !hasShipment || value.trim() === saved}
        >
          {saving ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            "Guardar conductor"
          )}
        </Button>
      </div>
      <datalist id={listId}>
        {knownDrivers.map((name) => (
          <option key={name} value={name} />
        ))}
      </datalist>
      {!loading && !hasShipment && (
        <p className="text-xs text-muted-foreground">
          Guarda el pedido con un método de delivery para poder asignar
          conductor.{" "}
          <button
            type="button"
            onClick={() => void load()}
            className="underline underline-offset-2"
          >
            Volver a comprobar
          </button>
        </p>
      )}
      {feedback && (
        <p
          role="status"
          className={`text-xs ${feedback.tone === "ok" ? "text-[var(--color-ok)]" : "text-[var(--color-crit)]"}`}
        >
          {feedback.message}
        </p>
      )}
    </div>
  );
}
