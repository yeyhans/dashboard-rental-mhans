import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { BudgetVersionList } from "../detail/BudgetVersionList";
import { DetailCard } from "../detail/DetailCard";
import { OrderDetailHeader } from "../detail/OrderDetailHeader";
import { OrderItemsTable } from "../detail/OrderItemsTable";
import { OrderPipeline } from "../detail/OrderPipeline";
import {
  OrderActionsCard,
  OrderClientCard,
  OrderDatesCard,
  OrderFinancialCard,
  OrderNoteBlock,
  OrderPaymentCard,
} from "../detail/OrderSideCards";
import { budgetVersions } from "../orderDetail";

/**
 * Canon RC2.1.2 order detail pieces, rendered with `react-dom/server` (no jsdom in this project).
 * Interactive logic lives in `orderDetail.ts` and is covered there.
 */
const noop = () => {};

describe("DetailCard", () => {
  it("renders the canon card head: uppercase title, meta on the right", () => {
    const html = renderToStaticMarkup(
      <DetailCard title="Equipos & Productos" meta="2 equipos">
        <p>body</p>
      </DetailCard>,
    );
    expect(html).toContain("Equipos &amp; Productos");
    expect(html).toContain("uppercase");
    expect(html).toContain("tracking-[0.06em]");
    expect(html).toContain("bg-[var(--color-surface-2)]");
    expect(html).toContain("2 equipos");
    expect(html).toContain("<p>body</p>");
  });
});

describe("OrderDetailHeader", () => {
  const html = renderToStaticMarkup(
    <OrderDetailHeader
      orderId={123}
      project="Campaña Otoño"
      clientLine="Ana Pérez · Estudio Sur"
      createdLabel="Creado el 08-09-2026"
      status="confirmed"
      actions={<button type="button">Editar pedido</button>}
    />,
  );

  it("renders the breadcrumb back to the orders list", () => {
    expect(html).toContain('href="/orders"');
    expect(html).toContain("Volver");
    expect(html).toContain("Pedidos");
    expect(html).toContain("#123 · Campaña Otoño");
  });

  it("renders the mono order number, project, client line and canon badge", () => {
    expect(html).toContain("font-mono");
    expect(html).toContain("text-[20px]");
    expect(html).toContain("Campaña Otoño");
    expect(html).toContain("Ana Pérez · Estudio Sur");
    expect(html).toContain("Creado el 08-09-2026");
    expect(html).toContain("Confirmado");
    expect(html).toContain("text-[10px] font-semibold uppercase");
    expect(html).toContain("Editar pedido");
  });
});

describe("OrderPipeline", () => {
  it("marks the active stage for assistive tech and scrolls horizontally", () => {
    const html = renderToStaticMarkup(<OrderPipeline status="in-rental" />);
    expect(html).toContain("overflow-x-auto");
    expect(html.match(/data-state="done"/g)).toHaveLength(4);
    expect(html).toContain('aria-current="step"');
    expect(html).toContain("En arriendo");
  });

  it("adds the cancelled step", () => {
    const html = renderToStaticMarkup(<OrderPipeline status="cancelled" />);
    expect(html).toContain('data-state="cancelled"');
    expect(html).toContain("Cancelado");
  });
});

describe("OrderItemsTable", () => {
  const html = renderToStaticMarkup(
    <OrderItemsTable
      rows={[
        {
          key: "1",
          sku: "CAM-1",
          name: "Canon R5",
          quantity: 2,
          unitPrice: 10000,
          subtotal: 60000,
          details: <span>Stock: Disponible</span>,
        },
      ]}
      total={60000}
    />,
  );

  it("renders the canon columns without a category column", () => {
    expect(html).toContain("order-items-table");
    for (const label of [
      "SKU",
      "Equipo / Producto",
      "Cant",
      "Precio Unit.",
      "Subtotal",
    ]) {
      expect(html).toContain(label);
    }
    expect(html).not.toContain("Categoría");
  });

  it("labels each cell for the stacked mobile layout and keeps row details", () => {
    expect(html).toContain('data-label="SKU"');
    expect(html).toContain('data-label="Precio Unit."');
    expect(html).toContain("Stock: Disponible");
  });

  it("formats amounts in CLP and closes with the rental subtotal", () => {
    expect(html).toContain("$10.000");
    expect(html).toContain("$60.000");
    expect(html).toContain("Subtotal arriendo (neto)");
  });
});

describe("BudgetVersionList", () => {
  it("lists versions newest first with the current one tagged", () => {
    const html = renderToStaticMarkup(
      <BudgetVersionList
        versions={budgetVersions("a.pdf,b.pdf")}
        onOpen={noop}
        onDelete={noop}
      />,
    );
    expect(html.indexOf("v2")).toBeLessThan(html.indexOf("v1"));
    expect(html).toContain("Actual");
    expect(html).toContain("Ver");
    expect(html).toContain('aria-label="Eliminar presupuesto v2"');
  });
});

describe("aside cards", () => {
  it("OrderActionsCard renders the primary action, secondary row and note", () => {
    const html = renderToStaticMarkup(
      <OrderActionsCard
        primary={{ label: "Enviar correo al cliente", onClick: noop }}
        secondary={<button type="button">Calendario</button>}
        note="El estado se cambia desde Editar pedido."
      />,
    );
    expect(html).toContain("Acciones");
    expect(html).toContain("Enviar correo al cliente");
    expect(html).toContain("Calendario");
    expect(html).toContain("El estado se cambia desde Editar pedido.");
  });

  it("OrderClientCard keeps every client field it is given", () => {
    const html = renderToStaticMarkup(
      <OrderClientCard
        name="Ana Pérez"
        company="Estudio Sur"
        email="ana@example.cl"
        phone="+56 9 1234 5678"
        customerId="42"
        rut="76.123.456-7"
      />,
    );
    for (const text of [
      "Ana Pérez",
      "Estudio Sur",
      "ana@example.cl",
      "+56 9 1234 5678",
      "42",
      "76.123.456-7",
    ]) {
      expect(html).toContain(text);
    }
  });

  it("OrderDatesCard shows both dates with weekday and the jornadas pill", () => {
    const html = renderToStaticMarkup(
      <OrderDatesCard start="2026-06-05" end="2026-06-07" jornadas={3} />,
    );
    expect(html).toContain("Inicio rodaje");
    expect(html).toContain("05/06/2026");
    expect(html).toContain("Viernes");
    expect(html).toContain("Término rodaje");
    expect(html).toContain("3 jornadas");
  });

  it("OrderPaymentCard shows the state, reserve, balance and IVA note", () => {
    const html = renderToStaticMarkup(
      <OrderPaymentCard
        statusLabel="Confirmado"
        summary={{
          reserveLabel: "Pago reserva 25%",
          reserveAmount: 25000,
          tag: "pendiente",
          balance: 75000,
          balanceTone: "crit",
        }}
      />,
    );
    expect(html).toContain("Estado del Pedido");
    expect(html).toContain("Confirmado");
    expect(html).toContain("Pago reserva 25%");
    expect(html).toContain("$25.000");
    expect(html).toContain("Pendiente");
    expect(html).toContain("Saldo pendiente");
    expect(html).toContain("$75.000");
    expect(html).toContain("text-[var(--color-crit)]");
    expect(html).toContain("Valores incluyen IVA (19%)");
  });

  it("OrderFinancialCard renders the canon rows and the total", () => {
    const html = renderToStaticMarkup(
      <OrderFinancialCard
        summary={{
          productsSubtotal: 100000,
          discount: 10000,
          shipping: 0,
          net: 90000,
          iva: 17100,
          total: 107100,
        }}
        couponCodes={["OTONO10"]}
      />,
    );
    expect(html).toContain("Resumen Financiero");
    expect(html).toContain("Subtotal arriendo");
    expect(html).toContain("− $10.000");
    expect(html).toContain("OTONO10");
    expect(html).toContain("Delivery");
    expect(html).toContain("IVA (19%)");
    expect(html).toContain("TOTAL");
    expect(html).toContain("$107.100");
    expect(html).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
  });

  it("OrderNoteBlock renders nothing without text", () => {
    expect(renderToStaticMarkup(<OrderNoteBlock text="  " />)).toBe("");
    expect(
      renderToStaticMarkup(<OrderNoteBlock text="Cliente retira tarde" />),
    ).toContain("Nota interna");
  });
});
