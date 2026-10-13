import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * R-09c: `TransactionalEmailService.sendForOrder` renders one of the eight emails for an order and
 * hands it to the email worker. It never throws: a missing recipient or a worker failure becomes a
 * warning, so a status change is never undone by an email.
 */
const sendEmailViaWorker = vi.hoisted(() => vi.fn());
const profileResult = vi.hoisted(() => ({
  value: { data: null as unknown, error: null },
}));

vi.mock("../../lib/emailWorkerService", () => ({ sendEmailViaWorker }));
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: async () => profileResult.value }),
      }),
    }),
  },
}));

const {
  TransactionalEmailService,
  EMAIL_SEND_WARNING,
  CONTRACT_ATTACHMENT_MAX_BYTES,
} = await import("../transactionalEmailService");

const ORDER = {
  id: 1573,
  order_key: null,
  customer_id: 42,
  billing_email: "ana@example.com",
  billing_first_name: "Ana",
  billing_last_name: "Pérez",
  billing_company: null,
  new_pdf_on_hold_url: "https://files.example/presupuesto-1573.pdf",
};

beforeEach(() => {
  sendEmailViaWorker
    .mockReset()
    .mockResolvedValue({ success: true, message: "ok" });
  profileResult.value = { data: null, error: null };
  vi.spyOn(console, "error").mockImplementation(() => {});
  vi.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("TransactionalEmailService.sendForOrder", () => {
  it("sends the rendered email to the order's billing address", async () => {
    const result = await TransactionalEmailService.sendForOrder(
      "equipos-disponibles",
      ORDER,
    );

    expect(result).toEqual({ sent: true });
    expect(sendEmailViaWorker).toHaveBeenCalledTimes(1);
    const [to, subject, html, attachments] = sendEmailViaWorker.mock.calls[0]!;
    expect(to).toBe("ana@example.com");
    expect(subject).toBe("Mario Hans FotoRental · Equipos disponibles");
    expect(html).toContain("Ana Pérez");
    expect(html).toContain("#1573");
    expect(html).toContain('href="https://files.example/presupuesto-1573.pdf"');
    expect(attachments).toBeUndefined();
  });

  it("falls back to the customer profile when the order has no billing email", async () => {
    profileResult.value = {
      data: { email: "perfil@example.com", nombre: "Ana" },
      error: null,
    };

    await TransactionalEmailService.sendForOrder("pedido-completado", {
      ...ORDER,
      billing_email: null,
    });

    expect(sendEmailViaWorker.mock.calls[0]![0]).toBe("perfil@example.com");
  });

  it("sends nothing and warns when there is no recipient at all", async () => {
    const result = await TransactionalEmailService.sendForOrder(
      "pedido-completado",
      {
        ...ORDER,
        billing_email: "",
      },
    );

    expect(sendEmailViaWorker).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, warning: EMAIL_SEND_WARNING });
  });

  it("turns a worker failure into a warning", async () => {
    sendEmailViaWorker.mockResolvedValue({
      success: false,
      message: "x",
      error: "worker_status_500",
    });

    const result = await TransactionalEmailService.sendForOrder(
      "pedido-completado",
      ORDER,
    );

    expect(result).toEqual({ sent: false, warning: EMAIL_SEND_WARNING });
  });

  it("never throws, even if the worker call does", async () => {
    sendEmailViaWorker.mockRejectedValue(new Error("boom"));

    await expect(
      TransactionalEmailService.sendForOrder("pedido-completado", ORDER),
    ).resolves.toEqual({ sent: false, warning: EMAIL_SEND_WARNING });
  });

  it("attaches the rental contract to the delivery email", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array([37, 80, 68, 70]), { status: 200 }),
      ),
    );

    const result = await TransactionalEmailService.sendForOrder(
      "equipos-entregados",
      ORDER,
      {
        contractUrl: "https://files.example/contrato-1573.pdf",
      },
    );

    expect(result).toEqual({ sent: true });
    const attachments = sendEmailViaWorker.mock.calls[0]![3];
    expect(attachments).toEqual([
      {
        filename: "Contrato_arriendo_1573.pdf",
        content: Buffer.from("%PDF").toString("base64"),
      },
    ]);
  });

  it("still sends the delivery email without the contract when it cannot be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 502 })),
    );

    const result = await TransactionalEmailService.sendForOrder(
      "equipos-entregados",
      ORDER,
      {
        contractUrl: "https://files.example/contrato-1573.pdf",
      },
    );

    expect(sendEmailViaWorker).toHaveBeenCalledTimes(1);
    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.sent).toBe(true);
    expect(result.warning).toContain("contrato");
  });

  it("skips an oversized contract", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Uint8Array(CONTRACT_ATTACHMENT_MAX_BYTES + 1), {
            status: 200,
          }),
      ),
    );

    const result = await TransactionalEmailService.sendForOrder(
      "equipos-entregados",
      ORDER,
      {
        contractUrl: "https://files.example/contrato-1573.pdf",
      },
    );

    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.warning).toContain("contrato");
  });
});
