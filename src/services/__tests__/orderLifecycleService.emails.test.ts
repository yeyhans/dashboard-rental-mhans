import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-09c: every status change that enters a stage with an email (`EMAIL_ON_ENTER`) sends exactly
 * one transactional email, from one place — `OrderLifecycleService.onStatusChanged` — whichever
 * route changed the status. No key, no email. A failed email is a warning, never an error.
 */
const sendForOrder = vi.hoisted(() => vi.fn());

vi.mock("../transactionalEmailService", () => ({
  TransactionalEmailService: { sendForOrder },
}));
vi.mock("../../lib/supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));

const { OrderLifecycleService, LIFECYCLE_BUDGET_MS } = await import(
  "../orderLifecycleService"
);

const ORDER = {
  id: 7,
  billing_email: "a@x.cl",
  new_pdf_processing_url: "https://f/c.pdf",
};

beforeEach(() => {
  sendForOrder.mockReset().mockResolvedValue({ sent: true });
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("OrderLifecycleService.onStatusChanged — emails", () => {
  it.each([
    ["request", "evaluation", "equipos-disponibles"],
    ["preparation", "in-rental", "equipos-entregados"],
    ["return", "completed", "pedido-completado"],
    ["confirmed", "cancelled", "equipos-no-disponibles"],
    ["processing", "completed", "pedido-completado"],
  ])("%s -> %s sends %s once", async (from, to, key) => {
    await OrderLifecycleService.onStatusChanged(ORDER, to, {
      previousStatus: from,
    });

    expect(sendForOrder).toHaveBeenCalledTimes(1);
    expect(sendForOrder.mock.calls[0]![0]).toBe(key);
  });

  it.each([
    ["evaluation", "confirmed"],
    ["confirmed", "preparation"],
    ["in-rental", "return"],
    ["completed", "completed"],
  ])("%s -> %s sends nothing", async (from, to) => {
    await OrderLifecycleService.onStatusChanged(ORDER, to, {
      previousStatus: from,
    });
    expect(sendForOrder).not.toHaveBeenCalled();
  });

  it("sends nothing when the caller does not say where the order came from", async () => {
    await OrderLifecycleService.onStatusChanged(ORDER, "completed");
    expect(sendForOrder).not.toHaveBeenCalled();
  });

  it("attaches the contract to the delivery email, generating it first when missing", async () => {
    const generate = vi
      .spyOn(OrderLifecycleService, "generateRentalContract")
      .mockResolvedValue("https://f/nuevo.pdf");

    await OrderLifecycleService.onStatusChanged(
      { ...ORDER, new_pdf_processing_url: null },
      "in-rental",
      { previousStatus: "preparation" },
    );

    expect(generate).toHaveBeenCalledWith(7);
    expect(sendForOrder).toHaveBeenCalledWith(
      "equipos-entregados",
      expect.objectContaining({ id: 7 }),
      expect.objectContaining({ contractUrl: "https://f/nuevo.pdf" }),
    );
  });

  it("uses the stored contract when there is one", async () => {
    const generate = vi.spyOn(OrderLifecycleService, "generateRentalContract");

    await OrderLifecycleService.onStatusChanged(ORDER, "in-rental", {
      previousStatus: "preparation",
    });

    expect(generate).not.toHaveBeenCalled();
    expect(sendForOrder.mock.calls[0]![2]).toMatchObject({
      contractUrl: "https://f/c.pdf",
    });
  });

  it("returns the email warning without failing", async () => {
    sendForOrder.mockResolvedValue({
      sent: false,
      warning: "No se pudo enviar el correo.",
    });

    const result = await OrderLifecycleService.onStatusChanged(
      ORDER,
      "completed",
      {
        previousStatus: "return",
      },
    );

    expect(result.warning).toContain("No se pudo enviar el correo.");
  });

  it("combines a contract warning and an email warning", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(OrderLifecycleService, "generateRentalContract").mockRejectedValue(
      new Error("R2"),
    );
    sendForOrder.mockResolvedValue({
      sent: false,
      warning: "Correo no enviado.",
    });

    const result = await OrderLifecycleService.onStatusChanged(
      { ...ORDER, new_pdf_processing_url: null },
      "in-rental",
      { previousStatus: "preparation" },
    );

    expect(result.warning).toContain("contrato");
    expect(result.warning).toContain("Correo no enviado.");
  });
});

/* H-4 (R3/R4): guard and time budget of the in-request email chain. */
describe("OrderLifecycleService.onStatusChanged — guard and budget (H-4)", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends nothing for a null previous status", async () => {
    await OrderLifecycleService.onStatusChanged(ORDER, "completed", {
      previousStatus: null,
    });
    expect(sendForOrder).not.toHaveBeenCalled();
  });

  it("hands the email only the time left of the overall budget", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-13T12:00:00Z"));
    vi.spyOn(
      OrderLifecycleService,
      "generateRentalContract",
    ).mockImplementation(async () => {
      vi.setSystemTime(new Date("2026-10-13T12:00:20Z"));
      return "https://media.mariohans.cl/c.pdf";
    });

    await OrderLifecycleService.onStatusChanged(
      { ...ORDER, new_pdf_processing_url: null },
      "in-rental",
      { previousStatus: "preparation" },
    );

    const options = sendForOrder.mock.calls[0]![2];
    expect(options.contractUrl).toBe("https://media.mariohans.cl/c.pdf");
    expect(options.budgetMs).toBe(LIFECYCLE_BUDGET_MS - 20_000);
  });
});
