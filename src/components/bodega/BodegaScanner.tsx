import React, { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { Camera, Check, Loader2, X } from 'lucide-react';
import { ASSET_TAG_FORMAT_ERROR, isValidAssetTag, normalizeAssetTag } from '../../lib/assetTag';
import { formatDay } from '../../lib/bodega';
import { createBarcodeDetector, pickDetectedTag, supportsBarcodeDetector } from '../../lib/bodegaCamera';
import {
  SCAN_ERRORS,
  SCAN_MODE_LABELS,
  allLinesComplete,
  bodegaScanReducer,
  createScanState,
  decideScan,
  isLineComplete,
  lineProgress,
  scanTotals,
  type ScanAsset,
  type ScanMode,
} from '../../lib/bodegaScan';
import { apiClient } from '../../services/apiClient';
import type { ScanSheet } from '../../services/bodegaService';

/**
 * The scan screen. One input, always focused: scan → Enter → recorded → cleared → focused again.
 * A USB/Bluetooth gun in HID mode types the tag and a trailing Enter; a person can type it too.
 *
 * Every decision is in `lib/bodegaScan.ts` (the reducer) and `lib/bodegaCamera.ts`; this
 * component only talks to two endpoints — `GET /api/inventory/assets?tag=` to resolve the label
 * and `POST /api/inventory/movements` to record the movement — and renders the state. Server
 * errors (409 double checkout, etc.) are shown verbatim: the server's Spanish is the truth.
 */
interface BodegaScannerProps {
  sheet: ScanSheet;
}

const FLASH_MS = 600;

export default function BodegaScanner({ sheet }: BodegaScannerProps) {
  const [state, dispatch] = useReducer(bodegaScanReducer, sheet, (s) => createScanState(s.order.id, s.lines));
  const stateRef = useRef(state);
  stateRef.current = state;

  const inputRef = useRef<HTMLInputElement>(null);
  const [value, setValue] = useState('');
  const [busy, setBusy] = useState(false);
  const [flash, setFlash] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    // Read the capability after mount: the SSR pass has no `window`, and a mismatch would be a
    // hydration warning at best.
    setCameraAvailable(supportsBarcodeDetector(typeof window === 'undefined' ? null : window));
  }, []);

  const refocus = useCallback(() => {
    // After the DOM settles — a disabled input cannot take focus.
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, []);

  const celebrate = useCallback(() => {
    navigator.vibrate?.(60);
    setFlash(true);
    window.setTimeout(() => setFlash(false), FLASH_MS);
  }, []);

  const submitTag = useCallback(
    async (raw: string) => {
      if (busy) return;
      const tag = normalizeAssetTag(raw);
      setValue('');

      if (!tag) {
        dispatch({ type: 'scanFailed', error: SCAN_ERRORS.EMPTY });
        refocus();
        return;
      }
      if (!isValidAssetTag(tag)) {
        dispatch({ type: 'scanFailed', error: ASSET_TAG_FORMAT_ERROR });
        refocus();
        return;
      }

      setBusy(true);
      try {
        // Step 1 — resolve the label. Its own try/catch (R4-101): a failure here is a lookup
        // failure, and the reducer names it so.
        let asset: ScanAsset;
        try {
          const lookup = await apiClient.get(`/api/inventory/assets?tag=${encodeURIComponent(tag)}`);
          if (lookup.status === 404) {
            dispatch({ type: 'scanFailed', error: SCAN_ERRORS.NOT_FOUND });
            return;
          }
          const lookupBody = await lookup.json().catch(() => null);
          if (!lookup.ok || !lookupBody?.success) {
            if (lookupBody?.error) dispatch({ type: 'scanFailed', error: lookupBody.error });
            else dispatch({ type: 'lookupFailed' });
            return;
          }
          asset = lookupBody.data as ScanAsset;
        } catch {
          dispatch({ type: 'lookupFailed' });
          return;
        }

        const current = stateRef.current;
        const decision = decideScan(current, asset);
        dispatch({ type: 'scanResolved', asset });
        if (!decision.ok) return;

        // Step 2 — record the movement. A thrown fetch here is a record failure, never a lookup one.
        try {
          const record = await apiClient.post('/api/inventory/movements', {
            asset_id: asset.id,
            order_id: current.orderId,
            direction: current.mode,
          });
          const recordBody = await record.json().catch(() => null);
          if (!record.ok || !recordBody?.success) {
            // The server's Spanish (409 double checkout, etc.) is shown verbatim when present.
            if (recordBody?.error) dispatch({ type: 'scanFailed', error: recordBody.error });
            else dispatch({ type: 'recordFailed' });
            return;
          }
          dispatch({ type: 'movementRecorded', at: recordBody.data?.checked_at || new Date().toISOString() });
          celebrate();
        } catch {
          dispatch({ type: 'recordFailed' });
        }
      } finally {
        setBusy(false);
        refocus();
      }
    },
    [busy, celebrate, refocus]
  );

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    void submitTag(value);
  };

  const setMode = (mode: ScanMode) => {
    dispatch({ type: 'modeChanged', mode });
    refocus();
  };

  const totals = scanTotals(state.lines, state.mode);
  const done = allLinesComplete(state.lines, state.mode);

  return (
    <div className={`space-y-4 transition-colors ${flash ? 'bg-[var(--color-ok-bg)]' : ''}`}>
      <header className="space-y-1">
        <div className="flex items-baseline justify-between gap-2">
          <h1 className="text-lg font-semibold">{sheet.order.reference}</h1>
          <span className={`text-lg font-semibold tabular-nums ${done ? 'text-[var(--color-ok)]' : ''}`}>
            {totals.scanned}/{totals.total}
          </span>
        </div>
        <p className="text-sm">{sheet.order.client}</p>
        <p className="text-sm text-[var(--color-text-secondary)]">{sheet.order.project}</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          {formatDay(sheet.order.startDate)} → {formatDay(sheet.order.endDate)}
        </p>
      </header>

      <div role="radiogroup" aria-label="Dirección del movimiento" className="grid grid-cols-2 gap-2">
        {(Object.keys(SCAN_MODE_LABELS) as ScanMode[]).map((mode) => {
          const active = state.mode === mode;
          return (
            <button
              key={mode}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => setMode(mode)}
              className={`min-h-[48px] rounded-[10px] border text-base font-semibold ${
                active
                  ? 'border-[var(--color-ink,#0A0A0A)] bg-[var(--color-ink,#0A0A0A)] text-white'
                  : 'border-[var(--color-border)] bg-white'
              }`}
            >
              {SCAN_MODE_LABELS[mode]}
            </button>
          );
        })}
      </div>

      <div className="space-y-2">
        <label htmlFor="bodega-tag" className="text-sm font-medium">
          Escanea el asset tag
        </label>
        <div className="flex gap-2">
          <input
            ref={inputRef}
            id="bodega-tag"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            inputMode="text"
            enterKeyHint="done"
            placeholder="MH-00001"
            disabled={busy}
            className="min-h-[52px] flex-1 rounded-[10px] border border-[var(--color-border)] px-4 font-mono text-lg uppercase tracking-wider disabled:opacity-60"
          />
          {cameraAvailable && (
            <button
              type="button"
              onClick={() => setCameraOpen(true)}
              className="inline-flex min-h-[52px] min-w-[52px] items-center justify-center rounded-[10px] border border-[var(--color-border)] bg-white"
              aria-label="Escanear con la cámara"
            >
              <Camera className="h-6 w-6" />
            </button>
          )}
        </div>
        <div className="min-h-[24px]" aria-live="polite">
          {busy && (
            <span className="inline-flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
              <Loader2 className="h-4 w-4 animate-spin" /> Registrando…
            </span>
          )}
          {!busy && state.message && (
            <span
              role={state.message.tone === 'error' ? 'alert' : undefined}
              className={`inline-flex items-center gap-2 text-sm font-medium ${
                state.message.tone === 'ok' ? 'text-[var(--color-ok)]' : 'text-[var(--color-crit)]'
              }`}
            >
              {state.message.tone === 'ok' ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
              {state.message.text}
            </span>
          )}
        </div>
      </div>

      <section aria-label="Líneas de la orden">
        <ul className="divide-y divide-[var(--color-border)] rounded-[10px] border border-[var(--color-border)]">
          {state.lines.map((line) => {
            const complete = isLineComplete(line, state.mode);
            return (
              <li key={line.productId} className="flex items-center justify-between gap-3 p-3">
                <span className="min-w-0 flex-1 truncate text-sm font-medium">{line.name}</span>
                <span className={`font-semibold tabular-nums ${complete ? 'text-[var(--color-ok)]' : ''}`}>
                  {lineProgress(line, state.mode)}/{line.quantity}
                </span>
              </li>
            );
          })}
          {state.lines.length === 0 && (
            <li className="p-3 text-sm text-[var(--color-text-secondary)]">Esta orden no tiene equipos listados.</li>
          )}
        </ul>
      </section>

      <section aria-label="Escaneadas">
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Escaneadas ({state.scanned.length})
        </h2>
        {state.scanned.length === 0 ? (
          <p className="text-sm text-[var(--color-text-secondary)]">Todavía no escaneas ninguna unidad.</p>
        ) : (
          <ul className="space-y-1">
            {state.scanned.map((unit) => (
              <li key={`${unit.assetId}-${unit.at}`} className="flex items-center gap-3 rounded-[10px] bg-[var(--color-surface-2)] px-3 py-2 text-sm">
                <span className="font-mono font-semibold">{unit.assetTag}</span>
                <span className="min-w-0 flex-1 truncate">
                  {unit.modelName} · <span className="text-[var(--color-text-secondary)]">{unit.serialNumber}</span>
                </span>
                <span className="text-xs text-[var(--color-text-secondary)] tabular-nums">
                  {new Date(unit.at).toLocaleTimeString('es-CL', { hour: '2-digit', minute: '2-digit' })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {cameraOpen && (
        <CameraSheet
          onDetected={(tag) => {
            setCameraOpen(false);
            void submitTag(tag);
          }}
          onClose={() => {
            setCameraOpen(false);
            refocus();
          }}
        />
      )}
    </div>
  );
}

interface CameraSheetProps {
  onDetected: (tag: string) => void;
  onClose: () => void;
}

const DETECT_INTERVAL_MS = 300;

/**
 * Native `BarcodeDetector` over a live `getUserMedia` stream. Rendered only when the capability
 * exists. Stops the stream on close and on unmount — a camera left on is a battery and a
 * privacy problem.
 */
function CameraSheet({ onDetected, onClose }: CameraSheetProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer: number | null = null;
    let cancelled = false;
    const detector = createBarcodeDetector(window);

    const stop = () => {
      if (timer !== null) window.clearInterval(timer);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    if (!detector) {
      setError('Este navegador no puede leer códigos con la cámara.');
      return stop;
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: 'environment' } })
      .then((mediaStream) => {
        if (cancelled) {
          mediaStream.getTracks().forEach((track) => track.stop());
          return;
        }
        stream = mediaStream;
        const video = videoRef.current;
        if (!video) return;
        video.srcObject = mediaStream;
        void video.play();

        timer = window.setInterval(async () => {
          if (!video || video.readyState < 2) return;
          try {
            const tag = pickDetectedTag(await detector.detect(video));
            if (tag) {
              stop();
              onDetected(tag);
            }
          } catch {
            // A frame that cannot be decoded is not an error; the next one may.
          }
        }, DETECT_INTERVAL_MS);
      })
      .catch(() => setError('No se pudo abrir la cámara. Revisa el permiso del navegador.'));

    return () => {
      cancelled = true;
      stop();
    };
  }, [onDetected]);

  return (
    <div role="dialog" aria-modal="true" aria-label="Escanear con la cámara" className="fixed inset-0 z-30 flex flex-col bg-black">
      <video ref={videoRef} className="flex-1 object-cover" muted playsInline />
      {error && (
        <p role="alert" className="bg-white p-3 text-sm text-[var(--color-crit)]">
          {error}
        </p>
      )}
      <button
        type="button"
        onClick={onClose}
        className="m-4 inline-flex min-h-[48px] items-center justify-center gap-2 rounded-[10px] bg-white text-base font-semibold"
      >
        <X className="h-5 w-5" /> Cerrar
      </button>
    </div>
  );
}
