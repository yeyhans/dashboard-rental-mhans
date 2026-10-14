import { cn } from "@/lib/utils";
import type { UnitDisplayStatus } from "../../../types/inventory";
import { CANON_TONE_CLASSES, unitStatusLabel, unitStatusTone, type CanonTone } from "./unitStatus";

type UnitStatusPillProps =
  | { status: UnitDisplayStatus; tone?: never; label?: never; className?: string }
  | { status?: never; tone: CanonTone; label: string; className?: string };

/** Canon `.badge` + `.badge-dot`: pill, 11px/500, 5px dot in the status ink. */
export function UnitStatusPill(props: UnitStatusPillProps) {
  const tone = props.status ? unitStatusTone(props.status) : props.tone;
  const label = props.status ? unitStatusLabel(props.status) : props.label;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] whitespace-nowrap rounded-full px-2.5 py-[3px] text-[11px] font-medium",
        CANON_TONE_CLASSES[tone as CanonTone],
        props.className,
      )}
    >
      <span aria-hidden="true" className="inline-block h-[5px] w-[5px] rounded-full bg-current" />
      {label}
    </span>
  );
}

export default UnitStatusPill;
