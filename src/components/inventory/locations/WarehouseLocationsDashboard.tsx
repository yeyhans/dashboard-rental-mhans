import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Toaster, toast } from "sonner";
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
import { buildLocationTree, describeLocation, type LocationTreeNode } from "../../../lib/warehouseLocations";
import {
  LOCATION_KIND_LABELS_ES,
  ROTATIONS_DEG,
  WALL_LABELS_ES,
  type Wall,
  type WarehouseLocation,
} from "../../../types/inventory";
import { WarehousePlan } from "./WarehousePlan";
import {
  MAX_SHELF_LEVELS,
  buildLocationDraft,
  formatMetres,
  planItems,
  suggestLocationCode,
  type NewLocationForm,
  type NewLocationKind,
  type PlanPoint,
} from "./locationPlan";
import { createLocationWithLevels, createLocationsApi } from "./locationsApi";

export interface WarehouseLocationsDashboardProps {
  initialLocations: WarehouseLocation[];
  /** Units per `location_id`; `null` when the page could not count them. */
  unitCounts: Record<string, number> | null;
  loadError?: string | null;
}

const CONTROL =
  "w-full rounded-[6px] border border-[#EAEAEA] bg-white px-2.5 py-1.5 text-[12.5px] text-[#111111] outline-none focus-visible:border-[#111111] focus-visible:ring-1 focus-visible:ring-[#111111]";
const LABEL = "mb-1 block text-[11px] font-medium text-[#666666]";
const PANEL = "rounded-[8px] border border-[#EAEAEA] bg-white p-4";
const PANEL_TITLE = "mb-3 text-[13px] font-semibold text-[#111111]";

const NEW_KINDS: NewLocationKind[] = ["shelf", "box", "floor"];
const WALL_CHOICES: Wall[] = ["N", "E", "S", "W", "C"];
const SAVE_DELAY_MS = 400;

function emptyForm(existingCodes: string[]): NewLocationForm {
  return { kind: "shelf", wall: "N", code: suggestLocationCode("N", "shelf", existingCodes), name: "", levels: "3" };
}

/**
 * Admin editor of the warehouse map (top view of the ~5 x 5 m room). Positions save themselves a
 * moment after a drag or the last arrow press; every write carries the row_version it read.
 */
export function WarehouseLocationsDashboard({ initialLocations, unitCounts, loadError }: WarehouseLocationsDashboardProps) {
  const api = useMemo(() => createLocationsApi(), []);
  const [locations, setLocations] = useState<WarehouseLocation[]>(initialLocations);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState<NewLocationForm>(() => emptyForm(initialLocations.map((l) => l.code)));
  const [boxParentId, setBoxParentId] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [edit, setEdit] = useState<{ code: string; name: string; width: string; depth: string; rotation: string } | null>(null);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [confirmDeactivate, setConfirmDeactivate] = useState<WarehouseLocation | null>(null);
  const [showInactive, setShowInactive] = useState(false);

  const locationsRef = useRef(locations);
  locationsRef.current = locations;
  const timers = useRef(new Map<string, ReturnType<typeof setTimeout>>());
  const queue = useRef<Promise<unknown>>(Promise.resolve());

  const active = useMemo(() => locations.filter((l) => l.is_active), [locations]);
  const items = useMemo(() => planItems(locations, unitCounts), [locations, unitCounts]);
  const tree = useMemo(() => buildLocationTree(showInactive ? locations : active), [locations, active, showInactive]);
  const selected = locations.find((l) => l.id === selectedId) ?? null;

  useEffect(() => {
    setEdit(
      selected
        ? {
            code: selected.code,
            name: selected.name,
            width: selected.width?.toString() ?? "",
            depth: selected.depth?.toString() ?? "",
            rotation: String(selected.rotation_deg),
          }
        : null,
    );
    // Reset the editor only when another location is picked or the stored row changes.
  }, [selected?.id, selected?.row_version]); // eslint-disable-line react-hooks/exhaustive-deps

  const reload = useCallback(async () => {
    const result = await api.list();
    if (result.ok) setLocations(result.data.locations);
    else toast.error(result.error);
  }, [api]);

  const replace = (fresh: WarehouseLocation) => setLocations((prev) => prev.map((l) => (l.id === fresh.id ? fresh : l)));

  const showWarnings = (warnings: string[]) => {
    if (warnings.length > 0) toast.warning("Revisa la posición", { description: warnings.join(". ") });
  };

  const persistPosition = (id: string) => {
    queue.current = queue.current.then(async () => {
      const current = locationsRef.current.find((l) => l.id === id);
      if (!current || current.pos_x === null || current.pos_y === null) return;
      const result = await api.move(current, { x: current.pos_x, y: current.pos_y });
      if (result.ok) {
        // Keep the latest local position if the user kept moving while this request was in flight.
        setLocations((prev) =>
          prev.map((l) => (l.id === id ? { ...result.data.location, pos_x: l.pos_x, pos_y: l.pos_y } : l)),
        );
        showWarnings(result.data.warnings);
      } else {
        toast.error(result.error, result.isConflict ? { description: "Recargamos el plano con los datos actuales." } : undefined);
        await reload();
      }
    });
  };

  const handleMove = (id: string, position: PlanPoint) => {
    setLocations((prev) => prev.map((l) => (l.id === id ? { ...l, pos_x: position.x, pos_y: position.y } : l)));
    const pending = timers.current.get(id);
    if (pending) clearTimeout(pending);
    timers.current.set(
      id,
      setTimeout(() => {
        timers.current.delete(id);
        persistPosition(id);
      }, SAVE_DELAY_MS),
    );
  };

  useEffect(() => {
    const pending = timers.current;
    return () => pending.forEach((timer) => clearTimeout(timer));
  }, []);

  const updateForm = (changes: Partial<NewLocationForm>) =>
    setForm((prev) => {
      const next = { ...prev, ...changes };
      // Keep suggesting the code until the admin types their own.
      const previousSuggestion = suggestLocationCode(prev.wall, prev.kind, locations.map((l) => l.code));
      if ((changes.wall || changes.kind) && prev.code === previousSuggestion) {
        next.code = suggestLocationCode(next.wall, next.kind, locations.map((l) => l.code));
      }
      return next;
    });

  const boxParents = active.filter((l) => l.kind === "shelf" || l.kind === "level" || l.kind === "floor" || l.kind === "rug");

  const handleCreate = async () => {
    const built = buildLocationDraft(form);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }
    const draft: Record<string, unknown> & { code: string } =
      form.kind === "box" && boxParentId
        ? { ...built.draft, parent_id: boxParentId, pos_x: null, pos_y: null }
        : { ...built.draft };

    setIsCreating(true);
    try {
      const result = await createLocationWithLevels(api, draft, built.levels);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      if (result.failedLevel) toast.error(`No se creó ${result.failedLevel.code}`, { description: result.failedLevel.error });
      else toast.success(result.created > 1 ? `${draft.code} creado con ${result.created - 1} niveles` : `${draft.code} creado`);
      showWarnings(result.warnings);
      await reload();
      setForm((prev) => ({ ...prev, name: "", code: "" }));
    } finally {
      setIsCreating(false);
    }
  };

  useEffect(() => {
    // After a reload the suggested code moves on to the next free number.
    setForm((prev) => (prev.code ? prev : { ...prev, code: suggestLocationCode(prev.wall, prev.kind, locations.map((l) => l.code)) }));
  }, [locations]);

  const handleSaveEdit = async () => {
    if (!selected || !edit) return;
    const toNumber = (value: string) => (value.trim() === "" ? null : Number(value.replace(",", ".")));
    setIsSavingEdit(true);
    try {
      const result = await api.update(selected, {
        code: edit.code,
        name: edit.name,
        width: toNumber(edit.width),
        depth: toNumber(edit.depth),
        rotation_deg: Number(edit.rotation),
      });
      if (result.ok) {
        replace(result.data.location);
        toast.success("Ubicación actualizada");
        showWarnings(result.data.warnings);
      } else {
        toast.error(result.error);
        if (result.isConflict) await reload();
      }
    } finally {
      setIsSavingEdit(false);
    }
  };

  const handleDeactivate = async (location: WarehouseLocation) => {
    const result = await api.deactivate(location);
    setConfirmDeactivate(null);
    if (result.ok) {
      replace(result.data.location);
      setSelectedId(null);
      toast.success(`${location.code} desactivada`);
    } else {
      toast.error(result.error);
      if (result.isConflict) await reload();
    }
  };

  const countFor = (node: LocationTreeNode): string => {
    if (!unitCounts) return "";
    const total = (n: LocationTreeNode): number => (unitCounts[n.id] ?? 0) + n.children.reduce((sum, c) => sum + total(c), 0);
    const value = total(node);
    return value === 1 ? "1 unidad" : `${value} unidades`;
  };

  const renderTree = (nodes: LocationTreeNode[], depth: number) =>
    nodes.map((node) => (
      <li key={node.id}>
        <button
          type="button"
          onClick={() => setSelectedId(node.id)}
          aria-current={node.id === selectedId ? "true" : undefined}
          className={`flex w-full items-center justify-between gap-2 rounded-[6px] px-2 py-1.5 text-left text-[12.5px] hover:bg-[#F7F7F6] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111] ${
            node.id === selectedId ? "bg-[#F7F7F6] font-medium" : ""
          } ${node.is_active ? "" : "text-[#707070] line-through"}`}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
        >
          <span className="min-w-0 truncate">
            <span className="font-mono text-[12px]">{node.code}</span> <span className="text-[#666666]">{node.name}</span>
          </span>
          <span className="shrink-0 text-[11px] text-[#666666]">
            {LOCATION_KIND_LABELS_ES[node.kind]}
            {countFor(node) && ` · ${countFor(node)}`}
          </span>
        </button>
        {node.children.length > 0 && <ul>{renderTree(node.children, depth + 1)}</ul>}
      </li>
    ));

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-[-0.02em] text-[#111111]">Ubicaciones de bodega</h1>
        <p className="text-[13px] text-[#666666]">
          Plano de la bodega de 5 x 5 m: estantes, cajas y espacios de piso en los cuatro muros, con la alfombra al centro.
        </p>
      </div>

      {loadError && (
        <div role="alert" className="rounded-[8px] border border-[#A3271F]/30 bg-[#FBEEEC] px-4 py-3 text-[13px] text-[#A3271F]">
          {loadError}
        </div>
      )}
      {unitCounts === null && !loadError && (
        <p className="rounded-[6px] border border-[#EAEAEA] bg-[#F7F7F6] px-3 py-2 text-[12px] text-[#666666]">
          El conteo de unidades por ubicación aún no está disponible.
        </p>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className={PANEL}>
          <WarehousePlan items={items} selectedId={selectedId} onSelect={setSelectedId} onMove={handleMove} />
          <p className="mt-2 text-[11px] text-[#666666]">
            Arrastra para mover (se ajusta cada 10 cm). Con el teclado: Tab para elegir, flechas para mover 10 cm, Shift + flecha para 50 cm.
            Se guarda solo.
          </p>
        </div>

        <div className="space-y-4">
          {selected && edit && (
            <section className={PANEL} aria-labelledby="location-edit-title">
              <h2 id="location-edit-title" className={PANEL_TITLE}>
                {describeLocation(selected)}
              </h2>
              <p className="mb-3 text-[11px] text-[#666666]">
                {LOCATION_KIND_LABELS_ES[selected.kind]}
                {selected.wall ? ` · ${WALL_LABELS_ES[selected.wall]}` : ""}
                {selected.pos_x !== null && selected.pos_y !== null
                  ? ` · x ${formatMetres(selected.pos_x)}, y ${formatMetres(selected.pos_y)}`
                  : ""}
              </p>
              <form
                className="grid grid-cols-2 gap-3"
                onSubmit={(event) => {
                  event.preventDefault();
                  void handleSaveEdit();
                }}
              >
                <div>
                  <label htmlFor="edit-code" className={LABEL}>Código</label>
                  <input id="edit-code" className={`${CONTROL} font-mono uppercase`} value={edit.code} onChange={(e) => setEdit({ ...edit, code: e.target.value })} />
                </div>
                <div>
                  <label htmlFor="edit-name" className={LABEL}>Nombre</label>
                  <input id="edit-name" className={CONTROL} value={edit.name} maxLength={80} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
                </div>
                {selected.kind !== "level" && (
                  <>
                    <div>
                      <label htmlFor="edit-width" className={LABEL}>Largo (m)</label>
                      <input id="edit-width" className={CONTROL} inputMode="decimal" value={edit.width} onChange={(e) => setEdit({ ...edit, width: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="edit-depth" className={LABEL}>Fondo (m)</label>
                      <input id="edit-depth" className={CONTROL} inputMode="decimal" value={edit.depth} onChange={(e) => setEdit({ ...edit, depth: e.target.value })} />
                    </div>
                    <div>
                      <label htmlFor="edit-rotation" className={LABEL}>Rotación</label>
                      <select id="edit-rotation" className={CONTROL} value={edit.rotation} onChange={(e) => setEdit({ ...edit, rotation: e.target.value })}>
                        {ROTATIONS_DEG.map((deg) => (
                          <option key={deg} value={deg}>{deg}°</option>
                        ))}
                      </select>
                    </div>
                  </>
                )}
                <div className="col-span-2 flex flex-wrap justify-between gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="text-[#A3271F]"
                    disabled={!selected.is_active || selected.kind === "rug"}
                    onClick={() => setConfirmDeactivate(selected)}
                  >
                    Desactivar
                  </Button>
                  <Button type="submit" size="sm" disabled={isSavingEdit}>
                    {isSavingEdit && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    Guardar
                  </Button>
                </div>
              </form>
            </section>
          )}

          <section className={PANEL} aria-labelledby="location-new-title">
            <h2 id="location-new-title" className={PANEL_TITLE}>Nueva ubicación</h2>
            <form
              className="grid grid-cols-2 gap-3"
              onSubmit={(event) => {
                event.preventDefault();
                void handleCreate();
              }}
            >
              <div>
                <label htmlFor="new-kind" className={LABEL}>Tipo</label>
                <select id="new-kind" className={CONTROL} value={form.kind} onChange={(e) => updateForm({ kind: e.target.value as NewLocationKind })}>
                  {NEW_KINDS.map((kind) => (
                    <option key={kind} value={kind}>{LOCATION_KIND_LABELS_ES[kind]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-wall" className={LABEL}>Muro</label>
                <select id="new-wall" className={CONTROL} value={form.wall} onChange={(e) => updateForm({ wall: e.target.value as Wall })}>
                  {WALL_CHOICES.map((wall) => (
                    <option key={wall} value={wall}>{WALL_LABELS_ES[wall]}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="new-code" className={LABEL}>Código</label>
                <input id="new-code" className={`${CONTROL} font-mono uppercase`} value={form.code} onChange={(e) => updateForm({ code: e.target.value })} />
              </div>
              <div>
                <label htmlFor="new-name" className={LABEL}>Nombre</label>
                <input id="new-name" className={CONTROL} value={form.name} maxLength={80} placeholder="Ej: Estante luces" onChange={(e) => updateForm({ name: e.target.value })} />
              </div>
              {form.kind === "shelf" && (
                <div>
                  <label htmlFor="new-levels" className={LABEL}>Niveles</label>
                  <input
                    id="new-levels"
                    type="number"
                    min={0}
                    max={MAX_SHELF_LEVELS}
                    className={CONTROL}
                    value={form.levels}
                    onChange={(e) => updateForm({ levels: e.target.value })}
                  />
                </div>
              )}
              {form.kind === "box" && (
                <div className="col-span-2">
                  <label htmlFor="new-parent" className={LABEL}>Dentro de (opcional)</label>
                  <select id="new-parent" className={CONTROL} value={boxParentId} onChange={(e) => setBoxParentId(e.target.value)}>
                    <option value="">Directo en el piso, junto al muro</option>
                    {boxParents.map((parent) => (
                      <option key={parent.id} value={parent.id}>{describeLocation(parent)}</option>
                    ))}
                  </select>
                </div>
              )}
              <div className="col-span-2 flex justify-end">
                <Button type="submit" size="sm" disabled={isCreating}>
                  {isCreating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-1 h-4 w-4" />}
                  Crear
                </Button>
              </div>
            </form>
          </section>

          <section className={PANEL} aria-labelledby="location-list-title">
            <div className="mb-2 flex items-center justify-between">
              <h2 id="location-list-title" className="text-[13px] font-semibold text-[#111111]">Todas las ubicaciones</h2>
              <label className="flex items-center gap-1.5 text-[11px] text-[#666666]">
                <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} />
                Ver desactivadas
              </label>
            </div>
            {tree.length === 0 ? (
              <p className="py-4 text-center text-[12px] text-[#666666]">Aún no hay ubicaciones. Crea el primer estante arriba.</p>
            ) : (
              <ul className="max-h-[360px] overflow-y-auto">{renderTree(tree, 0)}</ul>
            )}
          </section>
        </div>
      </div>

      <AlertDialog open={confirmDeactivate !== null} onOpenChange={(open) => !open && setConfirmDeactivate(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desactivar {confirmDeactivate?.code}</AlertDialogTitle>
            <AlertDialogDescription>
              Deja de aparecer en el plano y en los selectores. Solo se puede si no tiene niveles activos ni unidades guardadas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => confirmDeactivate && void handleDeactivate(confirmDeactivate)}>Desactivar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Toaster richColors position="top-right" />
    </div>
  );
}

export default WarehouseLocationsDashboard;
