import React, { useMemo, useState } from "react";
import { isReturnDue } from "../../lib/checkInReception";
import type { ScanSheet } from "../../services/bodegaService";
import CheckInReceptionPanel from "../checkin/CheckInReceptionPanel";
import BodegaScanner from "./BodegaScanner";

/**
 * R-04b: the operator's order screen for a return. Bodega and Check-In share one reception flow
 * (owner decision 2026-10-13): the gun scanner stays the primary input, and the same
 * `CheckInReceptionPanel` the admin uses on /check-in sits below it in its mobile variant.
 *
 * Every unit checked in — already back when the page loaded (`ScanLine.returned`) or scanned now —
 * is counted per product and handed to the panel, which marks a line Recibido once all of its
 * units are back. "Finalizar devolución" closes the order through
 * `POST /api/bodega/orders/[id]/finalize`, which operators can reach.
 */
interface BodegaReturnScreenProps {
  sheet: ScanSheet;
  /** Server-resolved business day (`YYYY-MM-DD`). */
  todayIsoDay: string;
}

/** Orders that open this screen: a return, or a rental whose end date has arrived. */
export function isReturnScreenOrder(
  status: string | null | undefined,
  endDate: string | null | undefined,
  todayIsoDay: string,
): boolean {
  if (status === "return") return true;
  return status === "in-rental" && isReturnDue(endDate, todayIsoDay);
}

export default function BodegaReturnScreen({
  sheet,
  todayIsoDay,
}: BodegaReturnScreenProps) {
  const alreadyBack = useMemo(() => {
    const units: Record<number, number> = {};
    for (const line of sheet.lines) {
      units[line.productId] = (units[line.productId] ?? 0) + line.returned;
    }
    return units;
  }, [sheet.lines]);

  const [scannedNow, setScannedNow] = useState<Record<number, number>>({});

  const checkedInUnits = useMemo(() => {
    const merged: Record<number, number> = { ...alreadyBack };
    for (const [productId, units] of Object.entries(scannedNow)) {
      merged[Number(productId)] = (merged[Number(productId)] ?? 0) + units;
    }
    return merged;
  }, [alreadyBack, scannedNow]);

  const handleCheckedIn = (productId: number) =>
    setScannedNow((prev) => ({
      ...prev,
      [productId]: (prev[productId] ?? 0) + 1,
    }));

  return (
    <div className="space-y-6">
      <BodegaScanner sheet={sheet} onCheckedIn={handleCheckedIn} />

      <section
        aria-label="Recepción de la devolución"
        className="rounded-[10px] border border-[var(--color-border)] bg-[var(--color-surface)]"
      >
        <h2 className="border-b border-[var(--color-border)] px-4 py-3 text-sm font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
          Recepción
        </h2>
        <CheckInReceptionPanel
          variant="mobile"
          todayIsoDay={todayIsoDay}
          checkedInUnits={checkedInUnits}
          entry={{
            id: sheet.order.id,
            reference: sheet.order.reference,
            client: sheet.order.client,
            project: sheet.order.project,
            status: sheet.order.status ?? "",
            endDate: sheet.order.endDate,
            lineItems: sheet.lineItems,
          }}
        />
      </section>
    </div>
  );
}
