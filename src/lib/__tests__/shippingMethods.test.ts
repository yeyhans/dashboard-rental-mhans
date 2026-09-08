import { describe, expect, it } from 'vitest';
import {
  emptyShippingMethodForm,
  shippingMethodDeleteWarning,
  shippingMethodFromRecord,
  shippingMethodPayload,
  shippingMethodToForm,
  shippingTypeLabel,
  validateShippingMethodForm,
  type ShippingMethodForm,
  type ShippingMethodLike,
} from '../shippingMethods';

const row: ShippingMethodLike = {
  name: 'Despacho Santiago',
  description: 'Dentro del anillo Américo Vespucio',
  cost: 15000,
  enabled: true,
  shippingType: 'flat_rate',
  minAmount: 50000,
  maxAmount: null,
  estimatedDaysMin: 1,
  estimatedDaysMax: 2,
  requiresAddress: true,
  requiresPhone: false,
};

function form(partial: Partial<ShippingMethodForm> = {}): ShippingMethodForm {
  return { ...emptyShippingMethodForm(), name: 'Despacho Santiago', cost: '15000', ...partial };
}

describe('shippingTypeLabel', () => {
  it('traduce los cinco tipos del CHECK', () => {
    expect(shippingTypeLabel('free')).toBe('Envío Gratis');
    expect(shippingTypeLabel('local_pickup')).toBe('Retiro en Tienda');
  });

  it('devuelve el valor crudo si la DB trae algo fuera del CHECK', () => {
    expect(shippingTypeLabel('inventado')).toBe('inventado');
  });
});

describe('validateShippingMethodForm', () => {
  it('acepta un formulario completo', () => {
    expect(validateShippingMethodForm(form())).toEqual({});
  });

  it('exige un nombre con contenido', () => {
    expect(validateShippingMethodForm(form({ name: '   ' })).name).toBe('El nombre es obligatorio');
  });

  it('rechaza un valor negativo, que la DB tampoco acepta', () => {
    // CHECK shipping_methods_cost_check: cost >= 0. Sin esto el error llega como 500 opaco.
    expect(validateShippingMethodForm(form({ cost: '-1' })).cost).toBe('El valor no puede ser negativo');
  });

  it('rechaza un valor vacío en vez de interpretarlo como cero', () => {
    // `Number('')` es 0: un campo borrado se guardaría como envío gratis sin que nadie lo pida.
    expect(validateShippingMethodForm(form({ cost: '' })).cost).toBe('El valor es obligatorio');
  });

  it('rechaza un valor no numérico', () => {
    expect(validateShippingMethodForm(form({ cost: 'gratis' })).cost).toBe('El valor debe ser un número');
  });

  it('no deja cobrar por un envío marcado como gratis', () => {
    const errors = validateShippingMethodForm(form({ shippingType: 'free', cost: '15000' }));
    expect(errors.cost).toBe('Un envío gratis no puede tener valor');
  });

  it('acepta un envío gratis con valor cero', () => {
    expect(validateShippingMethodForm(form({ shippingType: 'free', cost: '0' }))).toEqual({});
  });

  it('exige que los días mínimos no superen a los máximos', () => {
    const errors = validateShippingMethodForm(form({ estimatedDaysMin: '5', estimatedDaysMax: '2' }));
    expect(errors.estimatedDaysMax).toBe('Los días máximos no pueden ser menores que los mínimos');
  });

  it('exige que el monto mínimo no supere al máximo', () => {
    const errors = validateShippingMethodForm(form({ minAmount: '90000', maxAmount: '10000' }));
    expect(errors.maxAmount).toBe('El monto máximo no puede ser menor que el mínimo');
  });

  it('trata los montos vacíos como sin límite, no como cero', () => {
    // Un `max_amount` de 0 dejaría el método inaplicable para siempre.
    expect(validateShippingMethodForm(form({ minAmount: '', maxAmount: '' }))).toEqual({});
  });

  it('rechaza días fraccionarios, que la columna entera trunca en silencio', () => {
    expect(validateShippingMethodForm(form({ estimatedDaysMin: '1.5' })).estimatedDaysMin).toBe(
      'Los días deben ser un número entero'
    );
  });
});

describe('shippingMethodDeleteWarning', () => {
  it('avisa que el borrado arrastra los envíos, porque la FK es ON DELETE CASCADE', () => {
    // Verificado contra la DB: shipping_usage_shipping_method_id_fkey tiene confdeltype 'c'.
    // Sin este aviso el admin cree que solo retira una opción del catálogo.
    const warning = shippingMethodDeleteWarning('Despacho Santiago', 12);

    expect(warning).toContain('12');
    expect(warning).toContain('Despacho Santiago');
    expect(warning.toLowerCase()).toContain('no se puede deshacer');
  });

  it('usa singular con un solo envío', () => {
    expect(shippingMethodDeleteWarning('Express', 1)).toContain('1 envío ');
  });

  it('sin envíos cargados no promete que no haya ninguno', () => {
    // El historial viene acotado a los últimos registros: "0 en pantalla" no es "0 en la tabla".
    const warning = shippingMethodDeleteWarning('Express', 0);

    expect(warning).not.toContain('0 envíos');
    expect(warning.toLowerCase()).toContain('desactívalo');
  });
});

describe('shippingMethodFromRecord', () => {
  it('pasa de snake_case a la forma del tablero', () => {
    const mapped = shippingMethodFromRecord({
      id: 7,
      name: 'Express',
      description: null,
      cost: 25000,
      enabled: true,
      shipping_type: 'express',
      min_amount: null,
      max_amount: null,
      estimated_days_min: 1,
      estimated_days_max: 1,
      requires_address: true,
      requires_phone: true,
    });

    expect(mapped.id).toBe(7);
    expect(mapped.shippingType).toBe('express');
    expect(mapped.maxAmount).toBeNull();
  });

  it('convierte los numeric que PostgREST entrega como string', () => {
    // `numeric` viaja como string en JSON; sin esto el total del tablero concatena en vez de sumar.
    const mapped = shippingMethodFromRecord({ id: 1, cost: '15000', min_amount: '50000' });

    expect(mapped.cost).toBe(15000);
    expect(mapped.minAmount).toBe(50000);
  });

  it('no confunde un opcional ausente con cero', () => {
    const mapped = shippingMethodFromRecord({ id: 1, cost: 0 });

    expect(mapped.minAmount).toBeNull();
    expect(mapped.estimatedDaysMax).toBeNull();
  });

  it('asume activo y con datos requeridos cuando la columna viene nula', () => {
    const mapped = shippingMethodFromRecord({ id: 1, cost: 0, enabled: null, requires_phone: null });

    expect(mapped.enabled).toBe(true);
    expect(mapped.requiresPhone).toBe(true);
  });
});

describe('shippingMethodToForm', () => {
  it('carga el registro completo en el formulario', () => {
    const loaded = shippingMethodToForm(row);

    expect(loaded.name).toBe('Despacho Santiago');
    expect(loaded.cost).toBe('15000');
    expect(loaded.shippingType).toBe('flat_rate');
    expect(loaded.requiresPhone).toBe(false);
  });

  it('deja vacíos los opcionales nulos en vez de escribir un cero', () => {
    // Un '0' aquí se guardaría de vuelta como límite real y dejaría el método inaplicable.
    const loaded = shippingMethodToForm({ ...row, maxAmount: null, estimatedDaysMax: null });

    expect(loaded.maxAmount).toBe('');
    expect(loaded.estimatedDaysMax).toBe('');
  });

  it('cae a tarifa fija si la DB trae un tipo fuera del CHECK', () => {
    expect(shippingMethodToForm({ ...row, shippingType: 'inventado' }).shippingType).toBe('flat_rate');
  });

  it('sobrevive a un ida y vuelta sin inventar valores', () => {
    expect(shippingMethodPayload(shippingMethodToForm(row))).toEqual({
      name: 'Despacho Santiago',
      description: 'Dentro del anillo Américo Vespucio',
      cost: 15000,
      shipping_type: 'flat_rate',
      enabled: true,
      min_amount: 50000,
      max_amount: null,
      estimated_days_min: 1,
      estimated_days_max: 2,
      requires_address: true,
      requires_phone: false,
    });
  });
});

describe('shippingMethodPayload', () => {
  it('convierte los campos numéricos y recorta el texto', () => {
    const payload = shippingMethodPayload(
      form({ name: '  Express  ', description: '  Mismo día  ', cost: '25000', shippingType: 'express' })
    );

    expect(payload.name).toBe('Express');
    expect(payload.description).toBe('Mismo día');
    expect(payload.cost).toBe(25000);
    expect(payload.shipping_type).toBe('express');
  });

  it('manda null y no cero cuando los opcionales quedan en blanco', () => {
    const payload = shippingMethodPayload(form({ minAmount: '', maxAmount: '', description: '' }));

    expect(payload.min_amount).toBeNull();
    expect(payload.max_amount).toBeNull();
    expect(payload.description).toBeNull();
  });

  it('conserva los booleanos tal cual los marcó el admin', () => {
    const payload = shippingMethodPayload(form({ enabled: false, requiresPhone: false }));

    expect(payload.enabled).toBe(false);
    expect(payload.requires_phone).toBe(false);
    expect(payload.requires_address).toBe(true);
  });

  it('usa snake_case, que es lo que espera la tabla', () => {
    const payload = shippingMethodPayload(form({ estimatedDaysMin: '2', estimatedDaysMax: '4' }));

    expect(payload.estimated_days_min).toBe(2);
    expect(payload.estimated_days_max).toBe(4);
  });
});
