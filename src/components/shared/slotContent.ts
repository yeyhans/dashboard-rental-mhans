import type { ReactNode } from "react";

/**
 * D-18: whether an optional slot (`KpiCard.footer`, `PageHeader.actions`) should render its
 * wrapper container. `undefined`/`null`/`false`/`""` all mean "the caller passed nothing
 * meaningful" and must omit the container entirely — a bare `value !== undefined && value !==
 * null` check let `false` and `""` through, rendering an empty wrapper `<div>`/`<span>` into the
 * layout. A numeric `0` is a real value (e.g. "+0 esta semana") and must still render.
 */
export function hasSlotContent(value: ReactNode): boolean {
  return (
    value !== undefined && value !== null && value !== false && value !== ""
  );
}
