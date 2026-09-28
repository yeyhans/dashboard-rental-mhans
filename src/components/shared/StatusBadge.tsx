import { cn } from "../../lib/utils";
import {
  badgeDotClass,
  badgePillClass,
  type BadgeTone,
} from "./statusBadgeTones";

interface StatusBadgeProps {
  /** ok/info/warn/crit/neutral — the five Área 01 canonical state tones. */
  tone: BadgeTone;
  label: string;
  className?: string;
}

/**
 * Pill status badge with a leading dot (D-03, canonical patterns P2/P9).
 *
 * Tone → class mapping lives in `statusBadgeTones.ts` as plain data, not inline here, so it is
 * fully covered by a unit test that needs neither jsdom nor a DOM testing library.
 */
export function StatusBadge({ tone, label, className }: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium",
        badgePillClass(tone),
        className,
      )}
    >
      <span
        className={cn("h-1.5 w-1.5 rounded-full", badgeDotClass(tone))}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
