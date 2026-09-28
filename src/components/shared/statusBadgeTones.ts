/**
 * Tone classes shared by `StatusBadge` (D-03).
 *
 * Kept as pure data, same convention as `statusBadgeClass` in `src/lib/orderStatus.ts`: the
 * project has no jsdom or testing-library, so a class-name lookup is fully covered by a plain
 * unit test, while only the render structure itself needs `react-dom/server`.
 *
 * These five tones are the ones D-03 asks for (ok/info/warn/crit/neutral) — a subset of
 * `StatusTone` in `orderStatus.ts`, which also carries `muted` for the one order status
 * (`cancelled`) that reads greyer than `neutral`. `StatusBadge` is a generic primitive other
 * modules will use for state that isn't an order status, so it does not depend on that module.
 */
export const BADGE_TONES = ["ok", "info", "warn", "crit", "neutral"] as const;

export type BadgeTone = (typeof BADGE_TONES)[number];

export function isBadgeTone(value: unknown): value is BadgeTone {
  return (
    typeof value === "string" &&
    (BADGE_TONES as readonly string[]).includes(value)
  );
}

const TONE_PILL_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-[var(--color-ok-bg)] text-[var(--color-ok)]",
  info: "bg-[var(--color-info-bg)] text-[var(--color-info)]",
  warn: "bg-[var(--color-warn-bg)] text-[var(--color-warn)]",
  crit: "bg-[var(--color-crit-bg)] text-[var(--color-crit)]",
  neutral: "bg-[var(--color-neutral-bg)] text-[var(--color-neutral)]",
};

const TONE_DOT_CLASSES: Record<BadgeTone, string> = {
  ok: "bg-[var(--color-ok)]",
  info: "bg-[var(--color-info)]",
  warn: "bg-[var(--color-warn)]",
  crit: "bg-[var(--color-crit)]",
  neutral: "bg-[var(--color-neutral)]",
};

/** Falls back to `neutral` for an unrecognised tone, same rule as `statusTone` in `orderStatus.ts`. */
export function badgePillClass(tone: unknown): string {
  return TONE_PILL_CLASSES[isBadgeTone(tone) ? tone : "neutral"];
}

export function badgeDotClass(tone: unknown): string {
  return TONE_DOT_CLASSES[isBadgeTone(tone) ? tone : "neutral"];
}
