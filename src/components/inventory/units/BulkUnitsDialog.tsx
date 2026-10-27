import { useEffect, useState, type ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "../../ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "../../ui/dialog";
import { BULK_MAX_UNITS } from "../../../lib/inventoryUnits";
import {
  UNIT_CONDITION_LABELS_ES,
  UNIT_WEARS,
  WEAR_LABELS_ES,
} from "../../../types/inventory";
import { EDITABLE_CONDITIONS } from "./unitEdits";
import { indentedLabel, type LocationOption } from "./locationOptions";
import {
  validateBulkUnitsForm,
  type BulkUnitsFormValues,
} from "./bulkUnitsForm";
import type { BulkUnitsPayload } from "./unitsApi";

type FieldErrors = Partial<Record<keyof BulkUnitsFormValues, string>>;

export function initialBulkUnitsValues(): BulkUnitsFormValues {
  return {
    count: "1",
    wear: "new",
    condition: "operational",
    location_id: "",
    location_text: "",
    serial_prefix: "",
  };
}

const CONTROL =
  "w-full rounded-[6px] border border-[#EAEAEA] bg-white px-3 py-2 text-[13px] text-[#111111] outline-none focus-visible:border-[#111111] focus-visible:ring-1 focus-visible:ring-[#111111] aria-[invalid=true]:border-[#A3271F]";

function Field({
  id,
  label,
  error,
  hint,
  children,
}: {
  id: string;
  label: string;
  error?: string | undefined;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label
        htmlFor={id}
        className="block text-[12px] font-medium text-[#111111]"
      >
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-[11px] text-[#666666]">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-[11px] text-[#A3271F]">
          {error}
        </p>
      )}
    </div>
  );
}

const describedBy = (id: string, error?: string) =>
  error
    ? { "aria-invalid": true as const, "aria-describedby": `${id}-error` }
    : {};

/** The location the form will use: the map pick wins over the typed text. */
function chosenLocation(
  values: BulkUnitsFormValues,
  locationOptions: LocationOption[],
): string {
  const picked = locationOptions.find(
    (option) => option.id === values.location_id.trim(),
  );
  if (picked) return picked.label;
  return values.location_text.trim();
}

/** One sentence, read before saving: what will be created, and where. */
export function summarizeBulkUnits(
  values: BulkUnitsFormValues,
  productName: string,
  locationOptions: LocationOption[],
): string {
  const count = Number(values.count.trim());
  if (!Number.isInteger(count) || count < 1)
    return "Revisa la cantidad antes de guardar.";
  const noun =
    count === 1 ? "Se creará 1 unidad" : `Se crearán ${count} unidades`;
  const where = chosenLocation(values, locationOptions);
  const place = where ? ` en ${where}` : "";
  return `${noun} de ${productName} · ${WEAR_LABELS_ES[values.wear]} · ${UNIT_CONDITION_LABELS_ES[values.condition]}${place}.`;
}

export interface BulkUnitsFieldsProps {
  values: BulkUnitsFormValues;
  errors: FieldErrors;
  locationOptions: LocationOption[];
  onChange: (field: keyof BulkUnitsFormValues, value: string) => void;
}

/** The one inventory form: how many, what state, where. The serial prefix sits in advanced options. */
export function BulkUnitsFields({
  values,
  errors,
  locationOptions,
  onChange,
}: BulkUnitsFieldsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Field
        id="bulk-count"
        label="Cantidad"
        error={errors.count}
        hint={`Entre 1 y ${BULK_MAX_UNITS} unidades por vez.`}
      >
        <input
          id="bulk-count"
          type="number"
          inputMode="numeric"
          min={1}
          max={BULK_MAX_UNITS}
          step={1}
          className={CONTROL}
          value={values.count}
          onChange={(event) => onChange("count", event.target.value)}
          {...describedBy("bulk-count", errors.count)}
        />
      </Field>

      <Field id="bulk-wear" label="Condición">
        <select
          id="bulk-wear"
          className={CONTROL}
          value={values.wear}
          onChange={(event) => onChange("wear", event.target.value)}
        >
          {UNIT_WEARS.map((wear) => (
            <option key={wear} value={wear}>
              {WEAR_LABELS_ES[wear]}
            </option>
          ))}
        </select>
      </Field>

      <Field id="bulk-condition" label="Estado">
        <select
          id="bulk-condition"
          className={CONTROL}
          value={values.condition}
          onChange={(event) => onChange("condition", event.target.value)}
        >
          {EDITABLE_CONDITIONS.map((condition) => (
            <option key={condition} value={condition}>
              {UNIT_CONDITION_LABELS_ES[condition]}
            </option>
          ))}
        </select>
      </Field>

      <div className="sm:col-span-1">
        {locationOptions.length > 0 ? (
          <Field
            id="bulk-location"
            label="Ubicación"
            error={errors.location_id}
          >
            <select
              id="bulk-location"
              className={CONTROL}
              value={values.location_id}
              onChange={(event) => onChange("location_id", event.target.value)}
              {...describedBy("bulk-location", errors.location_id)}
            >
              <option value="">Elige una ubicación…</option>
              {locationOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {indentedLabel(option)}
                </option>
              ))}
            </select>
          </Field>
        ) : (
          <Field
            id="bulk-location"
            label="Ubicación"
            error={errors.location_id}
            hint="Aún no hay ubicaciones en el plano; escribe dónde quedan."
          >
            <input
              id="bulk-location"
              className={CONTROL}
              value={values.location_text}
              placeholder="Ej: Bodega principal, repisa 2"
              onChange={(event) =>
                onChange("location_text", event.target.value)
              }
              {...describedBy("bulk-location", errors.location_id)}
            />
          </Field>
        )}
        <a
          href="/inventory/ubicaciones"
          className="mt-1.5 inline-block text-[12px] text-[#2E5490] underline underline-offset-2"
        >
          Crear o editar ubicaciones
        </a>
      </div>

      <details className="sm:col-span-2 rounded-[6px] border border-[#EAEAEA] px-3 py-2">
        <summary className="cursor-pointer text-[12px] font-medium text-[#111111]">
          Opciones avanzadas
        </summary>
        <div className="mt-3">
          <Field
            id="bulk-prefix"
            label="Prefijo de serie (opcional)"
            error={errors.serial_prefix}
            hint="Con prefijo CAM el N° de serie queda CAM-00012. Sin prefijo queda igual al código y lo corriges en la tabla."
          >
            <input
              id="bulk-prefix"
              className={`${CONTROL} font-mono uppercase`}
              value={values.serial_prefix}
              maxLength={40}
              placeholder="Ej: CAM"
              onChange={(event) =>
                onChange("serial_prefix", event.target.value)
              }
              {...describedBy("bulk-prefix", errors.serial_prefix)}
            />
          </Field>
        </div>
      </details>
    </div>
  );
}

export interface BulkUnitsDialogProps {
  open: boolean;
  productName: string;
  locationOptions: LocationOption[];
  onOpenChange: (open: boolean) => void;
  /** Resolves true when the units were created (the dialog then closes). */
  onSubmit: (payload: BulkUnitsPayload) => Promise<boolean>;
}

export function BulkUnitsDialog({
  open,
  productName,
  locationOptions,
  onOpenChange,
  onSubmit,
}: BulkUnitsDialogProps) {
  const [values, setValues] = useState<BulkUnitsFormValues>(
    initialBulkUnitsValues,
  );
  const [errors, setErrors] = useState<FieldErrors>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (open) setErrors({});
  }, [open]);

  const handleChange = (field: keyof BulkUnitsFormValues, value: string) => {
    setValues((prev) => ({ ...prev, [field]: value }) as BulkUnitsFormValues);
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  };

  const handleSubmit = async () => {
    // The server accepts 1..50 for every request; validating in "many" keeps one rule for both.
    const result = validateBulkUnitsForm(values, "many");
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    setIsSubmitting(true);
    try {
      const isCreated = await onSubmit(result.payload);
      if (isCreated) {
        setValues(initialBulkUnitsValues());
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => !isSubmitting && onOpenChange(next)}
    >
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Agregar unidades</DialogTitle>
          <DialogDescription>{productName}</DialogDescription>
        </DialogHeader>
        <form
          noValidate
          onSubmit={(event) => {
            event.preventDefault();
            void handleSubmit();
          }}
        >
          <BulkUnitsFields
            values={values}
            errors={errors}
            locationOptions={locationOptions}
            onChange={handleChange}
          />
          <p
            className="mt-4 rounded-[6px] bg-[#F7F7F6] px-3 py-2 text-[12px] text-[#111111]"
            aria-live="polite"
          >
            {summarizeBulkUnits(values, productName, locationOptions)}
          </p>
          <DialogFooter className="mt-6">
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Agregar unidades
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default BulkUnitsDialog;
