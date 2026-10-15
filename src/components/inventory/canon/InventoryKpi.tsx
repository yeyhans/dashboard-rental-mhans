import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { CANON_TONE_CLASSES, CANON_TONE_TEXT, type CanonTone } from "./unitStatus";

export interface InventoryKpiProps {
  icon: LucideIcon;
  tone: Exclude<CanonTone, "neutral" | "crit">;
  label: string;
  value: number | string;
  sub: string;
  /** Tint the value and the subtitle with the status ink (canon does it for Disponibles/Arriendo/Mantención). */
  isValueTinted?: boolean;
  isSubTinted?: boolean;
}

/** Canon `.kpi-card`: white card, 8px radius, 32px tinted icon tile, 26px/700 value. */
export function InventoryKpi({ icon: Icon, tone, label, value, sub, isValueTinted, isSubTinted }: InventoryKpiProps) {
  return (
    <div className="rounded-[8px] border border-[#EAEAEA] bg-white px-[18px] py-4">
      <div className="mb-2 flex items-center gap-2">
        <div className={cn("grid h-8 w-8 place-items-center rounded-[6px]", CANON_TONE_CLASSES[tone])}>
          <Icon aria-hidden="true" className="h-4 w-4" />
        </div>
        <div className="text-[11px] leading-[1.3] text-[#666666]">{label}</div>
      </div>
      <div className={cn("mb-1 text-[26px] font-bold tracking-[-0.03em] text-[#111111]", isValueTinted && CANON_TONE_TEXT[tone])}>
        {value}
      </div>
      <div className={cn("text-[11px] text-[#666666]", isSubTinted && CANON_TONE_TEXT[tone])}>{sub}</div>
    </div>
  );
}

export default InventoryKpi;
