import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../../ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../../ui/alert-dialog";
import type { InventoryUnitView } from "../../../services/serialisedAssetService";
import { UnitsTable } from "./UnitsTable";
import { BulkUnitsDialog } from "./BulkUnitsDialog";
import { RelocateUnitDialog } from "./RelocateUnitDialog";
import { buildLabelsHref, saveUnitEdit, type UnitChanges } from "./unitEdits";
import { flattenLocationTree, type LocationOption } from "./locationOptions";
import { createUnitsApi, type BulkUnitsPayload } from "./unitsApi";
import type { BulkUnitsFormMode } from "./bulkUnitsForm";
import type { InventoryUnit } from "../../../types/inventory";

export interface ProductInventoryTabProps {
  productId: number;
  productName: string;
  accessToken?: string | undefined;
}

const CONFLICT_HINT = "Recargamos la lista con los datos actuales; revisa y vuelve a intentarlo.";

/** Keeps the derived view fields (status, order, location detail) when the server returns a plain unit. */
function mergeUnit(view: InventoryUnitView, fresh: InventoryUnit): InventoryUnitView {
  const status = view.status === "in_rental" && fresh.condition !== "retired" ? "in_rental" : fresh.condition;
  return {
    ...view,
    ...fresh,
    status,
    // After a move the select shows the new `location_id`; the detail is only a fallback label.
    location_detail: fresh.location_id === view.location_id ? view.location_detail : null,
  };
}

/**
 * Ficha › Inventario (canon RC2.1.3): the physical units of one catalog product. Every write sends
 * the row_version it read; a 409 CONFLICT reloads the list instead of overwriting someone else.
 */
export function ProductInventoryTab({ productId, productName, accessToken }: ProductInventoryTabProps) {
  const api = useMemo(() => createUnitsApi({ accessToken }), [accessToken]);
  const [units, setUnits] = useState<InventoryUnitView[]>([]);
  const [locationOptions, setLocationOptions] = useState<LocationOption[]>([]);
  const [state, setState] = useState<"loading" | "error" | "ready">("loading");
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<ReadonlySet<number>>(new Set());
  const [bulkMode, setBulkMode] = useState<BulkUnitsFormMode | null>(null);
  const [relocating, setRelocating] = useState<InventoryUnitView | null>(null);
  const [archiving, setArchiving] = useState<InventoryUnitView | null>(null);
  const [formKey, setFormKey] = useState(0);

  const load = useCallback(
    async (options: { isQuiet?: boolean } = {}) => {
      if (!options.isQuiet) setState("loading");
      const [unitsResult, treeResult] = await Promise.all([api.listUnits(productId), api.listLocationTree()]);
      if (!unitsResult.ok) {
        setLoadError(unitsResult.error);
        setState("error");
        return;
      }
      setUnits(unitsResult.data.units.filter((unit) => unit.condition !== "retired"));
      // Without the warehouse map the tab still works: the legacy location text stays editable on intake.
      setLocationOptions(treeResult.ok ? flattenLocationTree(treeResult.data.tree) : []);
      setLoadError(null);
      setState("ready");
    },
    [api, productId],
  );

  useEffect(() => {
    void load();
  }, [load]);

  const setBusy = (id: number, isBusy: boolean) =>
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (isBusy) next.add(id);
      else next.delete(id);
      return next;
    });

  const replaceUnit = (view: InventoryUnitView, fresh: InventoryUnit) =>
    setUnits((prev) => prev.map((unit) => (unit.id === view.id ? mergeUnit(unit, fresh) : unit)));

  /** Remounts the inline inputs so a rejected value snaps back to the stored one. */
  const resetInputs = () => setFormKey((key) => key + 1);

  const handleConflict = (message: string) => {
    toast.error(message, { description: CONFLICT_HINT });
    void load({ isQuiet: true });
  };

  const handleCommit = async (unit: InventoryUnitView, changes: UnitChanges) => {
    setBusy(unit.id, true);
    try {
      const outcome = await saveUnitEdit(api, unit, changes);
      if (outcome.kind === "saved") {
        replaceUnit(unit, outcome.unit);
        toast.success(`${unit.asset_tag} actualizada`);
      } else if (outcome.kind === "conflict") {
        handleConflict(outcome.message);
      } else if (outcome.kind === "error") {
        toast.error(outcome.message);
        resetInputs();
      }
    } finally {
      setBusy(unit.id, false);
    }
  };

  const relocate = async (unit: InventoryUnitView, toLocationId: string, notes?: string): Promise<boolean> => {
    setBusy(unit.id, true);
    try {
      const result = await api.relocateUnit(unit, toLocationId, notes);
      if (result.ok) {
        replaceUnit(unit, result.data.unit);
        toast.success(`${unit.asset_tag} reubicada`, { description: result.data.unit.location });
        return true;
      }
      if (result.isConflict) handleConflict(result.error);
      else {
        toast.error(result.error);
        resetInputs();
      }
      return false;
    } finally {
      setBusy(unit.id, false);
    }
  };

  const archive = async (unit: InventoryUnitView) => {
    setBusy(unit.id, true);
    try {
      const result = await api.archiveUnit(unit);
      if (result.ok) {
        setUnits((prev) => prev.filter((candidate) => candidate.id !== unit.id));
        toast.success(`${unit.asset_tag} archivada`);
      } else if (result.isConflict) handleConflict(result.error);
      else toast.error(result.error);
    } finally {
      setBusy(unit.id, false);
      setArchiving(null);
    }
  };

  const createUnits = async (payload: BulkUnitsPayload): Promise<boolean> => {
    const result = await api.bulkCreate(productId, payload);
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    const tags = result.data.units.map((unit) => unit.asset_tag);
    toast.success(tags.length === 1 ? `Unidad ${tags[0]} agregada` : `${tags.length} unidades agregadas`, {
      description: tags.length > 1 ? `${tags[0]} a ${tags[tags.length - 1]}` : undefined,
    });
    await load({ isQuiet: true });
    return true;
  };

  if (state === "loading") {
    return (
      <div className="flex items-center justify-center py-12" role="status">
        <Loader2 className="h-6 w-6 animate-spin text-[#666666]" aria-hidden="true" />
        <span className="sr-only">Cargando unidades…</span>
      </div>
    );
  }

  if (state === "error") {
    return (
      <div className="rounded-[8px] border border-[#EAEAEA] bg-white px-5 py-10 text-center">
        <p className="mb-1 text-[13px] font-medium text-[#A3271F]">No pudimos cargar las unidades</p>
        <p className="mb-4 text-[12px] text-[#666666]">{loadError}</p>
        <Button variant="outline" size="sm" onClick={() => void load()}>
          Reintentar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {locationOptions.length === 0 && (
        <p className="flex items-center gap-2 rounded-[6px] border border-[#EAEAEA] bg-[#F7F7F6] px-3 py-2 text-[12px] text-[#666666]">
          <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>
            El plano de bodega aún no tiene ubicaciones.{" "}
            <a href="/inventory/ubicaciones" className="font-medium text-[#111111] underline-offset-2 hover:underline">
              Configurar ubicaciones
            </a>
          </span>
        </p>
      )}

      <UnitsTable
        units={units}
        locationOptions={locationOptions}
        busyIds={busyIds}
        formKey={formKey}
        onCommit={(unit, changes) => void handleCommit(unit, changes)}
        onRelocate={(unit, locationId) => void relocate(unit, locationId)}
        onRequestRelocate={setRelocating}
        onArchive={setArchiving}
        onAddUnit={() => setBulkMode("single")}
        onAddMany={() => setBulkMode("many")}
        labelsHref={buildLabelsHref(units)}
      />

      <BulkUnitsDialog
        open={bulkMode !== null}
        mode={bulkMode ?? "single"}
        productName={productName}
        locationOptions={locationOptions}
        onOpenChange={(open) => !open && setBulkMode(null)}
        onSubmit={createUnits}
      />

      <RelocateUnitDialog
        unit={relocating}
        locationOptions={locationOptions}
        onOpenChange={(open) => !open && setRelocating(null)}
        onSubmit={(unit, target, notes) => relocate(unit, target, notes)}
      />

      <AlertDialog open={archiving !== null} onOpenChange={(open) => !open && setArchiving(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Archivar {archiving?.asset_tag}</AlertDialogTitle>
            <AlertDialogDescription>
              La unidad deja de contar en el stock y no se puede arrendar. Su historial de movimientos se conserva.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-[#A3271F] text-white hover:bg-[#A3271F]/90"
              onClick={() => archiving && void archive(archiving)}
            >
              Archivar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

export default ProductInventoryTab;
