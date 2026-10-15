import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import {
  CANON_TONE_CLASSES,
  PRODUCT_INVENTORY_STATUS,
  productInventoryStatus,
  unitStatusLabel,
  unitStatusTone,
} from "../canon/unitStatus";
import { summarizeInventoryKpis } from "../canon/inventoryKpis";
import { UnitStatusPill } from "../canon/UnitStatusPill";
import { InventoryKpiRow } from "../canon/InventoryKpiRow";
import type { ProductUnitCounts } from "../../../types/inventory";

function counts(partial: Partial<ProductUnitCounts> = {}): ProductUnitCounts {
  return {
    product_id: 1,
    total: 0,
    available: 0,
    in_rental: 0,
    maintenance: 0,
    damaged: 0,
    blocked: 0,
    retired: 0,
    ...partial,
  };
}

describe("unit status (canon RC2.1.3 pill)", () => {
  it("maps every display status to the canon tone", () => {
    expect(unitStatusTone("operational")).toBe("ok");
    expect(unitStatusTone("in_rental")).toBe("info");
    expect(unitStatusTone("maintenance")).toBe("warn");
    expect(unitStatusTone("cleaning")).toBe("warn");
    expect(unitStatusTone("damaged")).toBe("crit");
    expect(unitStatusTone("blocked")).toBe("crit");
    expect(unitStatusTone("retired")).toBe("neutral");
  });

  it("labels the derived rental state and the stored conditions in Spanish", () => {
    expect(unitStatusLabel("in_rental")).toBe("En arriendo");
    expect(unitStatusLabel("operational")).toBe("Disponible");
    expect(unitStatusLabel("blocked")).toBe("Bloqueado");
  });

  it("uses the canon status colors as Tailwind arbitrary values", () => {
    expect(CANON_TONE_CLASSES.ok).toContain("bg-[#E7F2EC]");
    expect(CANON_TONE_CLASSES.ok).toContain("text-[#256B44]");
    expect(CANON_TONE_CLASSES.info).toContain("text-[#2E5490]");
    expect(CANON_TONE_CLASSES.warn).toContain("text-[#8A6A1E]");
    expect(CANON_TONE_CLASSES.crit).toContain("text-[#A3271F]");
  });

  it("renders a pill with a 5px dot and the label", () => {
    const html = renderToStaticMarkup(<UnitStatusPill status="in_rental" />);
    expect(html).toContain("En arriendo");
    expect(html).toContain("h-[5px]");
    expect(html).toContain("w-[5px]");
    expect(html).toContain("rounded-full");
    expect(html).toContain("bg-[#EAF0FA]");
  });

  it("renders a pill from an explicit tone and label", () => {
    const html = renderToStaticMarkup(<UnitStatusPill tone="neutral" label="Sin unidades" />);
    expect(html).toContain("Sin unidades");
    expect(html).toContain(CANON_TONE_CLASSES.neutral.split(" ")[0]);
  });
});

describe("productInventoryStatus (canon computeCounts overall)", () => {
  it("is 'no_units' when the product has no units", () => {
    expect(productInventoryStatus(counts())).toBe("no_units");
  });

  it("is blocked when any unit is damaged or blocked", () => {
    expect(productInventoryStatus(counts({ total: 3, available: 2, damaged: 1 }))).toBe("blocked");
    expect(productInventoryStatus(counts({ total: 3, available: 1, maintenance: 1, blocked: 1 }))).toBe("blocked");
  });

  it("is maintenance when units are in maintenance and none blocked", () => {
    expect(productInventoryStatus(counts({ total: 2, available: 1, maintenance: 1 }))).toBe("maintenance");
  });

  it("is in_rental only when nothing is available and something is out", () => {
    expect(productInventoryStatus(counts({ total: 2, in_rental: 2 }))).toBe("in_rental");
    expect(productInventoryStatus(counts({ total: 2, available: 1, in_rental: 1 }))).toBe("available");
  });

  it("has a Spanish label and tone for every status", () => {
    expect(PRODUCT_INVENTORY_STATUS.available).toEqual({ label: "Disponible", tone: "ok" });
    expect(PRODUCT_INVENTORY_STATUS.in_rental).toEqual({ label: "En arriendo", tone: "info" });
    expect(PRODUCT_INVENTORY_STATUS.maintenance).toEqual({ label: "Mantención", tone: "warn" });
    expect(PRODUCT_INVENTORY_STATUS.blocked).toEqual({ label: "Bloqueado", tone: "crit" });
    expect(PRODUCT_INVENTORY_STATUS.no_units).toEqual({ label: "Sin unidades", tone: "neutral" });
  });
});

describe("summarizeInventoryKpis", () => {
  it("adds up the per-product buckets", () => {
    const kpis = summarizeInventoryKpis(
      [
        counts({ product_id: 1, total: 4, available: 2, in_rental: 1, maintenance: 1 }),
        counts({ product_id: 2, total: 4, available: 1, in_rental: 1, damaged: 1, blocked: 1, retired: 3 }),
      ],
      12,
    );
    expect(kpis).toEqual({
      publishedModels: 12,
      unitsInInventory: 8,
      availableToday: 3,
      availablePct: 38,
      inRental: 2,
      attention: 3,
    });
  });

  it("reports 0 % instead of dividing by zero", () => {
    expect(summarizeInventoryKpis([], 5).availablePct).toBe(0);
  });
});

describe("InventoryKpiRow", () => {
  it("renders the four canon cards with their subtitles", () => {
    const html = renderToStaticMarkup(
      <InventoryKpiRow
        kpis={{
          publishedModels: 12,
          unitsInInventory: 8,
          availableToday: 3,
          availablePct: 38,
          inRental: 2,
          attention: 3,
        }}
      />,
    );
    expect(html).toContain("Modelos Publicados");
    expect(html).toContain("8 unidades en inventario");
    expect(html).toContain("Disponibles Hoy");
    expect(html).toContain("38% del total");
    expect(html).toContain("En Arriendo");
    expect(html).toContain("unidades en uso");
    expect(html).toContain("Mantención / Bloqueadas");
    expect(html).toContain("requieren atención");
    expect(html).toContain("text-[#256B44]");
  });

  it("uses the singular for one unit", () => {
    const html = renderToStaticMarkup(
      <InventoryKpiRow
        kpis={{ publishedModels: 1, unitsInInventory: 1, availableToday: 1, availablePct: 100, inRental: 0, attention: 0 }}
      />,
    );
    expect(html).toContain("1 unidad en inventario");
  });
});
