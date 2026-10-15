import { readFileSync } from "fs";
import path from "path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ORDER_STATUSES } from "../../../lib/orderStatus";
import { OrderActionsCard } from "../detail/OrderSideCards";
import {
  OrderStatusQuickActions,
  buildStatusQuickActions,
  readStatusChangeResponse,
  shouldOfferNotify,
} from "../OrderStatusQuickActions";

/**
 * Admin status jump (2026-10-14, `odd/tasks/admin-status-jump.md`): quick status actions in the
 * "Acciones" card. No jsdom in this project, so the decisions live in pure helpers tested here and
 * the closed state is rendered with `react-dom/server`.
 */
const noop = async () => ({ ok: true as const });

describe("buildStatusQuickActions", () => {
  it("gives an admin the next step, cancel and the full jump list", () => {
    const actions = buildStatusQuickActions("confirmed", "admin");
    expect(actions.advanceTo).toBe("preparation");
    expect(actions.canCancel).toBe(true);
    expect(actions.canJump).toBe(true);
    expect(actions.jumpTargets).toEqual(
      ORDER_STATUSES.filter((status) => status !== "confirmed"),
    );
  });

  it("lets a super_admin jump out of a terminal status but not advance or cancel", () => {
    const actions = buildStatusQuickActions("completed", "super_admin");
    expect(actions.advanceTo).toBeNull();
    expect(actions.canCancel).toBe(false);
    expect(actions.canJump).toBe(true);
    expect(actions.jumpTargets).not.toContain("completed");
  });

  it("keeps an operator on the forward bodega steps only", () => {
    expect(buildStatusQuickActions("confirmed", "operator")).toEqual({
      advanceTo: "preparation",
      canCancel: false,
      canJump: false,
      jumpTargets: [],
    });
    expect(buildStatusQuickActions("request", "operator").advanceTo).toBeNull();
    expect(buildStatusQuickActions("return", "operator").advanceTo).toBeNull();
  });

  it("lets an admin move a legacy row onto its canonical stage", () => {
    const actions = buildStatusQuickActions("on-hold", "admin");
    expect(actions.advanceTo).toBe("evaluation");
    expect(actions.jumpTargets).toContain("request");
  });
});

describe("shouldOfferNotify", () => {
  it("is false for a sequential change and true for a jump", () => {
    expect(shouldOfferNotify("confirmed", "preparation")).toBe(false);
    expect(shouldOfferNotify("confirmed", "cancelled")).toBe(false);
    expect(shouldOfferNotify("request", "in-rental")).toBe(true);
    expect(shouldOfferNotify("completed", "return")).toBe(true);
  });

  it("is false for a legacy origin, which the server never treats as a jump", () => {
    expect(shouldOfferNotify("on-hold", "request")).toBe(false);
    expect(shouldOfferNotify("on-hold", "in-rental")).toBe(false);
    expect(shouldOfferNotify("processing", "completed")).toBe(false);
  });
});

describe("readStatusChangeResponse", () => {
  it("reads a success", () => {
    expect(readStatusChangeResponse(200, { success: true })).toEqual({ ok: true });
  });

  it("carries the asset tags of an OPEN_CHECKOUTS conflict", () => {
    expect(
      readStatusChangeResponse(409, {
        success: false,
        code: "OPEN_CHECKOUTS",
        error: "Hay unidades sin devolver",
        data: { asset_tags: ["MH-00001"] },
      }),
    ).toEqual({
      ok: false,
      code: "OPEN_CHECKOUTS",
      error: "Hay unidades sin devolver",
      assetTags: ["MH-00001"],
    });
  });

  it("falls back to a Spanish message when the body has none", () => {
    expect(readStatusChangeResponse(500, null)).toEqual({
      ok: false,
      error: "No se pudo actualizar el estado de la orden",
    });
  });
});

describe("OrderStatusQuickActions", () => {
  it("renders the admin actions with Spanish labels", () => {
    const html = renderToStaticMarkup(
      <OrderStatusQuickActions
        currentStatus="confirmed"
        role="admin"
        onChangeStatus={noop}
      />,
    );
    expect(html).toContain("Avanzar a Preparación");
    expect(html).toContain("Cancelar pedido");
    expect(html).toContain("Cambiar estado…");
  });

  it("shows an operator only the forward step", () => {
    const html = renderToStaticMarkup(
      <OrderStatusQuickActions
        currentStatus="preparation"
        role="operator"
        onChangeStatus={noop}
      />,
    );
    expect(html).toContain("Avanzar a");
    expect(html).not.toContain("Cancelar pedido");
    expect(html).not.toContain("Cambiar estado…");
  });

  it("offers no advance on a terminal status", () => {
    const html = renderToStaticMarkup(
      <OrderStatusQuickActions
        currentStatus="cancelled"
        role="admin"
        onChangeStatus={noop}
      />,
    );
    expect(html).not.toContain("Avanzar a");
    expect(html).not.toContain("Cancelar pedido");
    expect(html).toContain("Cambiar estado…");
  });
});

describe("OrderActionsCard status actions slot", () => {
  it("renders the status actions above the email action", () => {
    const html = renderToStaticMarkup(
      <OrderActionsCard
        statusActions={<button type="button">Avanzar a Preparación</button>}
        primary={{ label: "Enviar correo al cliente", onClick: () => {} }}
      />,
    );
    expect(html).toContain("Avanzar a Preparación");
    expect(html.indexOf("Avanzar a Preparación")).toBeLessThan(
      html.indexOf("Enviar correo al cliente"),
    );
  });
});

describe("ProcessOrder wiring", () => {
  const source = readFileSync(
    path.resolve(__dirname, "../ProcessOrder.tsx"),
    "utf8",
  );

  it("mounts the quick actions in the Acciones card with the admin's role", () => {
    expect(source).toContain("<OrderStatusQuickActions");
    expect(source).toContain("role={sessionData?.user?.role ?? null}");
    expect(source).toContain("onChangeStatus={handleStatusChange}");
  });

  it("sends the change through the tested status change flow", () => {
    // The body (notify, acknowledge_open_checkouts) and the follow-up handling are unit-tested
    // in statusChangeFlow.test.ts; here only that ProcessOrder goes through it.
    expect(source).toContain("executeStatusChange(oldStatus, request, {");
    expect(source).toContain("body: JSON.stringify(body)");
    expect(source).toContain("if (execution.followUpError) toast.warning(execution.followUpError);");
  });

  it("keeps the email action", () => {
    expect(source).toContain("onClick: () => setShowEmailModal(true)");
  });
});
