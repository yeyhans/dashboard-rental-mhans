import { describe, expect, it } from 'vitest';

import {
  SCAN_ERRORS,
  SCAN_MODE_LABELS,
  allLinesComplete,
  bodegaScanReducer,
  createScanState,
  decideScan,
  initialMode,
  isLineComplete,
  lineProgress,
  scanTotals,
  type ScanAsset,
  type ScanLine,
  type ScanState,
} from '../bodegaScan';

/**
 * The scan screen's reducer. Every branch the worker can hit with a scanner in hand: a unit that
 * is not on the order, a line already full, the server saying no, and the happy path in both
 * directions. No DOM — the component is a thin shell over this.
 */
const LINES: ScanLine[] = [
  { productId: 1, name: 'Canon R5', quantity: 2, open: 0, returned: 0 },
  { productId: 2, name: 'Profoto B10', quantity: 1, open: 0, returned: 0 },
];

const r5a: ScanAsset = { id: 100, product_id: 1, asset_tag: 'MH-00100', serial_number: 'SN-A' };
const r5b: ScanAsset = { id: 101, product_id: 1, asset_tag: 'MH-00101', serial_number: 'SN-B' };
const b10: ScanAsset = { id: 200, product_id: 2, asset_tag: 'MH-00200', serial_number: 'SN-C' };
const tripod: ScanAsset = { id: 300, product_id: 9, asset_tag: 'MH-00300', serial_number: 'SN-T' };

function fresh(lines = LINES, mode?: 'checkout' | 'checkin'): ScanState {
  return createScanState(55, lines, mode);
}

/** Runs the two-phase happy path for one asset. */
function record(state: ScanState, asset: ScanAsset, at = '2026-09-08T10:00:00Z'): ScanState {
  const resolved = bodegaScanReducer(state, { type: 'scanResolved', asset });
  return bodegaScanReducer(resolved, { type: 'movementRecorded', at });
}

describe('initialMode / createScanState', () => {
  it('starts in Salida when nothing is out, Entrada as soon as anything is', () => {
    expect(initialMode(LINES)).toBe('checkout');
    expect(initialMode([{ ...LINES[0]!, open: 1 }, LINES[1]!])).toBe('checkin');
    expect(fresh().mode).toBe('checkout');
  });

  it('accepts an explicit mode', () => {
    expect(fresh(LINES, 'checkin').mode).toBe('checkin');
  });

  it('labels are the Spanish toggle copy', () => {
    expect(SCAN_MODE_LABELS).toEqual({ checkout: 'Salida', checkin: 'Entrada' });
  });
});

describe('line progress', () => {
  const line: ScanLine = { productId: 1, name: 'x', quantity: 2, open: 1, returned: 1 };

  it('counts units out in Salida and units back in Entrada', () => {
    expect(lineProgress(line, 'checkout')).toBe(1);
    expect(lineProgress(line, 'checkin')).toBe(1);
    expect(isLineComplete({ ...line, open: 2 }, 'checkout')).toBe(true);
    expect(isLineComplete({ ...line, returned: 2 }, 'checkin')).toBe(true);
  });

  it('allLinesComplete is false for an empty order', () => {
    expect(allLinesComplete([], 'checkout')).toBe(false);
    expect(allLinesComplete([{ ...line, open: 2 }], 'checkout')).toBe(true);
  });

  it('scanTotals sums and caps at each line quantity', () => {
    expect(scanTotals([line, { ...line, productId: 2, open: 5 }], 'checkout')).toEqual({ scanned: 3, total: 4 });
  });
});

describe('decideScan', () => {
  it('rejects a unit whose product is not on the order', () => {
    expect(decideScan(fresh(), tripod)).toEqual({ ok: false, error: SCAN_ERRORS.NOT_IN_ORDER });
  });

  it('rejects a unit whose line is already complete in the current mode', () => {
    const state = fresh([{ ...LINES[0]!, open: 2 }, LINES[1]!], 'checkout');
    expect(decideScan(state, r5a)).toEqual({ ok: false, error: SCAN_ERRORS.LINE_COMPLETE });
    // Same line is NOT complete for Entrada — nothing has come back yet.
    expect(decideScan({ ...state, mode: 'checkin' }, r5a).ok).toBe(true);
  });

  it('accepts and names the line', () => {
    const decision = decideScan(fresh(), b10);
    expect(decision.ok).toBe(true);
    if (decision.ok) expect(decision.line.name).toBe('Profoto B10');
  });
});

describe('bodegaScanReducer — Salida happy path', () => {
  it('parks the asset as pending, then records it and advances the line', () => {
    const resolved = bodegaScanReducer(fresh(), { type: 'scanResolved', asset: r5a });
    expect(resolved.pending).toEqual(r5a);
    expect(resolved.message).toBeNull();
    expect(resolved.lines).toEqual(LINES); // nothing advanced until the server says yes

    const recorded = bodegaScanReducer(resolved, { type: 'movementRecorded', at: '2026-09-08T10:00:00Z' });
    expect(recorded.pending).toBeNull();
    expect(recorded.lines[0]).toMatchObject({ open: 1, returned: 0 });
    expect(recorded.scanned).toEqual([
      {
        assetId: 100,
        assetTag: 'MH-00100',
        serialNumber: 'SN-A',
        modelName: 'Canon R5',
        direction: 'checkout',
        at: '2026-09-08T10:00:00Z',
      },
    ]);
    expect(recorded.message).toEqual({ tone: 'ok', text: 'MH-00100 · Canon R5' });
  });

  it('newest scan first in the list; the line closes after its quantity', () => {
    let state = record(fresh(), r5a, '2026-09-08T10:00:00Z');
    state = record(state, r5b, '2026-09-08T10:01:00Z');
    expect(state.scanned.map((u) => u.assetTag)).toEqual(['MH-00101', 'MH-00100']);
    expect(isLineComplete(state.lines[0]!, 'checkout')).toBe(true);

    const third = bodegaScanReducer(state, { type: 'scanResolved', asset: { ...r5a, id: 102, asset_tag: 'MH-00102' } });
    expect(third.pending).toBeNull();
    expect(third.message).toEqual({ tone: 'error', text: SCAN_ERRORS.LINE_COMPLETE });
  });

  it('reports the whole order complete once every line is', () => {
    let state = record(fresh(), r5a);
    state = record(state, r5b);
    expect(allLinesComplete(state.lines, 'checkout')).toBe(false);
    state = record(state, b10);
    expect(allLinesComplete(state.lines, 'checkout')).toBe(true);
    expect(scanTotals(state.lines, 'checkout')).toEqual({ scanned: 3, total: 3 });
  });
});

describe('bodegaScanReducer — Entrada', () => {
  const outLines: ScanLine[] = [
    { productId: 1, name: 'Canon R5', quantity: 2, open: 2, returned: 0 },
    { productId: 2, name: 'Profoto B10', quantity: 1, open: 1, returned: 0 },
  ];

  it('auto-selects Entrada and moves a unit from open to returned', () => {
    const state = fresh(outLines);
    expect(state.mode).toBe('checkin');
    const recorded = record(state, r5a);
    expect(recorded.lines[0]).toMatchObject({ open: 1, returned: 1 });
    expect(recorded.scanned[0]?.direction).toBe('checkin');
  });

  it('never drives open below zero', () => {
    const state = fresh([{ productId: 1, name: 'Canon R5', quantity: 2, open: 0, returned: 0 }], 'checkin');
    const recorded = record(state, r5a);
    expect(recorded.lines[0]).toMatchObject({ open: 0, returned: 1 });
  });
});

describe('bodegaScanReducer — errors and mode switching', () => {
  it('scanFailed shows the server message verbatim and drops the pending asset', () => {
    const resolved = bodegaScanReducer(fresh(), { type: 'scanResolved', asset: r5a });
    const failed = bodegaScanReducer(resolved, {
      type: 'scanFailed',
      error: 'El equipo ya tiene una salida abierta',
    });
    expect(failed.pending).toBeNull();
    expect(failed.message).toEqual({ tone: 'error', text: 'El equipo ya tiene una salida abierta' });
    expect(failed.lines).toEqual(LINES);
    expect(failed.scanned).toEqual([]);
  });

  // R4-101: the two network steps fail with different messages, decided here, not in the component.
  it('lookupFailed says the lookup failed and leaves the sheet untouched', () => {
    const failed = bodegaScanReducer(fresh(), { type: 'lookupFailed' });
    expect(failed.message).toEqual({ tone: 'error', text: SCAN_ERRORS.LOOKUP_FAILED });
    expect(failed.pending).toBeNull();
    expect(failed.lines).toEqual(LINES);
  });

  it('recordFailed after a resolved scan says the record failed and drops the pending asset', () => {
    const resolved = bodegaScanReducer(fresh(), { type: 'scanResolved', asset: r5a });
    const failed = bodegaScanReducer(resolved, { type: 'recordFailed' });
    expect(failed.message).toEqual({ tone: 'error', text: SCAN_ERRORS.RECORD_FAILED });
    expect(failed.pending).toBeNull();
    expect(failed.lines).toEqual(LINES);
    expect(failed.scanned).toEqual([]);
  });

  it('movementRecorded without a pending asset is a no-op', () => {
    const state = fresh();
    expect(bodegaScanReducer(state, { type: 'movementRecorded', at: 'x' })).toBe(state);
  });

  it('switching mode clears pending and message; same mode is a no-op', () => {
    const resolved = bodegaScanReducer(fresh(), { type: 'scanResolved', asset: r5a });
    const switched = bodegaScanReducer(resolved, { type: 'modeChanged', mode: 'checkin' });
    expect(switched.mode).toBe('checkin');
    expect(switched.pending).toBeNull();
    expect(bodegaScanReducer(switched, { type: 'modeChanged', mode: 'checkin' })).toBe(switched);
  });

  it('messageCleared clears, and is a no-op when there is nothing to clear', () => {
    const state = fresh();
    expect(bodegaScanReducer(state, { type: 'messageCleared' })).toBe(state);
    const failed = bodegaScanReducer(state, { type: 'scanFailed', error: 'x' });
    expect(bodegaScanReducer(failed, { type: 'messageCleared' }).message).toBeNull();
  });

  it('a not-in-order scan leaves lines and list untouched', () => {
    const state = bodegaScanReducer(fresh(), { type: 'scanResolved', asset: tripod });
    expect(state.message?.text).toBe(SCAN_ERRORS.NOT_IN_ORDER);
    expect(state.lines).toEqual(LINES);
    expect(state.scanned).toEqual([]);
    expect(state.pending).toBeNull();
  });
});
