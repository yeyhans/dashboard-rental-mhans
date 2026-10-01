import { describe, expect, it } from 'vitest';
import {
  canPickUp,
  clientFinancial,
  clientKpis,
  clientValidation,
  missingDocuments,
  requiredDocuments,
  type ClientProfileLike,
} from '../clientStatus';

function profile(partial: Partial<ClientProfileLike> = {}): ClientProfileLike {
  return {
    tipoCliente: 'natural',
    contractUrl: 'https://r2/contrato.pdf',
    rutFrontUrl: 'https://r2/a.jpg',
    rutBackUrl: 'https://r2/b.jpg',
    signatureUrl: 'https://r2/firma.png',
    companyErutUrl: null,
    termsAccepted: true,
    ...partial,
  };
}

/**
 * Qué documentos se le exigen a cada cliente. Depende del tipo: a una persona natural nunca se le
 * pide el E-RUT de empresa, y exigírselo dejaría a todos los particulares permanentemente
 * "incompletos", volviendo inútil el filtro.
 */
describe('requiredDocuments', () => {
  it('a una persona natural le pide cuatro documentos', () => {
    expect(requiredDocuments(profile())).toHaveLength(4);
  });

  it('a una empresa le suma el E-RUT', () => {
    const docs = requiredDocuments(profile({ tipoCliente: 'empresa' }));
    expect(docs).toContain('companyErutUrl');
    expect(docs).toHaveLength(5);
  });
});

describe('missingDocuments', () => {
  it('con todo entregado no falta nada', () => {
    expect(missingDocuments(profile())).toEqual([]);
  });

  it('nombra lo que falta', () => {
    expect(missingDocuments(profile({ signatureUrl: null }))).toEqual(['signatureUrl']);
  });

  it('no reporta el E-RUT ausente en una persona natural', () => {
    expect(missingDocuments(profile({ companyErutUrl: null }))).toEqual([]);
  });

  it('sí lo reporta en una empresa', () => {
    expect(missingDocuments(profile({ tipoCliente: 'empresa' }))).toEqual(['companyErutUrl']);
  });
});

describe('clientValidation', () => {
  it('valida al cliente con todo entregado y términos aceptados', () => {
    expect(clientValidation(profile())).toBe('validado');
  });

  it('no valida si faltan los términos, aunque estén todos los documentos', () => {
    // El contrato es lo que la regla de retiro exige; un perfil sin términos no está listo.
    expect(clientValidation(profile({ termsAccepted: false }))).toBe('pendiente');
  });

  it('marca pendiente cuando lo único que falta es el contrato', () => {
    // Es el último paso del flujo y el que un admin persigue con un solo mensaje.
    expect(clientValidation(profile({ contractUrl: null }))).toBe('pendiente');
  });

  it('marca incompleto cuando falta un documento de identidad', () => {
    expect(clientValidation(profile({ rutFrontUrl: null }))).toBe('incompleto');
  });

  it('marca incompleto cuando faltan dos o más', () => {
    expect(clientValidation(profile({ contractUrl: null, signatureUrl: null }))).toBe('incompleto');
  });

  it('una empresa sin E-RUT no queda validada', () => {
    expect(clientValidation(profile({ tipoCliente: 'empresa' }))).toBe('incompleto');
  });
});

describe('canPickUp', () => {
  it('solo el validado puede retirar', () => {
    expect(canPickUp(profile())).toBe(true);
    expect(canPickUp(profile({ contractUrl: null }))).toBe(false);
  });
});

describe('clientFinancial', () => {
  it('está al día sin saldo', () => {
    expect(clientFinancial({ outstanding: 0, hasOverdue: false })).toBe('al-dia');
  });

  it('un saldo aún no vencido es pago pendiente, no deuda', () => {
    // Juntar ambos pondría a todo arriendo en curso en la lista de morosos y volvería inservible
    // el único filtro que importa.
    expect(clientFinancial({ outstanding: 500_000, hasOverdue: false })).toBe('pago-pendiente');
  });

  it('reserva "con deuda" para lo vencido', () => {
    expect(clientFinancial({ outstanding: 500_000, hasOverdue: true })).toBe('con-deuda');
  });
});

describe('clientKpis', () => {
  it('reparte los clientes entre los tres estados', () => {
    const k = clientKpis([
      { profile: profile(), balance: { outstanding: 0, hasOverdue: false } },
      { profile: profile({ contractUrl: null }), balance: { outstanding: 0, hasOverdue: false } },
      { profile: profile({ rutFrontUrl: null }), balance: { outstanding: 0, hasOverdue: false } },
    ]);
    expect(k).toEqual({ total: 3, validados: 1, pendientes: 1, incompletos: 1, conDeuda: 0 });
  });

  it('cuenta la deuda por separado del estado documental', () => {
    // Un cliente validado también puede deber: son dos ejes distintos.
    const k = clientKpis([{ profile: profile(), balance: { outstanding: 100, hasOverdue: true } }]);
    expect(k.validados).toBe(1);
    expect(k.conDeuda).toBe(1);
  });

  it('devuelve ceros sin clientes', () => {
    expect(clientKpis([])).toEqual({ total: 0, validados: 0, pendientes: 0, incompletos: 0, conDeuda: 0 });
  });
});
