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
  /**
   * `canon`: the Pedidos RC2.1.2 `.badge` typography (10px semibold uppercase, tracked, 3x9
   * padding). `default` keeps the original sentence-case pill for every other caller.
   */
  variant?: "default" | "canon";
}

const VARIANT_CLASSES = {
  default: "gap-1.5 px-2.5 py-0.5 text-xs font-medium",
  canon:
    "gap-[5px] whitespace-nowrap px-[9px] py-[3px] text-[10px] font-semibold uppercase tracking-[0.04em]",
} as const;

/**
 * Pill status badge with a leading dot (D-03, canonical patterns P2/P9).
 *
 * Tone → class mapping lives in `statusBadgeTones.ts` as plain data, not inline here, so it is
 * fully covered by a unit test that needs neither jsdom nor a DOM testing library.
 */
export function StatusBadge({
  tone,
  label,
  className,
  variant = "default",
}: StatusBadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full",
        VARIANT_CLASSES[variant] ?? VARIANT_CLASSES.default,
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
