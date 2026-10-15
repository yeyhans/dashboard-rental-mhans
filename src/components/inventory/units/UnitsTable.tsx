import type { KeyboardEvent, ReactNode } from "react";
import { Archive, ArrowRightLeft, PackagePlus, Plus, Printer } from "lucide-react";
import { cn } from "@/lib/utils";
import type { InventoryUnitView } from "../../../services/serialisedAssetService";
import { UNIT_CONDITION_LABELS_ES, UNIT_WEARS, WEAR_LABELS_ES } from "../../../types/inventory";
import { UnitStatusPill } from "../canon/UnitStatusPill";
import { CANON_TONE_TEXT, unitStatusTone } from "../canon/unitStatus";
import { EDITABLE_CONDITIONS, type EditableCondition, type UnitChanges } from "./unitEdits";
import { indentedLabel, type LocationOption } from "./locationOptions";

export interface UnitsTableProps {
  /** Non-archived units, already ordered (by asset tag). */
  units: InventoryUnitView[];
  locationOptions: LocationOption[];
  /** Units with a request in flight: inputs disabled. */
  busyIds: ReadonlySet<number>;
  /** Bumped by the container to remount the inline inputs after a rejected edit. */
  formKey?: number;
  onCommit: (unit: InventoryUnitView, changes: UnitChanges) => void;
  onRelocate: (unit: InventoryUnitView, locationId: string) => void;
  onRequestRelocate: (unit: InventoryUnitView) => void;
  onArchive: (unit: InventoryUnitView) => void;
  onAddUnit: () => void;
  onAddMany: () => void;
  labelsHref: string;
}

// Canon `.unit-input`: 1px #EAEAEA, 6px radius, 12.5px.
const INPUT =
  "w-full rounded-[6px] border border-[#EAEAEA] bg-white px-2 py-1.5 text-[12.5px] text-[#111111] outline-none focus-visible:border-[#111111] focus-visible:ring-1 focus-visible:ring-[#111111] disabled:opacity-60";
const ICON_BUTTON =
  "inline-grid h-[26px] w-[26px] place-items-center rounded-[6px] border border-[#EAEAEA] bg-transparent text-[#707070] hover:text-[#111111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111] disabled:opacity-40";
const GHOST_BUTTON =
  "inline-flex items-center gap-1.5 rounded-[6px] border border-[#EAEAEA] bg-white px-3 py-2 text-[12px] text-[#666666] hover:text-[#111111] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#111111]";

const ordinal = (index: number) => String(index + 1).padStart(3, "0");
const unitsWord = (n: number) => (n === 1 ? "1 unidad registrada" : `${n} unidades registradas`);

/** Enter commits a text cell the same way leaving it does. */
function blurOnEnter(event: KeyboardEvent<HTMLInputElement>) {
  if (event.key === "Enter") event.currentTarget.blur();
}

interface CellProps {
  unit: InventoryUnitView;
  isBusy: boolean;
  props: UnitsTableProps;
}

function SerialInput({ unit, isBusy, props }: CellProps) {
  return (
    <input
      key={`serial-${unit.id}-${unit.row_version}-${props.formKey ?? 0}`}
      className={INPUT}
      defaultValue={unit.serial_number}
      aria-label={`N° de serie de ${unit.asset_tag}`}
      placeholder="N° de serie"
      disabled={isBusy}
      onKeyDown={blurOnEnter}
      onBlur={(event) => {
        if (event.currentTarget.value !== unit.serial_number) props.onCommit(unit, { serial_number: event.currentTarget.value });
      }}
    />
  );
}

function WearSelect({ unit, isBusy, props }: CellProps) {
  return (
    <select
      key={`wear-${unit.id}-${unit.row_version}-${props.formKey ?? 0}`}
      className={INPUT}
      defaultValue={unit.wear}
      aria-label={`Condición de ${unit.asset_tag}`}
      disabled={isBusy}
      onChange={(event) => props.onCommit(unit, { wear: event.currentTarget.value as InventoryUnitView["wear"] })}
    >
      {UNIT_WEARS.map((wear) => (
        <option key={wear} value={wear}>
          {WEAR_LABELS_ES[wear]}
        </option>
      ))}
    </select>
  );
}

/** "En arriendo" is derived from the open checkout: shown, never picked. */
function StatusCell({ unit, isBusy, props }: CellProps) {
  if (unit.status === "in_rental") {
    return (
      <div className="flex flex-col items-start gap-1">
        <UnitStatusPill status="in_rental" />
        {unit.open_order_id !== null && (
          <a href={`/orders/${unit.open_order_id}`} className="font-mono text-[11px] text-[#666666] underline-offset-2 hover:underline">
            Pedido #{unit.open_order_id}
          </a>
        )}
      </div>
    );
  }
  return (
    <select
      key={`cond-${unit.id}-${unit.row_version}-${props.formKey ?? 0}`}
      className={cn(INPUT, "font-medium", CANON_TONE_TEXT[unitStatusTone(unit.status)])}
      defaultValue={unit.condition}
      aria-label={`Estado de ${unit.asset_tag}`}
      disabled={isBusy}
      onChange={(event) => props.onCommit(unit, { condition: event.currentTarget.value as EditableCondition })}
    >
      {EDITABLE_CONDITIONS.map((condition) => (
        <option key={condition} value={condition}>
          {UNIT_CONDITION_LABELS_ES[condition]}
        </option>
      ))}
    </select>
  );
}

/** Picking a location relocates the unit (audited move); legacy text shows until the first move. */
function LocationSelect({ unit, isBusy, props }: CellProps) {
  const known = unit.location_id !== null && props.locationOptions.some((option) => option.id === unit.location_id);
  return (
    <select
      key={`loc-${unit.id}-${unit.row_version}-${props.formKey ?? 0}`}
      className={INPUT}
      defaultValue={unit.location_id ?? ""}
      aria-label={`Ubicación de ${unit.asset_tag}`}
      disabled={isBusy}
      onChange={(event) => {
        const value = event.currentTarget.value;
        if (value && value !== unit.location_id) props.onRelocate(unit, value);
      }}
    >
      {unit.location_id === null && (
        <option value="">{unit.location.trim() ? `${unit.location} (texto anterior)` : "Sin ubicación"}</option>
      )}
      {unit.location_id !== null && !known && (
        <option value={unit.location_id}>
          {unit.location_detail ? `${unit.location_detail.code} · ${unit.location_detail.name}` : unit.location}
        </option>
      )}
      {props.locationOptions.map((option) => (
        <option key={option.id} value={option.id}>
          {indentedLabel(option)}
        </option>
      ))}
    </select>
  );
}

function NotesInput({ unit, isBusy, props }: CellProps) {
  return (
    <input
      key={`notes-${unit.id}-${unit.row_version}-${props.formKey ?? 0}`}
      className={INPUT}
      defaultValue={unit.notes ?? ""}
      aria-label={`Observaciones de ${unit.asset_tag}`}
      placeholder="Observaciones…"
      disabled={isBusy}
      onKeyDown={blurOnEnter}
      onBlur={(event) => {
        if (event.currentTarget.value !== (unit.notes ?? "")) props.onCommit(unit, { notes: event.currentTarget.value });
      }}
    />
  );
}

function RowActions({ unit, isBusy, props }: CellProps) {
  return (
    <div className="flex justify-end gap-1">
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={`Reubicar ${unit.asset_tag}`}
        title="Reubicar"
        disabled={isBusy}
        onClick={() => props.onRequestRelocate(unit)}
      >
        <ArrowRightLeft aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={ICON_BUTTON}
        aria-label={`Archivar ${unit.asset_tag}`}
        title={unit.status === "in_rental" ? "No puedes archivar una unidad en arriendo" : "Archivar"}
        disabled={isBusy || unit.status === "in_rental"}
        onClick={() => props.onArchive(unit)}
      >
        <Archive aria-hidden="true" className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}

function FooterActions({ props, children }: { props: UnitsTableProps; children?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {children}
      <a href={props.labelsHref} className={GHOST_BUTTON}>
        <Printer aria-hidden="true" className="h-3.5 w-3.5" />
        Imprimir etiquetas
      </a>
      <button type="button" className={GHOST_BUTTON} onClick={props.onAddMany}>
        <PackagePlus aria-hidden="true" className="h-3.5 w-3.5" />
        Agregar varias
      </button>
      <button type="button" className={GHOST_BUTTON} onClick={props.onAddUnit}>
        <Plus aria-hidden="true" className="h-3.5 w-3.5" />
        Agregar unidad
      </button>
    </div>
  );
}

const HEAD_CELL = "px-3.5 py-2.5 text-left font-mono text-[10px] font-normal uppercase tracking-[0.06em] text-[#707070]";
const BODY_CELL = "px-3.5 py-[9px] align-middle";

/** Canon RC2.1.3 ficha › Inventario: `.unit-table` on desktop, `.unit-cards` on mobile. */
export function UnitsTable(props: UnitsTableProps) {
  const { units } = props;

  if (units.length === 0) {
    return (
      <div className="rounded-[8px] border border-[#EAEAEA] bg-white px-5 py-12 text-center">
        <p className="mb-1 text-[13px] font-medium text-[#111111]">Este equipo aún no tiene unidades registradas</p>
        <p className="mb-5 text-[12px] text-[#666666]">
          Agrega la primera unidad para controlar su número de serie, estado y ubicación en bodega.
        </p>
        <div className="flex flex-wrap justify-center gap-2">
          <button type="button" className={GHOST_BUTTON} onClick={props.onAddMany}>
            <PackagePlus aria-hidden="true" className="h-3.5 w-3.5" />
            Agregar varias
          </button>
          <button
            type="button"
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[#111111] px-4 py-2 text-[12.5px] font-medium text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#111111]"
            onClick={props.onAddUnit}
          >
            <Plus aria-hidden="true" className="h-3.5 w-3.5" />
            Agregar unidad
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      {/* Desktop */}
      <div className="hidden overflow-hidden rounded-[10px] border border-[#EAEAEA] bg-white md:block">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[920px] border-collapse text-[12.5px]">
            <thead className="border-b border-[#EAEAEA] bg-[#F7F7F6]">
              <tr>
                <th scope="col" className={cn(HEAD_CELL, "w-12")}>#</th>
                <th scope="col" className={HEAD_CELL}>Código</th>
                <th scope="col" className={HEAD_CELL}>N° de serie</th>
                <th scope="col" className={HEAD_CELL}>Condición</th>
                <th scope="col" className={HEAD_CELL}>Estado</th>
                <th scope="col" className={HEAD_CELL}>Ubicación</th>
                <th scope="col" className={HEAD_CELL}>Observaciones</th>
                <th scope="col" className={HEAD_CELL}>
                  <span className="sr-only">Acciones</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {units.map((unit, index) => {
                const isBusy = props.busyIds.has(unit.id);
                const cell = { unit, isBusy, props };
                return (
                  <tr key={unit.id} aria-busy={isBusy || undefined} className={cn("border-b border-[#F0F0EF] last:border-b-0", isBusy && "opacity-60")}>
                    <td className={cn(BODY_CELL, "text-[12px] text-[#707070]")}>{ordinal(index)}</td>
                    <td className={cn(BODY_CELL, "whitespace-nowrap font-mono text-[12px] font-medium text-[#111111]")}>{unit.asset_tag}</td>
                    <td className={cn(BODY_CELL, "min-w-[150px]")}>
                      <SerialInput {...cell} />
                    </td>
                    <td className={cn(BODY_CELL, "w-[110px]")}>
                      <WearSelect {...cell} />
                    </td>
                    <td className={cn(BODY_CELL, "w-[140px]")}>
                      <StatusCell {...cell} />
                    </td>
                    <td className={cn(BODY_CELL, "min-w-[180px]")}>
                      <LocationSelect {...cell} />
                    </td>
                    <td className={cn(BODY_CELL, "min-w-[180px]")}>
                      <NotesInput {...cell} />
                    </td>
                    <td className={cn(BODY_CELL, "w-[76px]")}>
                      <RowActions {...cell} />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EAEAEA] bg-[#F7F7F6] px-4 py-3">
          <span className="text-[12px] text-[#666666]">{unitsWord(units.length)}</span>
          <FooterActions props={props} />
        </div>
      </div>

      {/* Mobile */}
      <div className="flex flex-col gap-2.5 md:hidden">
        {units.map((unit, index) => {
          const isBusy = props.busyIds.has(unit.id);
          const cell = { unit, isBusy, props };
          return (
            <div key={unit.id} aria-busy={isBusy || undefined} className={cn("rounded-[8px] border border-[#EAEAEA] bg-white px-3.5 py-3", isBusy && "opacity-60")}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <span className="font-mono text-[12px] font-semibold text-[#111111]">Unidad {ordinal(index)}</span>
                  <span className="ml-2 font-mono text-[11px] text-[#666666]">{unit.asset_tag}</span>
                </div>
                <RowActions {...cell} />
              </div>
              <div className="flex flex-col gap-2">
                <SerialInput {...cell} />
                <div className="grid grid-cols-2 gap-2">
                  <WearSelect {...cell} />
                  <StatusCell {...cell} />
                </div>
                <LocationSelect {...cell} />
                <NotesInput {...cell} />
              </div>
            </div>
          );
        })}
        <div className="flex flex-col gap-2 pt-1">
          <span className="text-[12px] text-[#666666]">{unitsWord(units.length)}</span>
          <FooterActions props={props} />
        </div>
      </div>
    </div>
  );
}

export default UnitsTable;
