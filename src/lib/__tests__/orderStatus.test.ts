import { describe, expect, it } from 'vitest';
import {
  ORDER_STATUSES,
  LEGACY_ORDER_STATUSES,
  STATUS_LABELS,
  TERMINAL_STATUSES,
  STATUS_TONES,
  STATUS_OPTIONS,
  statusTone,
  statusBadgeClass,
  statusChartColor,
  EMAIL_ON_ENTER,
  isOrderStatus,
  isLegacyOrderStatus,
  isTerminalStatus,
  migrateLegacyStatus,
  nextStatus,
  canTransition,
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

/**
 * State machine. Source: `CONSOLIDADO WEB YEYSON/Área 01 · Rental Técnico/
 * MarioHans_OS_Area01_Final_Architecture_Module_Consolidation_v1.1.html`, §5 — the only entity in
 * the whole system modelled as an explicit machine, with a `TRANSICIONES_VALIDAS` table mapping
 * each stage to exactly ONE successor. The document is emphatic: "ninguna vista permite saltar un
 * estado".
 *
 * Área 01 names its stages in Spanish (Solicitud, En evaluación, Confirmada, Preparación, En
 * Arriendo, Devolución, Completado); they map one-to-one onto the v1.2 enum, which is what let the
 * four ambiguous email triggers be resolved from the sources instead of guessed.
 */
describe('order state machine', () => {
  it('advances along the single linear chain from Área 01 §5', () => {
    expect(nextStatus('request')).toBe('evaluation');
    expect(nextStatus('evaluation')).toBe('confirmed');
    expect(nextStatus('confirmed')).toBe('preparation');
    expect(nextStatus('preparation')).toBe('in-rental');
    expect(nextStatus('in-rental')).toBe('return');
    expect(nextStatus('return')).toBe('completed');
  });

  it('has no successor for the terminal states', () => {
    expect(nextStatus('completed')).toBeNull();
    expect(nextStatus('cancelled')).toBeNull();
    expect([...TERMINAL_STATUSES].sort()).toEqual(['cancelled', 'completed']);
    expect(isTerminalStatus('completed')).toBe(true);
    expect(isTerminalStatus('in-rental')).toBe(false);
  });

  it('refuses to skip a stage', () => {
    // Skipping is how an order reaches "En Arriendo" without anyone having assigned units by
    // serial number in Preparación.
    expect(canTransition('request', 'evaluation')).toBe(true);
    expect(canTransition('request', 'confirmed')).toBe(false);
    expect(canTransition('confirmed', 'in-rental')).toBe(false);
    expect(canTransition('request', 'completed')).toBe(false);
  });

  it('refuses to move backwards', () => {
    expect(canTransition('in-rental', 'preparation')).toBe(false);
    expect(canTransition('completed', 'return')).toBe(false);
  });

  it('allows cancellation from any non-terminal stage', () => {
    // Not in the Área 01 table, which maps only the ADVANCE action. That early termination exists
    // is established by email 06 "Equipos no disponibles", which fires when staff finds no
    // availability for an order still awaiting review.
    for (const status of ORDER_STATUSES) {
      expect(canTransition(status, 'cancelled')).toBe(!isTerminalStatus(status));
    }
  });

  it('never leaves a terminal state', () => {
    for (const terminal of TERMINAL_STATUSES) {
      for (const target of ORDER_STATUSES) {
        expect(canTransition(terminal, target)).toBe(false);
      }
    }
  });

  it('rejects a transition to or from a value outside the vocabulary', () => {
    expect(canTransition('on-hold' as OrderStatus, 'request')).toBe(false);
    expect(canTransition('request', 'processing' as OrderStatus)).toBe(false);
  });
});

/**
 * Email trigger matrix, resolved against the two sources rather than guessed.
 *
 * `correos/MarioHans_OS_Rental_Email_Flow_Developer_Handoff_v1.0.html` names its states in the
 * operational Spanish of the flow diagram ("En espera", "Disponibilidad confirmada", "Arriendo en
 * curso"), which does not map onto the v1.2 enum on its own — four of eight triggers were
 * ambiguous. Joining each one to the Área 01 §5 stage that produces it resolves all four.
 */
describe('EMAIL_ON_ENTER', () => {
  it('fires 03 Solicitud recibida when the order is created', () => {
    // Handoff: "Cuenta activa → En espera", trigger = pedido creado desde el carro.
    // Área 01 §5: that is the Solicitud stage.
    expect(EMAIL_ON_ENTER.request).toBe('solicitud-recibida');
  });

  it('fires 04 Equipos disponibles on evaluation, not on confirmed', () => {
    // The handoff warns explicitly: "Disponibilidad confirmada ≠ reserva confirmada". The email
    // ASKS for the 25% deposit, so the reservation is not yet confirmed when it goes out. Área 01
    // §5 puts the matching action — "Confirmar y crear pedido", which generates the versioned
    // presupuesto — on the move into En evaluación.
    expect(EMAIL_ON_ENTER.evaluation).toBe('equipos-disponibles');
    expect(EMAIL_ON_ENTER.confirmed).toBeUndefined();
  });

  it('fires 07 Equipos entregados on in-rental', () => {
    // Handoff: "Procesando → Entregado → Arriendo en curso".
    // Área 01 §5: Preparación --("Registrar entrega")--> En Arriendo.
    expect(EMAIL_ON_ENTER['in-rental']).toBe('equipos-entregados');
  });

  it('fires 08 Pedido completado on completed, after check-in', () => {
    // The handoff is explicit that it must not go out before the return has been inspected and
    // found conforme, which is precisely the Devolución --> Completado edge.
    expect(EMAIL_ON_ENTER.completed).toBe('pedido-completado');
  });

  it('fires 06 Equipos no disponibles on cancelled', () => {
    // The handoff left this "Por definir (posible correspondencia con Fallido)". Área 01 §5
    // settles it: the machine is linear "con dos salidas terminales", and the non-success terminal
    // is Rechazada/Cancelada — both of which the v1.2 vocabulary collapses into `cancelled`. The
    // distinction Área 01 keeps between the two survives in the `cancellation_reason` column that
    // migration 0003 adds.
    expect(EMAIL_ON_ENTER.cancelled).toBe('equipos-no-disponibles');
  });

  it('sends nothing on preparation or return, and that is deliberate', () => {
    // Both are internal operational stages — bodega assigns units by serial number, check-in
    // verifies equipment. Nothing is required of the customer, so no email exists for either
    // among the eight approved templates. Asserted so a future reader does not read the gap as an
    // oversight and invent a ninth email.
    expect(EMAIL_ON_ENTER.preparation).toBeUndefined();
    expect(EMAIL_ON_ENTER.return).toBeUndefined();
  });

  it('is not the whole email set: two are account-scoped and one is an event', () => {
    // 01 Registro and 02 Contrato hang off the ACCOUNT lifecycle, not off orders.status.
    // 05 Pedido actualizado is marked "Evento, no estado" in the handoff — it fires on a new
    // presupuesto version, so it cannot live in a status-keyed map at all.
    const mapped = Object.values(EMAIL_ON_ENTER);
    expect(mapped).not.toContain('registro');
    expect(mapped).not.toContain('contrato');
    expect(mapped).not.toContain('pedido-actualizado');
    expect(mapped).toHaveLength(5);
  });

  it('only keys on real statuses', () => {
    for (const status of Object.keys(EMAIL_ON_ENTER)) {
      expect(isOrderStatus(status)).toBe(true);
    }
  });
});

/* ---------------------------------------------------------------------------------------------
 * Presentation layer
 * ------------------------------------------------------------------------------------------ */

describe('STATUS_TONES', () => {
  it('assigns every status exactly one design-system tone', () => {
    for (const status of ORDER_STATUSES) {
      expect(STATUS_TONES[status]).toMatch(/^(success|warning|danger|info|neutral)$/);
    }
    expect(Object.keys(STATUS_TONES)).toHaveLength(ORDER_STATUSES.length);
  });

  /**
   * Not invented here. The tones are read off the design system's own canonical component,
   * `Diseño/MarioHans OS Design System/components/data/StatusBadge.jsx`, whose `STATES` table
   * names each operational stage in Spanish and fixes its tone. Each v1.2 status maps onto exactly
   * one of those named stages, so the tone is derived rather than chosen:
   *
   *   request     ← solicitud    (neutral)   completed ← finalizado (neutral)
   *   evaluation  ← evaluacion   (info)      cancelled ← rechazado  (danger)
   *   confirmed   ← confirmado   (success)
   *   preparation ← preparacion  (warning)
   *   in-rental   ← activo       (info)
   *   return      ← retorno      (warning)
   */
  it('matches the tone the design system assigns to each named stage', () => {
    expect(STATUS_TONES).toEqual({
      request: 'neutral',
      evaluation: 'info',
      confirmed: 'success',
      preparation: 'warning',
      'in-rental': 'info',
      return: 'warning',
      completed: 'neutral',
      cancelled: 'danger',
    });
  });

  it('reserves danger for the failure exit only', () => {
    // The brand is monochrome and red is the loudest thing on the screen. An order that merely
    // sits in an early stage is not a problem, and painting it red trains admins to ignore red.
    const danger = ORDER_STATUSES.filter((s) => STATUS_TONES[s] === 'danger');
    expect(danger).toEqual(['cancelled']);
  });
});

describe('statusTone', () => {
  it('returns the mapped tone for a known status', () => {
    expect(statusTone('in-rental')).toBe('info');
  });

  it('falls back to neutral for an unknown value rather than throwing', () => {
    // Legacy rows survive between the code deploy and the 0003 apply, and exports carry them
    // forever. A badge that crashes the island is far worse than a gray badge.
    expect(statusTone('on-hold')).toBe('neutral');
    expect(statusTone('')).toBe('neutral');
  });
});

describe('STATUS_OPTIONS', () => {
  it('lists the eight statuses in chain order with their canonical labels', () => {
    // The `<select>` in OrderEstado.tsx hand-wrote nine options including `trash` and
    // `auto-draft`, which the constraint never accepted — picking one was a guaranteed 500.
    expect(STATUS_OPTIONS).toEqual(
      ORDER_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))
    );
  });
});

describe('statusBadgeClass', () => {
  it('renders every status through design-system custom properties, never palette utilities', () => {
    // The rule the design system's own oxlint config enforces: "referenciar siempre custom
    // properties, nunca hexadecimales crudos". `bg-yellow-100` is a Tailwind palette colour that
    // exists in no token file — it is exactly what the five duplicated maps were made of.
    for (const status of ORDER_STATUSES) {
      const cls = statusBadgeClass(status);
      expect(cls).toMatch(/bg-\[var\(--[a-z]+-tint\)\]/);
      expect(cls).toMatch(/text-\[var\(--[a-z]+-text\)\]/);
      expect(cls).toMatch(/border-\[var\(--[a-z]+-border\)\]/);
      expect(cls).not.toMatch(/(bg|text|border)-(red|green|blue|yellow|amber|emerald|gray|slate|zinc)-\d/);
    }
  });

  it('uses one tone consistently across all three properties of a badge', () => {
    // A badge with a success tint and a warning border is not a style slip, it is two signals.
    for (const status of ORDER_STATUSES) {
      const tones = [...statusBadgeClass(status).matchAll(/--([a-z]+)-(?:tint|text|border)\)/g)]
        .map((m) => m[1]);
      expect(tones).toHaveLength(3);
      expect(new Set(tones).size).toBe(1);
      expect(tones[0]).toBe(STATUS_TONES[status]);
    }
  });

  it('falls back to the neutral badge for a legacy or unknown value', () => {
    expect(statusBadgeClass('on-hold')).toBe(statusBadgeClass('completed'));
  });
});

describe('statusChartColor', () => {
  it('returns the tone base as a custom-property reference, usable as an SVG fill', () => {
    // Recharts needs a colour value, not a class, so this is the one place a badge class will not
    // do. It still must not be a literal: `FinancialAnalyticsCard` had a nine-entry table of raw
    // `hsl(...)` triples that shared no value with any token file.
    for (const status of ORDER_STATUSES) {
      expect(statusChartColor(status)).toBe(`var(--${STATUS_TONES[status]})`);
    }
  });

  it('falls back to the neutral base for legacy and never-existing values', () => {
    // That same table keyed on `reviewing`, `preparing` and `delivering` — statuses the CHECK
    // constraint never admitted, so those three colours could never have been painted.
    for (const bogus of ['on-hold', 'reviewing', 'preparing', 'delivering', 'paid']) {
      expect(statusChartColor(bogus)).toBe('var(--neutral)');
    }
  });
});
