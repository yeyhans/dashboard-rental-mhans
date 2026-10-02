import { describe, expect, it } from "vitest";
import { addDaysDDMMAAAA, buildBudgetDocumentData } from "../budgetData";

const baseOrder = {
  id: 420,
  billing: {
    first_name: "Ana",
    last_name: "Pérez",
    email: "ana@mail.cl",
    phone: "+56911112222",
    company: "",
  },
  order_proyecto: "Spot X",
  order_fecha_inicio: "2026-02-01",
  order_fecha_termino: "2026-02-02",
  num_jornadas: 2,
  line_items: [{ name: "Cámara", sku: "C1", price: "10000", quantity: 2 }],
  calculated_subtotal: "40000",
  calculated_discount: "0",
  calculated_iva: "7600",
  calculated_total: "47600",
  reserve_type: "percent",
  reserve_value: 25,
};

const NOW = new Date(2026, 4, 16, 12, 0, 0);

describe("addDaysDDMMAAAA", () => {
  it("adds one day inside a month", () => {
    expect(addDaysDDMMAAAA("2026-02-02", 1)).toBe("03-02-2026");
  });
  it("rolls over the month (including leap February)", () => {
    expect(addDaysDDMMAAAA("2026-01-31", 1)).toBe("01-02-2026");
    expect(addDaysDDMMAAAA("2028-02-28", 1)).toBe("29-02-2028");
    expect(addDaysDDMMAAAA("2026-02-28", 1)).toBe("01-03-2026");
  });
  it("rolls over the year", () => {
    expect(addDaysDDMMAAAA("2026-12-31", 1)).toBe("01-01-2027");
  });
  it("accepts a timestamp and returns empty for garbage", () => {
    expect(addDaysDDMMAAAA("2026-02-02T00:00:00+00:00", 1)).toBe("03-02-2026");
    expect(addDaysDDMMAAAA("", 1)).toBe("");
    expect(addDaysDDMMAAAA("not a date", 1)).toBe("");
  });
});

describe("buildBudgetDocumentData", () => {
  it("maps client, reservation and issue date", () => {
    const data = buildBudgetDocumentData(
      baseOrder,
      { rut: "12.345.678-5" },
      NOW,
    );
    expect(data.orderId).toBe(420);
    expect(data.issueDate).toBe("16-05-2026");
    expect(data.client).toEqual({
      name: "Ana Pérez",
      email: "ana@mail.cl",
      rut: "12.345.678-5",
      company: "",
      phone: "+56911112222",
    });
    expect(data.reservation).toEqual({
      title: "Spot X",
      startDate: "01-02-2026",
      endDate: "02-02-2026",
      retireLabel: "El cliente",
      returnDate: "03-02-2026",
    });
  });

  it('uses order_retire_name when present, "El cliente" otherwise (also for blanks)', () => {
    expect(
      buildBudgetDocumentData(
        { ...baseOrder, order_retire_name: "Juan Soto" },
        null,
        NOW,
      ).reservation.retireLabel,
    ).toBe("Juan Soto");
    expect(
      buildBudgetDocumentData(
        { ...baseOrder, order_retire_name: "   " },
        null,
        NOW,
      ).reservation.retireLabel,
    ).toBe("El cliente");
  });

  it("reads fields from metadata when the order is the nested shape", () => {
    const data = buildBudgetDocumentData(
      {
        order_id: 7,
        billing: baseOrder.billing,
        line_items: baseOrder.line_items,
        metadata: {
          order_proyecto: "Meta",
          order_fecha_inicio: "2026-12-30",
          order_fecha_termino: "2026-12-31",
          order_comments: "Nota meta",
          calculated_subtotal: "40000",
          calculated_iva: "7600",
          calculated_total: "47600",
          num_jornadas: "2",
        },
      },
      null,
      NOW,
    );
    expect(data.orderId).toBe(7);
    expect(data.reservation.title).toBe("Meta");
    expect(data.reservation.returnDate).toBe("01-01-2027");
    expect(data.note).toBe("Nota meta");
    expect(data.totals.total).toBe(47600);
  });

  it("falls back to billing.rut when the profile has none; profile wins otherwise", () => {
    const withBillingRut = {
      ...baseOrder,
      billing: { ...baseOrder.billing, rut: "1-9" },
    };
    expect(buildBudgetDocumentData(withBillingRut, null, NOW).client.rut).toBe(
      "1-9",
    );
    expect(
      buildBudgetDocumentData(withBillingRut, { rut: "2-7" }, NOW).client.rut,
    ).toBe("2-7");
  });

  it("passes the note through trimmed (empty when absent)", () => {
    expect(
      buildBudgetDocumentData(
        { ...baseOrder, order_comments: "  hola  " },
        null,
        NOW,
      ).note,
    ).toBe("hola");
    expect(buildBudgetDocumentData(baseOrder, null, NOW).note).toBe("");
  });

  it("hides the discount (amount 0, plain label) and shipping when there are none", () => {
    const data = buildBudgetDocumentData(baseOrder, null, NOW);
    expect(data.discount).toEqual({ amount: 0, label: "Descuento" });
    expect(data.shipping).toEqual({ label: "Móvil rental", total: 0 });
  });

  it("labels a percent coupon with its percentage", () => {
    const data = buildBudgetDocumentData(
      {
        ...baseOrder,
        calculated_discount: "4000",
        coupon_lines: [
          {
            code: "DESC10",
            discount: "4000",
            discount_type: "percent",
            metadata: { coupon_amount: "10" },
          },
        ],
      },
      null,
      NOW,
    );
    expect(data.discount).toEqual({
      amount: 4000,
      pct: 10,
      label: "Descuento 10%",
    });
  });

  it("keeps a plain label for fixed coupons", () => {
    const data = buildBudgetDocumentData(
      {
        ...baseOrder,
        calculated_discount: "5000",
        coupon_lines: [
          {
            code: "FIJO",
            discount: "5000",
            discount_type: "fixed_cart",
            metadata: { coupon_amount: "5000" },
          },
        ],
      },
      null,
      NOW,
    );
    expect(data.discount).toEqual({ amount: 5000, label: "Descuento" });
  });

  it("maps shipping_lines[0].total to the Móvil rental row", () => {
    const data = buildBudgetDocumentData(
      {
        ...baseOrder,
        shipping_lines: [{ method_title: "Delivery", total: "15000" }],
      },
      null,
      NOW,
    );
    expect(data.shipping.total).toBe(15000);
  });

  it("computes totals with the order reserve (not a hard-coded 25 %) and the balance", () => {
    const percent = buildBudgetDocumentData(
      { ...baseOrder, reserve_value: 30 },
      null,
      NOW,
    );
    expect(percent.totals).toMatchObject({
      productsNet: 40000,
      subtotal: 40000,
      iva: 7600,
      total: 47600,
      reserve: 14280,
      reserveLabel: "Reserva 30%",
      balance: 33320,
    });
    const fixed = buildBudgetDocumentData(
      { ...baseOrder, reserve_type: "fixed", reserve_value: 10000 },
      null,
      NOW,
    );
    expect(fixed.totals.reserve).toBe(10000);
    expect(fixed.totals.reserveLabel).toBe("Reserva");
    expect(fixed.totals.balance).toBe(37600);
  });

  it("productsNet is the net of the lines before discount and shipping", () => {
    const data = buildBudgetDocumentData(
      {
        ...baseOrder,
        calculated_discount: "4000",
        calculated_subtotal: "51000",
        calculated_iva: "9690",
        calculated_total: "60690",
        shipping_lines: [{ total: "15000" }],
      },
      null,
      NOW,
    );
    expect(data.totals.productsNet).toBe(40000);
    expect(data.totals.subtotal).toBe(51000);
  });
});
