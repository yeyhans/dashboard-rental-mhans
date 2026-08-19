import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  LEGACY_ORDER_STATUSES,
  STATUS_LABELS,
  isOrderStatus,
  isLegacyOrderStatus,
  migrateLegacyStatus,
  statusLabel,
  type OrderStatus,
} from '../orderStatus';

/**
 * T-019. The v1.2 status vocabulary as a single source of truth (`order-state-machine/spec.md`,
 * "Canonical eight-value status vocabulary" — consumer side).
 *
 * Why this module exists at all: before it, the vocabulary was written out by hand in 29 files
 * under `src/`, each with its own list and its own Spanish labels. A status migration against that
 * shape is not a rename, it is 29 independent chances to miss one — and the ones that get missed
 * are the least-visited screens, which is exactly where a wrong status is noticed last.
 *
 * The mapping mirrors `supabase/migrations/0003_m4_status_portal_v12.sql`. If the two ever
 * disagree the database wins and this module is wrong, so the mapping is asserted value-by-value
 * here rather than trusted.
 */

describe('ORDER_STATUSES', () => {
  it('is exactly the eight Portal Cliente v1.2 values', () => {
    expect([...ORDER_STATUSES]).toEqual([
      'request',
      'evaluation',
      'confirmed',
      'preparation',
      'in-rental',
      'return',
      'completed',
      'cancelled',
    ]);
  });

  it('carries a Spanish label for every value, with none left blank', () => {
    // UI copy is Spanish by project convention; a missing entry renders the raw enum to the admin.
    for (const status of ORDER_STATUSES) {
      expect(STATUS_LABELS[status]).toBeTruthy();
      expect(STATUS_LABELS[status].trim()).not.toBe('');
    }
    expect(Object.keys(STATUS_LABELS).sort()).toEqual([...ORDER_STATUSES].sort());
  });

  it('uses the client-canonical labels verbatim, not paraphrases of them', () => {
    // Source: `CONSOLIDADO WEB YEYSON/Area 02 - portal Cliente/
    // MarioHans_OS_Client_Portal_Canonical_Visual_v2.0.html`, the <option> values of the Pedidos
    // filter. These are the strings the customer already sees in the approved design.
    //
    // The first draft of this module invented them and got six of eight wrong: it wrote
    // "Confirmada"/"Completada"/"Cancelada" (feminine, agreeing with "orden") where the client
    // writes "Confirmado"/"Completado"/"Cancelado" (masculine, agreeing with "pedido"), and
    // padded two more into "En evaluación"/"En devolución". Wrong copy is not cosmetic here: the
    // customer portal and the admin dashboard would name the same state differently, which is
    // exactly the confusion the consolidation exists to remove.
    expect(STATUS_LABELS).toEqual({
      request: 'Solicitud',
      evaluation: 'Evaluación',
      confirmed: 'Confirmado',
      preparation: 'Preparación',
      'in-rental': 'En arriendo',
      return: 'Devolución',
      completed: 'Completado',
      cancelled: 'Cancelado',
    });
  });
});

describe('isOrderStatus', () => {
  it.each(ORDER_STATUSES)('accepts %s', (status) => {
    expect(isOrderStatus(status)).toBe(true);
  });

  it.each(['on-hold', 'processing', 'pending', 'refunded', 'failed'])(
    'rejects the legacy value %s',
    (legacy) => {
      // Post-migration the database CHECK rejects these. The API must reject them first, with a
      // 400 the caller can act on, rather than passing them through to a 500 from Postgres.
      expect(isOrderStatus(legacy)).toBe(false);
    }
  );

  it.each(['', ' ', 'REQUEST', 'trash', 'auto-draft', 'reviewing', 'preparing', 'delivering', 'paid'])(
    'rejects %s',
    (bogus) => {
      // `reviewing`, `preparing`, `delivering` and `paid` appear in the workflow documentation but
      // were never database values — see `.claude/rules/01-business-context.md`.
      expect(isOrderStatus(bogus)).toBe(false);
    }
  );

  it('rejects non-strings without throwing', () => {
    for (const value of [null, undefined, 42, {}, [], true]) {
      expect(isOrderStatus(value)).toBe(false);
    }
  });
});

describe('migrateLegacyStatus', () => {
  const expected: Record<string, OrderStatus> = {
    completed: 'completed',
    cancelled: 'cancelled',
    failed: 'cancelled',
    'on-hold': 'request',
    processing: 'confirmed',
    pending: 'request',
    refunded: 'cancelled',
  };

  it.each(Object.entries(expected))('maps %s to %s', (legacy, target) => {
    expect(migrateLegacyStatus(legacy)).toBe(target);
  });

  it('covers every value the pre-migration CHECK constraint permitted', () => {
    // An uncovered permitted value is what aborts the SQL migration mid-window. The same
    // completeness has to hold here, or the app disagrees with the database about one status.
    expect([...LEGACY_ORDER_STATUSES].sort()).toEqual(Object.keys(expected).sort());
    for (const legacy of LEGACY_ORDER_STATUSES) {
      expect(isOrderStatus(migrateLegacyStatus(legacy) as string)).toBe(true);
    }
  });

  it('returns null for a value that is not a legacy status', () => {
    // Deliberately not a passthrough: silently returning the input would let an unknown value
    // travel as if it had been migrated.
    expect(migrateLegacyStatus('reviewing')).toBeNull();
    expect(migrateLegacyStatus('request')).toBeNull();
    expect(migrateLegacyStatus('')).toBeNull();
  });
});

describe('isLegacyOrderStatus', () => {
  it('separates the two vocabularies, overlap included', () => {
    // `completed` and `cancelled` belong to both. The predicates answer different questions and
    // must both say yes, otherwise a migration report miscounts the rows that did not move.
    expect(isLegacyOrderStatus('completed')).toBe(true);
    expect(isOrderStatus('completed')).toBe(true);
    expect(isLegacyOrderStatus('on-hold')).toBe(true);
    expect(isOrderStatus('on-hold')).toBe(false);
    expect(isLegacyOrderStatus('preparation')).toBe(false);
    expect(isOrderStatus('preparation')).toBe(true);
  });
});

describe('statusLabel', () => {
  it('returns the Spanish label for a known status', () => {
    expect(statusLabel('in-rental')).toBe(STATUS_LABELS['in-rental']);
  });

  it('returns the raw value for an unknown status instead of throwing or rendering undefined', () => {
    // A dashboard row must still render if the database somehow holds an unexpected value; the
    // admin seeing the raw string is far better than a blank cell or a crashed island.
    expect(statusLabel('on-hold')).toBe('on-hold');
    expect(statusLabel('')).toBe('');
  });
});
