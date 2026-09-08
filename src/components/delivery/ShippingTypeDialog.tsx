import React, { useEffect, useId, useRef, useState } from 'react';
import { Loader2, X } from 'lucide-react';
import {
  SHIPPING_TYPES,
  emptyShippingMethodForm,
  shippingMethodToForm,
  shippingTypeLabel,
  validateShippingMethodForm,
  type ShippingMethodErrors,
  type ShippingMethodForm,
  type ShippingType,
  type StoredShippingMethod,
} from '../../lib/shippingMethods';

/**
 * Alta y edición de tipos de envío dentro de Delivery.
 *
 * No usa el Dialog de shadcn a propósito: DeliveryBoard no monta ninguna primitiva de shadcn y
 * traer una sola arrastraría su tema al canónico de Área 01. El modal es markup plano con los
 * tokens del área, y el comportamiento accesible que Radix daría gratis (rol, Escape, foco
 * inicial, cierre por fondo) va explícito abajo.
 */
interface ShippingTypeDialogProps {
  method: StoredShippingMethod | null;
  saving: boolean;
  onSubmit: (form: ShippingMethodForm) => void;
  onClose: () => void;
}

const FIELD_CLASS =
  'w-full rounded-[6px] border border-[var(--color-border)] bg-[var(--color-background)] px-2 py-1.5 text-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-text-primary)]';

export function ShippingTypeDialog({ method, saving, onSubmit, onClose }: ShippingTypeDialogProps) {
  const [form, setForm] = useState<ShippingMethodForm>(() =>
    method ? shippingMethodToForm(method) : emptyShippingMethodForm()
  );
  const [errors, setErrors] = useState<ShippingMethodErrors>({});
  const titleId = useId();
  const firstFieldRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstFieldRef.current?.focus();
  }, []);

  function set<K extends keyof ShippingMethodForm>(field: K, value: ShippingMethodForm[K]) {
    setForm(prev => ({ ...prev, [field]: value }));
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const found = validateShippingMethodForm(form);
    setErrors(found);
    if (Object.keys(found).length > 0) return;
    onSubmit(form);
  }

  return (
    <ModalShell titleId={titleId} onClose={onClose}>
      <form onSubmit={handleSubmit} noValidate>
        <div className="flex items-center justify-between border-b border-[var(--color-border)] p-4">
          <h2 id={titleId} className="text-sm font-semibold">
            {method ? 'Editar tipo de envío' : 'Nuevo tipo de envío'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="rounded-[6px] p-1 text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-2)]"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="max-h-[65vh] space-y-3 overflow-y-auto p-4">
          <Field label="Nombre" error={errors.name} required>
            {props => (
              <input
                {...props}
                ref={firstFieldRef}
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="Despacho Santiago"
                className={FIELD_CLASS}
              />
            )}
          </Field>

          <Field label="Descripción" error={errors.description}>
            {props => (
              <textarea
                {...props}
                value={form.description}
                onChange={e => set('description', e.target.value)}
                rows={2}
                placeholder="Dentro del anillo Américo Vespucio"
                className={FIELD_CLASS}
              />
            )}
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Tipo" error={errors.shippingType} required>
              {props => (
                <select
                  {...props}
                  value={form.shippingType}
                  onChange={e => set('shippingType', e.target.value as ShippingType)}
                  className={FIELD_CLASS}
                >
                  {SHIPPING_TYPES.map(type => (
                    <option key={type} value={type}>
                      {shippingTypeLabel(type)}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <Field label="Valor (CLP)" error={errors.cost} required>
              {props => (
                <input
                  {...props}
                  inputMode="numeric"
                  value={form.cost}
                  onChange={e => set('cost', e.target.value)}
                  className={`${FIELD_CLASS} font-mono`}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Días mínimos" error={errors.estimatedDaysMin}>
              {props => (
                <input
                  {...props}
                  inputMode="numeric"
                  value={form.estimatedDaysMin}
                  onChange={e => set('estimatedDaysMin', e.target.value)}
                  className={`${FIELD_CLASS} font-mono`}
                />
              )}
            </Field>
            <Field label="Días máximos" error={errors.estimatedDaysMax}>
              {props => (
                <input
                  {...props}
                  inputMode="numeric"
                  value={form.estimatedDaysMax}
                  onChange={e => set('estimatedDaysMax', e.target.value)}
                  className={`${FIELD_CLASS} font-mono`}
                />
              )}
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Monto mínimo" error={errors.minAmount} hint="Vacío = sin límite">
              {props => (
                <input
                  {...props}
                  inputMode="numeric"
                  value={form.minAmount}
                  onChange={e => set('minAmount', e.target.value)}
                  className={`${FIELD_CLASS} font-mono`}
                />
              )}
            </Field>
            <Field label="Monto máximo" error={errors.maxAmount} hint="Vacío = sin límite">
              {props => (
                <input
                  {...props}
                  inputMode="numeric"
                  value={form.maxAmount}
                  onChange={e => set('maxAmount', e.target.value)}
                  className={`${FIELD_CLASS} font-mono`}
                />
              )}
            </Field>
          </div>

          <fieldset className="space-y-2 rounded-[6px] border border-[var(--color-border-soft)] p-3">
            <legend className="px-1 text-[11px] text-[var(--color-text-secondary)]">Opciones</legend>
            <Checkbox
              label="Activo"
              checked={form.enabled}
              onChange={value => set('enabled', value)}
            />
            <Checkbox
              label="Requiere dirección"
              checked={form.requiresAddress}
              onChange={value => set('requiresAddress', value)}
            />
            <Checkbox
              label="Requiere teléfono"
              checked={form.requiresPhone}
              onChange={value => set('requiresPhone', value)}
            />
          </fieldset>
        </div>

        <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-[6px] border border-[var(--color-border)] px-3 py-1.5 text-xs"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--color-text-primary)] px-3 py-1.5 text-xs text-[var(--color-background)] disabled:opacity-60"
          >
            {saving && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
            {method ? 'Guardar cambios' : 'Crear tipo'}
          </button>
        </div>
      </form>
    </ModalShell>
  );
}

interface ConfirmDialogProps {
  title: string;
  description: string;
  confirmLabel: string;
  busy: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busy,
  onConfirm,
  onClose,
}: ConfirmDialogProps) {
  const titleId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  // El foco parte en Cancelar: es un diálogo destructivo y un Enter reflejo no debe borrar nada.
  useEffect(() => {
    cancelRef.current?.focus();
  }, []);

  return (
    <ModalShell titleId={titleId} onClose={onClose}>
      <div className="p-4">
        <h2 id={titleId} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-2 text-xs text-[var(--color-text-secondary)]">{description}</p>
      </div>
      <div className="flex justify-end gap-2 border-t border-[var(--color-border)] p-4">
        <button
          type="button"
          ref={cancelRef}
          onClick={onClose}
          className="rounded-[6px] border border-[var(--color-border)] px-3 py-1.5 text-xs"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className="inline-flex items-center gap-1.5 rounded-[6px] bg-[var(--color-crit)] px-3 py-1.5 text-xs text-[var(--color-background)] disabled:opacity-60"
        >
          {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />}
          {confirmLabel}
        </button>
      </div>
    </ModalShell>
  );
}

function ModalShell({
  titleId,
  onClose,
  children,
}: {
  titleId: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onMouseDown={event => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="w-full max-w-md rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)] shadow-lg"
      >
        {children}
      </div>
    </div>
  );
}

interface FieldControlProps {
  id: string;
  'aria-invalid'?: boolean;
  'aria-describedby'?: string;
}

function Field({
  label,
  error,
  hint,
  required,
  children,
}: {
  label: string;
  error?: string | undefined;
  hint?: string;
  required?: boolean;
  children: (props: FieldControlProps) => React.ReactNode;
}) {
  const id = useId();
  const errorId = `${id}-error`;

  return (
    <div>
      <label htmlFor={id} className="mb-1 block text-[11px] text-[var(--color-text-secondary)]">
        {label}
        {required && <span className="text-[var(--color-crit)]"> *</span>}
      </label>
      {children(
        error
          ? { id, 'aria-invalid': true, 'aria-describedby': errorId }
          : { id }
      )}
      {hint && !error && (
        <p className="mt-1 text-[10px] text-[var(--color-text-faint)]">{hint}</p>
      )}
      {error && (
        <p id={errorId} role="alert" className="mt-1 text-[10px] text-[var(--color-crit)]">
          {error}
        </p>
      )}
    </div>
  );
}

function Checkbox({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  const checkboxId = useId();

  return (
    <div className="flex items-center gap-2">
      <input
        id={checkboxId}
        type="checkbox"
        checked={checked}
        onChange={e => onChange(e.target.checked)}
        className="h-3.5 w-3.5 rounded-[3px] border-[var(--color-border)]"
      />
      <label htmlFor={checkboxId} className="text-xs">
        {label}
      </label>
    </div>
  );
}
