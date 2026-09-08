import type { MovementDirection } from '../types/assetMovements';

/**
 * The scan screen's brain — a reducer with no DOM, no fetch, no timers.
 *
 * `/bodega/orden/[id]` is one input the worker never leaves: scan, Enter, scan, Enter. Every
 * decision that input triggers lives here so it can be tested exhaustively without a browser:
 * does this unit belong to the order, is its line already complete, what does the list of
 * scanned units look like after the server said yes. The component only wires events to
 * `fetch` and renders the state.
 *
 * Two-phase flow, because the movement is recorded by the server:
 *
 *   scanResolved   — the asset lookup came back; the reducer decides whether to record it and,
 *                    if so, parks it as `pending`;
 *   movementRecorded — the POST succeeded; `pending` becomes a scanned unit and its line advances;
 *   scanFailed     — the lookup or the POST failed; the message is shown, `pending` is cleared.
 *
 * Progress per line depends on the mode: in `checkout` it counts units currently out on this
 * order; in `checkin` it counts units that have come back. Both counts are loaded once from the
 * server (`ScanLine.open` / `.returned`) and advanced locally after each recorded movement.
 */

export type ScanMode = MovementDirection;

export const SCAN_MODE_LABELS: Record<ScanMode, string> = {
  checkout: 'Salida',
  checkin: 'Entrada',
};

export const SCAN_ERRORS = {
  NOT_FOUND: 'No existe una unidad con ese asset tag',
  NOT_IN_ORDER: 'Esta unidad no pertenece a esta orden',
  LINE_COMPLETE: 'Esta línea ya está completa',
  EMPTY: 'Escanea o escribe un asset tag',
  LOOKUP_FAILED: 'No se pudo consultar la unidad. Revisa la conexión e inténtalo de nuevo',
  RECORD_FAILED: 'No se pudo registrar el movimiento. Inténtalo de nuevo',
} as const;

export interface ScanLine {
  readonly productId: number;
  readonly name: string;
  readonly quantity: number;
  /** Units of this product currently out on this order. */
  readonly open: number;
  /** Units of this product that left on this order and have come back. */
  readonly returned: number;
}

export interface ScanAsset {
  readonly id: number;
  readonly product_id: number;
  readonly asset_tag: string;
  readonly serial_number: string;
}

export interface ScannedUnit {
  readonly assetId: number;
  readonly assetTag: string;
  readonly serialNumber: string;
  readonly modelName: string;
  readonly direction: ScanMode;
  /** ISO timestamp of the recorded movement. */
  readonly at: string;
}

export interface ScanMessage {
  readonly tone: 'ok' | 'error';
  readonly text: string;
}

export interface ScanState {
  readonly orderId: number;
  readonly mode: ScanMode;
  readonly lines: readonly ScanLine[];
  readonly scanned: readonly ScannedUnit[];
  readonly pending: ScanAsset | null;
  readonly message: ScanMessage | null;
}

export type ScanEvent =
  | { type: 'modeChanged'; mode: ScanMode }
  | { type: 'scanResolved'; asset: ScanAsset }
  | { type: 'movementRecorded'; at: string }
  /** A failure with the message to show — a server body, or one of `SCAN_ERRORS`. */
  | { type: 'scanFailed'; error: string }
  /** The asset lookup itself failed (network, non-JSON, 5xx): `LOOKUP_FAILED` (R4-101). */
  | { type: 'lookupFailed' }
  /** The movement POST itself failed after a successful lookup: `RECORD_FAILED` (R4-101). */
  | { type: 'recordFailed' }
  | { type: 'messageCleared' };

/** Salida when nothing is out yet; Entrada as soon as anything is. */
export function initialMode(lines: readonly ScanLine[]): ScanMode {
  return lines.some((line) => line.open > 0) ? 'checkin' : 'checkout';
}

export function createScanState(orderId: number, lines: readonly ScanLine[], mode?: ScanMode): ScanState {
  return {
    orderId,
    mode: mode ?? initialMode(lines),
    lines,
    scanned: [],
    pending: null,
    message: null,
  };
}

/** `n` of `scanned/quantity` for the current mode. */
export function lineProgress(line: ScanLine, mode: ScanMode): number {
  return mode === 'checkout' ? line.open : line.returned;
}

export function isLineComplete(line: ScanLine, mode: ScanMode): boolean {
  return lineProgress(line, mode) >= line.quantity;
}

export function allLinesComplete(lines: readonly ScanLine[], mode: ScanMode): boolean {
  return lines.length > 0 && lines.every((line) => isLineComplete(line, mode));
}

export type ScanDecision = { ok: true; line: ScanLine } | { ok: false; error: string };

/** Whether a resolved asset may be recorded in the current mode. Pure; the reducer applies it. */
export function decideScan(state: Pick<ScanState, 'lines' | 'mode'>, asset: ScanAsset): ScanDecision {
  const line = state.lines.find((candidate) => candidate.productId === asset.product_id);
  if (!line) return { ok: false, error: SCAN_ERRORS.NOT_IN_ORDER };
  if (isLineComplete(line, state.mode)) return { ok: false, error: SCAN_ERRORS.LINE_COMPLETE };
  return { ok: true, line };
}

function advance(line: ScanLine, mode: ScanMode): ScanLine {
  return mode === 'checkout'
    ? { ...line, open: line.open + 1 }
    : { ...line, open: Math.max(0, line.open - 1), returned: line.returned + 1 };
}

export function bodegaScanReducer(state: ScanState, event: ScanEvent): ScanState {
  switch (event.type) {
    case 'modeChanged':
      if (event.mode === state.mode) return state;
      return { ...state, mode: event.mode, pending: null, message: null };

    case 'scanResolved': {
      const decision = decideScan(state, event.asset);
      if (!decision.ok) {
        return { ...state, pending: null, message: { tone: 'error', text: decision.error } };
      }
      return { ...state, pending: event.asset, message: null };
    }

    case 'movementRecorded': {
      const asset = state.pending;
      if (!asset) return state;
      const line = state.lines.find((candidate) => candidate.productId === asset.product_id);
      const unit: ScannedUnit = {
        assetId: asset.id,
        assetTag: asset.asset_tag,
        serialNumber: asset.serial_number,
        modelName: line?.name ?? `Producto ${asset.product_id}`,
        direction: state.mode,
        at: event.at,
      };
      return {
        ...state,
        pending: null,
        lines: state.lines.map((candidate) =>
          candidate.productId === asset.product_id ? advance(candidate, state.mode) : candidate
        ),
        scanned: [unit, ...state.scanned],
        message: { tone: 'ok', text: `${asset.asset_tag} · ${unit.modelName}` },
      };
    }

    case 'scanFailed':
      return { ...state, pending: null, message: { tone: 'error', text: event.error } };

    case 'lookupFailed':
      return { ...state, pending: null, message: { tone: 'error', text: SCAN_ERRORS.LOOKUP_FAILED } };

    case 'recordFailed':
      return { ...state, pending: null, message: { tone: 'error', text: SCAN_ERRORS.RECORD_FAILED } };

    case 'messageCleared':
      return state.message ? { ...state, message: null } : state;

    default:
      return state;
  }
}

/** Sum across lines of `scanned/quantity`, for the header. */
export function scanTotals(lines: readonly ScanLine[], mode: ScanMode): { scanned: number; total: number } {
  return lines.reduce(
    (acc, line) => ({
      scanned: acc.scanned + Math.min(line.quantity, lineProgress(line, mode)),
      total: acc.total + line.quantity,
    }),
    { scanned: 0, total: 0 }
  );
}
