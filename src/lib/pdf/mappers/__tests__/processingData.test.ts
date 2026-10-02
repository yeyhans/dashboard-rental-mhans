import { describe, expect, it } from "vitest";
import { buildProcessingDocumentData } from "../processingData";

const baseOrder = {
  id: 77,
  billing: {
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@mail.cl",
    phone: "+56911112222",
    company: "",
  },
  order_proyecto: "Spot X",
  order_fecha_inicio: "2026-03-01",
  order_fecha_termino: "2026-03-03",
  num_jornadas: 3,
  line_items: [{ name: "Cámara", sku: "C1", price: "10000", quantity: 2 }],
  calculated_subtotal: "60000",
  calculated_discount: "0",
  calculated_iva: "11400",
  calculated_total: "71400",
  reserve_type: "percent",
  reserve_value: 25,
};
const NOW = new Date(2026, 4, 16, 12, 0, 0);

describe("buildProcessingDocumentData", () => {
  it("sets the delivery date to the day before the start (month rollover)", () => {
    const data = buildProcessingDocumentData(baseOrder, null, NOW);
    expect(data.annex.deliveryDate).toBe("28-02-2026");
  });

  it("rolls the delivery date back over the year", () => {
    const data = buildProcessingDocumentData(
      { ...baseOrder, order_fecha_inicio: "2027-01-01" },
      null,
      NOW,
    );
    expect(data.annex.deliveryDate).toBe("31-12-2026");
  });

  it("exposes the annex facts", () => {
    const { annex } = buildProcessingDocumentData(baseOrder, null, NOW);
    expect(annex.startDate).toBe("01-03-2026");
    expect(annex.endDate).toBe("03-03-2026");
    expect(annex.totalNet).toBe(60000);
    expect(annex.reservePct).toBe(25);
    expect(annex.pickupAddress).toBe("Purísima 25 o Bellavista 77, Recoleta");
  });

  it("reuses the budget data, with the reserve (not the total) as reserve", () => {
    const data = buildProcessingDocumentData(baseOrder, null, NOW);
    expect(data.orderId).toBe(77);
    expect(data.totals.reserve).toBe(17850);
    expect(data.totals.reserve).not.toBe(data.totals.total);
  });

  it("has no reservePct for a fixed reserve", () => {
    const { annex, totals } = buildProcessingDocumentData(
      { ...baseOrder, reserve_type: "fixed", reserve_value: 20000 },
      null,
      NOW,
    );
    expect(annex.reservePct).toBeUndefined();
    expect(totals.reserve).toBe(20000);
  });

  it("builds the signer for a natural client", () => {
    const { signer } = buildProcessingDocumentData(
      baseOrder,
      { rut: "12.345.678-5", tipo_cliente: "natural" },
      NOW,
    );
    expect(signer).toEqual({ name: "Ana Pérez", rut: "12.345.678-5" });
  });

  it("builds the signer for an empresa client", () => {
    const { signer } = buildProcessingDocumentData(
      baseOrder,
      {
        rut: "12.345.678-5",
        tipo_cliente: "empresa",
        empresa_nombre: "Productora Sur SpA",
        empresa_rut: "76.111.222-3",
      },
      NOW,
    );
    expect(signer).toEqual({
      name: "Ana Pérez",
      rut: "12.345.678-5",
      company: "Productora Sur SpA",
      companyRut: "76.111.222-3",
    });
  });
});
