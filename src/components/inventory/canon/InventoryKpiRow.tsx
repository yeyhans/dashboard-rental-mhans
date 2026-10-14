import { CheckCircle2, Package, Truck, Wrench } from "lucide-react";
import { InventoryKpi } from "./InventoryKpi";
import type { InventoryKpis } from "./inventoryKpis";

const unitWord = (n: number) => (n === 1 ? "unidad" : "unidades");

/** Canon `.kpi-grid` of "Catálogo de Equipos": 4 columns on desktop, 2 on mobile. */
export function InventoryKpiRow({ kpis }: { kpis: InventoryKpis }) {
  return (
    <section aria-label="Resumen de inventario" className="mb-[22px] grid grid-cols-2 gap-3 lg:grid-cols-4">
      <InventoryKpi
        icon={Package}
        tone="info"
        label="Modelos Publicados"
        value={kpis.publishedModels}
        sub={`${kpis.unitsInInventory} ${unitWord(kpis.unitsInInventory)} en inventario`}
      />
      <InventoryKpi
        icon={CheckCircle2}
        tone="ok"
        label="Disponibles Hoy"
        value={kpis.availableToday}
        sub={`${kpis.availablePct}% del total`}
        isValueTinted
        isSubTinted
      />
      <InventoryKpi icon={Truck} tone="info" label="En Arriendo" value={kpis.inRental} sub="unidades en uso" isValueTinted />
      <InventoryKpi
        icon={Wrench}
        tone="warn"
        label="Mantención / Bloqueadas"
        value={kpis.attention}
        sub="requieren atención"
        isValueTinted
      />
    </section>
  );
}

export default InventoryKpiRow;
