import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../../ui/dialog";
import type { InventoryUnitView } from "../../../services/serialisedAssetService";
import { indentedLabel, type LocationOption } from "./locationOptions";

export interface RelocateUnitDialogProps {
  unit: InventoryUnitView | null;
  locationOptions: LocationOption[];
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the move was saved. */
  onSubmit: (unit: InventoryUnitView, toLocationId: string, notes: string) => Promise<boolean>;
}

const CONTROL =
  "w-full rounded-[6px] border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#111111] outline-none focus-visible:border-[#111111] focus-visible:ring-1 focus-visible:ring-[#111111]";

/** "Reubicar": pick the destination and leave a note in the move log (asset_relocations). */
export function RelocateUnitDialog({ unit, locationOptions, onOpenChange, onSubmit }: RelocateUnitDialogProps) {
  const [target, setTarget] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    setTarget("");
    setNotes("");
    setError(null);
  }, [unit?.id]);

  if (!unit) return null;
  const choices = locationOptions.filter((option) => option.id !== unit.location_id);
  const current = unit.location_detail ? `${unit.location_detail.code} · ${unit.location_detail.name}` : unit.location || "Sin ubicación";

  const handleSubmit = async () => {
    if (!target) {
      setError("Debes indicar la ubicación de destino");
      return;
    }
    setIsSubmitting(true);
    try {
      if (await onSubmit(unit, target, notes)) onOpenChange(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(next) => !isSubmitting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Reubicar {unit.asset_tag}</DialogTitle>
          <DialogDescription>Ahora en: {current}</DialogDescription>
        </DialogHeader>
        {choices.length === 0 ? (
          <p className="text-[13px] text-[#666666]">
            No hay otras ubicaciones activas. Créalas en <a className="underline" href="/inventory/ubicaciones">Ubicaciones de bodega</a>.
          </p>
        ) : (
          <form
            noValidate
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void handleSubmit();
            }}
          >
            <div className="space-y-1.5">
              <label htmlFor="relocate-target" className="block text-[12px] font-medium">
                Nueva ubicación
              </label>
              <select
                id="relocate-target"
                className={CONTROL}
                value={target}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? "relocate-target-error" : undefined}
                onChange={(event) => {
                  setTarget(event.target.value);
                  setError(null);
                }}
              >
                <option value="">Elige una ubicación…</option>
                {choices.map((option) => (
                  <option key={option.id} value={option.id}>
                    {indentedLabel(option)}
                  </option>
                ))}
              </select>
              {error && (
                <p id="relocate-target-error" className="text-[11px] text-[#A3271F]">
                  {error}
                </p>
              )}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="relocate-notes" className="block text-[12px] font-medium">
                Nota (opcional)
              </label>
              <input
                id="relocate-notes"
                className={CONTROL}
                value={notes}
                maxLength={300}
                placeholder="Ej: vuelve de mantención"
                onChange={(event) => setNotes(event.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" disabled={isSubmitting} onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Reubicar
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default RelocateUnitDialog;
