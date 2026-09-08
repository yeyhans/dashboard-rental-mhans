import { describe, expect, it } from 'vitest';
import {
  catalogKpis,
  coversDay,
  occupancyOn,
  stockLabel,
  type CatalogProductLike,
  type RentalWindowLike,
} from '../catalogAvailability';
import type { LineItem } from '../../types/order';

const now = new Date('2026-06-15T10:00');

function item(partial: Partial<LineItem> = {}): LineItem {
  return { name: 'Profoto B10', product_id: 1, sku: 'PB-10', price: '50000', quantity: 1, ...partial };
}

function rental(partial: Partial<RentalWindowLike> = {}): RentalWindowLike {
  return {
    status: 'in-rental',
    startDate: '2026-06-14',
    endDate: '2026-06-18',
    lineItems: [item()],
    ...partial,
  };
}

function product(partial: Partial<CatalogProductLike> = {}): CatalogProductLike {
  return { id: 1, status: 'publish', stockStatus: 'instock', ...partial };
}

describe('coversDay', () => {
  it('cubre los días intermedios', () => {
    expect(coversDay(rental(), '2026-06-16')).toBe(true);
  });

  it('incluye el primer día', () => {
    expect(coversDay(rental(), '2026-06-14')).toBe(true);
  });

  it('incluye el ÚLTIMO día: el equipo sigue con el cliente', () => {
    // La devolución recién vence a las 13:00 del día siguiente. Tratar el término como exclusivo
    // es exactamente cómo un equipo queda doblemente reservado el último día de una producción.
    expect(coversDay(rental(), '2026-06-18')).toBe(true);
  });

  it('no cubre el día posterior al término', () => {
    expect(coversDay(rental(), '2026-06-19')).toBe(false);
  });

  it('un pedido cancelado no retiene nada', () => {
    expect(coversDay(rental({ status: 'cancelled' }), '2026-06-16')).toBe(false);
  });

  it('reconoce el cancelado en vocabulario legado', () => {
    expect(coversDay(rental({ status: 'failed' }), '2026-06-16')).toBe(false);
  });

  it('sin fechas no retiene nada', () => {
    expect(coversDay(rental({ startDate: null }), '2026-06-16')).toBe(false);
  });
});

describe('occupancyOn', () => {
  it('cuenta las unidades comprometidas hoy', () => {
    const occ = occupancyOn([rental({ lineItems: [item({ quantity: 3 })] })], now);
    expect(occ.get('1')).toBe(3);
  });

  it('suma el mismo producto a través de pedidos simultáneos', () => {
    const occ = occupancyOn(
      [rental({ lineItems: [item({ quantity: 2 })] }), rental({ lineItems: [item({ quantity: 1 })] })],
      now
    );
    expect(occ.get('1')).toBe(3);
  });

  it('normaliza el id a texto porque line_items es jsonb', () => {
    const occ = occupancyOn([rental({ lineItems: [item({ product_id: 7 }), item({ product_id: '7' })] })], now);
    expect(occ.get('7')).toBe(2);
  });

  it('ignora los arriendos que no cubren hoy', () => {
    const occ = occupancyOn([rental({ startDate: '2026-07-01', endDate: '2026-07-05' })], now);
    expect(occ.size).toBe(0);
  });
});

describe('catalogKpis', () => {
  it('cuenta solo los modelos publicados', () => {
    // Un borrador no es parte de la oferta: incluirlo separaría "Disponibles Hoy" de lo que un
    // cliente puede reservar de verdad.
    const k = catalogKpis([product(), product({ id: 2, status: 'draft' })], new Map());
    expect(k.modelosPublicados).toBe(1);
  });

  it('marca disponible lo publicado, con stock y sin unidades afuera', () => {
    const k = catalogKpis([product()], new Map());
    expect(k.disponiblesHoy).toBe(1);
    expect(k.porcentajeDisponible).toBe(100);
  });

  it('no cuenta como disponible lo que tiene unidades en arriendo', () => {
    const k = catalogKpis([product()], new Map([['1', 2]]));
    expect(k.disponiblesHoy).toBe(0);
    expect(k.modelosEnArriendo).toBe(1);
    expect(k.unidadesEnArriendo).toBe(2);
  });

  it('no cuenta como disponible lo bloqueado, aunque no tenga arriendos', () => {
    const k = catalogKpis([product({ stockStatus: 'outofstock' })], new Map());
    expect(k.disponiblesHoy).toBe(0);
    expect(k.bloqueados).toBe(1);
  });

  it('trata onbackorder como bloqueado, no como disponible', () => {
    const k = catalogKpis([product({ stockStatus: 'onbackorder' })], new Map());
    expect(k.bloqueados).toBe(1);
    expect(k.disponiblesHoy).toBe(0);
  });

  it('calcula el porcentaje sobre lo publicado', () => {
    const k = catalogKpis(
      [product({ id: 1 }), product({ id: 2 }), product({ id: 3 }), product({ id: 4 })],
      new Map([['1', 1]])
    );
    expect(k.porcentajeDisponible).toBe(75);
  });

  it('no divide por cero con el catálogo vacío', () => {
    const k = catalogKpis([], new Map());
    expect(k.porcentajeDisponible).toBe(0);
    expect(k.modelosPublicados).toBe(0);
  });
});

describe('stockLabel', () => {
  it('traduce los tres valores de convención', () => {
    expect(stockLabel('instock')).toBe('Disponible');
    expect(stockLabel('outofstock')).toBe('No disponible');
    expect(stockLabel('onbackorder')).toBe('Bajo pedido');
  });

  it('devuelve el valor crudo si la columna trae otra cosa', () => {
    // `stock_status` es un varchar SIN CHECK: puede contener cualquier cosa.
    expect(stockLabel('lo-que-sea')).toBe('lo-que-sea');
  });
});
