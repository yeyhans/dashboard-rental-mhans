import { useRef, useState, type KeyboardEvent, type PointerEvent } from "react";
import { WAREHOUSE_ROOM_SIZE_M } from "../../../types/inventory";
import {
  PLAN_MARGIN,
  PLAN_SCALE,
  PLAN_VIEW_SIZE,
  formatMetres,
  nudgePosition,
  pointerToRoom,
  type PlanItem,
  type PlanPoint,
} from "./locationPlan";

export interface WarehousePlanProps {
  items: PlanItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  /** Fired once per finished move (pointer released, or each arrow press). */
  onMove: (id: string, position: PlanPoint) => void;
}

const ROOM = WAREHOUSE_ROOM_SIZE_M * PLAN_SCALE;

const KIND_STYLE: Record<PlanItem["kind"], { fill: string; stroke: string; dash?: string }> = {
  shelf: { fill: "#F7F7F6", stroke: "#111111" },
  box: { fill: "#FBF3DE", stroke: "#8A6A1E" },
  floor: { fill: "#FFFFFF", stroke: "#666666", dash: "6 4" },
  rug: { fill: "#EAF0FA", stroke: "#2E5490", dash: "8 5" },
  level: { fill: "#F7F7F6", stroke: "#111111" },
};

const unitsLabel = (n: number) => (n === 1 ? "1 unidad" : `${n} unidades`);

export function itemAriaLabel(item: PlanItem, position: PlanPoint = item): string {
  const units = item.unitCount === null ? "" : `, ${unitsLabel(item.unitCount)}`;
  return `${item.code} · ${item.name}${units}, x ${formatMetres(position.x)}, y ${formatMetres(position.y)}`;
}

/**
 * Top view of the ~5 x 5 m warehouse (north up). Items are focusable: arrows nudge 0.1 m (Shift:
 * 0.5 m), Enter/Space selects; dragging snaps to 0.1 m and saves on release.
 */
export function WarehousePlan({ items, selectedId, onSelect, onMove }: WarehousePlanProps) {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [drag, setDrag] = useState<{ id: string; position: PlanPoint; hasMoved: boolean } | null>(null);

  const positionFromEvent = (event: PointerEvent<SVGElement>): PlanPoint | null => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? pointerToRoom(event.clientX, event.clientY, rect) : null;
  };

  const handlePointerDown = (event: PointerEvent<SVGGElement>, item: PlanItem) => {
    event.preventDefault();
    onSelect(item.id);
    svgRef.current?.setPointerCapture?.(event.pointerId);
    setDrag({ id: item.id, position: { x: item.x, y: item.y }, hasMoved: false });
  };

  const handlePointerMove = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    const position = positionFromEvent(event);
    if (position && (position.x !== drag.position.x || position.y !== drag.position.y)) {
      setDrag({ ...drag, position, hasMoved: true });
    }
  };

  const handlePointerUp = (event: PointerEvent<SVGSVGElement>) => {
    if (!drag) return;
    svgRef.current?.releasePointerCapture?.(event.pointerId);
    if (drag.hasMoved) onMove(drag.id, drag.position);
    setDrag(null);
  };

  const handleKeyDown = (event: KeyboardEvent<SVGGElement>, item: PlanItem) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onSelect(item.id);
      return;
    }
    const next = nudgePosition({ x: item.x, y: item.y }, event.key, event.shiftKey);
    if (!next) return;
    event.preventDefault();
    onSelect(item.id);
    if (next.x !== item.x || next.y !== item.y) onMove(item.id, next);
  };

  const gridLines = Array.from({ length: WAREHOUSE_ROOM_SIZE_M * 2 - 1 }, (_, i) => (i + 1) * (PLAN_SCALE / 2));

  return (
    <svg
      ref={svgRef}
      viewBox={`${-PLAN_MARGIN} ${-PLAN_MARGIN} ${PLAN_VIEW_SIZE} ${PLAN_VIEW_SIZE}`}
      className="h-auto w-full touch-none select-none"
      role="group"
      aria-label="Plano de la bodega, vista superior de 5 x 5 metros con el norte arriba"
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <rect x={0} y={0} width={ROOM} height={ROOM} fill="#FFFFFF" />
      {gridLines.map((offset) => (
        <g key={offset} stroke="#F0F0EF" strokeWidth={1}>
          <line x1={offset} y1={0} x2={offset} y2={ROOM} />
          <line x1={0} y1={offset} x2={ROOM} y2={offset} />
        </g>
      ))}
      <rect x={0} y={0} width={ROOM} height={ROOM} fill="none" stroke="#111111" strokeWidth={6} />

      <g fontFamily="Inter, sans-serif" fontSize={13} fill="#666666" textAnchor="middle">
        <text x={ROOM / 2} y={-11}>Muro norte</text>
        <text x={ROOM / 2} y={ROOM + 22}>Muro sur</text>
        <text transform={`translate(${-11} ${ROOM / 2}) rotate(-90)`}>Muro oeste</text>
        <text transform={`translate(${ROOM + 18} ${ROOM / 2}) rotate(90)`}>Muro este</text>
      </g>

      {items.map((item) => {
        const position = drag?.id === item.id ? drag.position : { x: item.x, y: item.y };
        const isQuarterTurn = item.rotation === 90 || item.rotation === 270;
        const w = (isQuarterTurn ? item.depth : item.width) * PLAN_SCALE;
        const h = (isQuarterTurn ? item.width : item.depth) * PLAN_SCALE;
        const cx = position.x * PLAN_SCALE;
        const cy = position.y * PLAN_SCALE;
        const style = KIND_STYLE[item.kind];
        const isSelected = item.id === selectedId;

        return (
          <g
            key={item.id}
            role="button"
            tabIndex={0}
            aria-pressed={isSelected}
            aria-label={itemAriaLabel(item, position)}
            className="cursor-grab outline-none focus-visible:[&>rect:first-of-type]:stroke-[#2E5490]"
            onPointerDown={(event) => handlePointerDown(event, item)}
            onKeyDown={(event) => handleKeyDown(event, item)}
            onFocus={() => onSelect(item.id)}
          >
            <rect
              x={cx - w / 2}
              y={cy - h / 2}
              width={w}
              height={h}
              rx={4}
              fill={style.fill}
              stroke={isSelected ? "#111111" : style.stroke}
              strokeWidth={isSelected ? 3 : 1.5}
              strokeDasharray={isSelected ? undefined : style.dash}
            />
            <text
              x={cx}
              y={cy + 4}
              textAnchor="middle"
              fontFamily="JetBrains Mono, monospace"
              fontSize={12}
              fontWeight={600}
              fill="#111111"
              pointerEvents="none"
            >
              {item.code}
            </text>
            {item.unitCount !== null && item.unitCount > 0 && (
              <g pointerEvents="none">
                <circle cx={cx + w / 2 - 2} cy={cy - h / 2 + 2} r={11} fill="#111111" />
                <text
                  x={cx + w / 2 - 2}
                  y={cy - h / 2 + 6}
                  textAnchor="middle"
                  fontFamily="Inter, sans-serif"
                  fontSize={11}
                  fontWeight={600}
                  fill="#FFFFFF"
                >
                  {item.unitCount}
                </text>
              </g>
            )}
          </g>
        );
      })}
    </svg>
  );
}

export default WarehousePlan;
