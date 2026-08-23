/**
 * Shipping methods — labels, form shape and validation.
 *
 * Lives in `lib/` and not in `services/shippingService.ts` on purpose: the service imports
 * `supabaseAdmin`, so anything a client island needs must not come from there.
 *
 * Numeric fields are kept as strings through the form. `Number('')` is `0`, so a cleared cost
 * field would silently save as a free shipping method and a cleared `max_amount` would cap the
 * method at zero — both look like data the admin entered rather than a field they emptied.
 */

export const SHIPPING_TYPES = ['free', 'flat_rate', 'local_pickup', 'calculated', 'express'] as const;
export type ShippingType = (typeof SHIPPING_TYPES)[number];

export const SHIPPING_TYPE_LABELS: Record<ShippingType, string> = {
  free: 'Envío Gratis',
  flat_rate: 'Tarifa Fija',
  local_pickup: 'Retiro en Tienda',
  calculated: 'Calculado',
  express: 'Express',
};

export function isShippingType(value: unknown): value is ShippingType {
  return typeof value === 'string' && (SHIPPING_TYPES as readonly string[]).includes(value);
}

export function shippingTypeLabel(type: string): string {
  return isShippingType(type) ? SHIPPING_TYPE_LABELS[type] : type;
}

export interface ShippingMethodForm {
  name: string;
  description: string;
  cost: string;
  shippingType: ShippingType;
  enabled: boolean;
  minAmount: string;
  maxAmount: string;
  estimatedDaysMin: string;
  estimatedDaysMax: string;
  requiresAddress: boolean;
  requiresPhone: boolean;
}

export interface ShippingMethodPayload {
  name: string;
  description: string | null;
  cost: number;
  shipping_type: ShippingType;
  enabled: boolean;
  min_amount: number | null;
  max_amount: number | null;
  estimated_days_min: number | null;
  estimated_days_max: number | null;
  requires_address: boolean;
  requires_phone: boolean;
}

export type ShippingMethodErrors = Partial<Record<keyof ShippingMethodForm, string>>;

export function emptyShippingMethodForm(): ShippingMethodForm {
  return {
    name: '',
    description: '',
    cost: '0',
    shippingType: 'flat_rate',
    enabled: true,
    minAmount: '',
    maxAmount: '',
    estimatedDaysMin: '1',
    estimatedDaysMax: '3',
    requiresAddress: true,
    requiresPhone: true,
  };
}

/** A stored method, in the camelCase shape the Delivery board hands to the form. */
export interface ShippingMethodLike {
  readonly name: string;
  readonly description: string | null;
  readonly cost: number;
  readonly enabled: boolean;
  readonly shippingType: string;
  readonly minAmount: number | null;
  readonly maxAmount: number | null;
  readonly estimatedDaysMin: number | null;
  readonly estimatedDaysMax: number | null;
  readonly requiresAddress: boolean;
  readonly requiresPhone: boolean;
}

export interface StoredShippingMethod extends ShippingMethodLike {
  readonly id: number;
}

/**
 * Texto del diálogo de borrado.
 *
 * `shipping_usage_shipping_method_id_fkey` es ON DELETE CASCADE (verificado en la DB:
 * `confdeltype = 'c'`), así que borrar un método borra además su historial de envíos. Decirle al
 * admin que "solo deja de estar disponible" sería falso y le costaría datos que no puede recuperar.
 *
 * `loadedUsageCount` sale del historial que el tablero tiene en pantalla, que viene acotado: sirve
 * para dimensionar el daño, no para afirmar que no hay ninguno.
 */
export function shippingMethodDeleteWarning(name: string, loadedUsageCount: number): string {
  const head = `Se eliminará "${name}" y, en cascada, los envíos registrados con este tipo.`;
  const seen =
    loadedUsageCount > 0
      ? ` En el historial cargado hay ${loadedUsageCount} ${loadedUsageCount === 1 ? 'envío ' : 'envíos '}que se perderían.`
      : '';

  return `${head}${seen} Esta acción no se puede deshacer: si solo quieres retirarlo del catálogo, desactívalo en vez de eliminarlo.`;
}

/** `numeric` columns arrive as strings over JSON; an absent optional must stay NULL, not become 0. */
function nullableNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Maps a `shipping_methods` record — DB row or API JSON — into the shape the board uses. */
export function shippingMethodFromRecord(record: Record<string, any>): StoredShippingMethod {
  return {
    id: record.id,
    name: record.name ?? '',
    description: record.description ?? null,
    cost: nullableNumber(record.cost) ?? 0,
    enabled: record.enabled ?? true,
    shippingType: record.shipping_type ?? 'flat_rate',
    minAmount: nullableNumber(record.min_amount),
    maxAmount: nullableNumber(record.max_amount),
    estimatedDaysMin: nullableNumber(record.estimated_days_min),
    estimatedDaysMax: nullableNumber(record.estimated_days_max),
    requiresAddress: record.requires_address ?? true,
    requiresPhone: record.requires_phone ?? true,
  };
}

/** A NULL column stays empty in the form; writing `0` would save a limit nobody set. */
function optionalText(value: number | null): string {
  return value === null ? '' : String(value);
}

export function shippingMethodToForm(method: ShippingMethodLike): ShippingMethodForm {
  return {
    name: method.name,
    description: method.description ?? '',
    cost: String(method.cost),
    shippingType: isShippingType(method.shippingType) ? method.shippingType : 'flat_rate',
    enabled: method.enabled,
    minAmount: optionalText(method.minAmount),
    maxAmount: optionalText(method.maxAmount),
    estimatedDaysMin: optionalText(method.estimatedDaysMin),
    estimatedDaysMax: optionalText(method.estimatedDaysMax),
    requiresAddress: method.requiresAddress,
    requiresPhone: method.requiresPhone,
  };
}

/** A blank optional field means "no limit", which the column stores as NULL. */
function optionalNumber(raw: string): number | null {
  const trimmed = raw.trim();
  return trimmed === '' ? null : Number(trimmed);
}

export function validateShippingMethodForm(form: ShippingMethodForm): ShippingMethodErrors {
  const errors: ShippingMethodErrors = {};

  if (form.name.trim() === '') {
    errors.name = 'El nombre es obligatorio';
  } else if (form.name.trim().length < 3) {
    errors.name = 'El nombre debe tener al menos 3 caracteres';
  }

  const cost = form.cost.trim();
  if (cost === '') {
    errors.cost = 'El valor es obligatorio';
  } else if (!Number.isFinite(Number(cost))) {
    errors.cost = 'El valor debe ser un número';
  } else if (Number(cost) < 0) {
    errors.cost = 'El valor no puede ser negativo';
  } else if (form.shippingType === 'free' && Number(cost) > 0) {
    errors.cost = 'Un envío gratis no puede tener valor';
  }

  const days: Array<[keyof ShippingMethodForm, string]> = [
    ['estimatedDaysMin', form.estimatedDaysMin],
    ['estimatedDaysMax', form.estimatedDaysMax],
  ];

  for (const [field, raw] of days) {
    const value = optionalNumber(raw);
    if (value === null) continue;
    if (!Number.isFinite(value)) errors[field] = 'Los días deben ser un número';
    else if (!Number.isInteger(value)) errors[field] = 'Los días deben ser un número entero';
    else if (value < 0) errors[field] = 'Los días no pueden ser negativos';
  }

  const daysMin = optionalNumber(form.estimatedDaysMin);
  const daysMax = optionalNumber(form.estimatedDaysMax);
  if (
    !errors.estimatedDaysMin &&
    !errors.estimatedDaysMax &&
    daysMin !== null &&
    daysMax !== null &&
    daysMax < daysMin
  ) {
    errors.estimatedDaysMax = 'Los días máximos no pueden ser menores que los mínimos';
  }

  const amounts: Array<[keyof ShippingMethodForm, string]> = [
    ['minAmount', form.minAmount],
    ['maxAmount', form.maxAmount],
  ];

  for (const [field, raw] of amounts) {
    const value = optionalNumber(raw);
    if (value === null) continue;
    if (!Number.isFinite(value)) errors[field] = 'El monto debe ser un número';
    else if (value < 0) errors[field] = 'El monto no puede ser negativo';
  }

  const minAmount = optionalNumber(form.minAmount);
  const maxAmount = optionalNumber(form.maxAmount);
  if (
    !errors.minAmount &&
    !errors.maxAmount &&
    minAmount !== null &&
    maxAmount !== null &&
    maxAmount < minAmount
  ) {
    errors.maxAmount = 'El monto máximo no puede ser menor que el mínimo';
  }

  return errors;
}

export function shippingMethodPayload(form: ShippingMethodForm): ShippingMethodPayload {
  const description = form.description.trim();

  return {
    name: form.name.trim(),
    description: description === '' ? null : description,
    cost: Number(form.cost.trim()),
    shipping_type: form.shippingType,
    enabled: form.enabled,
    min_amount: optionalNumber(form.minAmount),
    max_amount: optionalNumber(form.maxAmount),
    estimated_days_min: optionalNumber(form.estimatedDaysMin),
    estimated_days_max: optionalNumber(form.estimatedDaysMax),
    requires_address: form.requiresAddress,
    requires_phone: form.requiresPhone,
  };
}
