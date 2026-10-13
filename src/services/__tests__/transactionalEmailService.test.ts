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
        contractUrl: "https://media.mariohans.cl/contracts/contrato-1573.pdf",
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
        contractUrl: "https://media.mariohans.cl/contracts/contrato-1573.pdf",
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
        contractUrl: "https://media.mariohans.cl/contracts/contrato-1573.pdf",
      },
    );

    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.warning).toContain("contrato");
  });
});

/* R-09d: account emails (Contrato) are not tied to an order. */
describe("TransactionalEmailService.sendToCustomer", () => {
  it("sends the contract email with the signed contract attached", async () => {
    const result = await TransactionalEmailService.sendToCustomer(
      "contrato",
      { email: "ana@example.com", name: "Ana Pérez" },
      {
        attachment: { filename: "Contrato_arriendo.pdf", content: "JVBERg==" },
      },
    );

    expect(result).toEqual({ sent: true });
    const [to, subject, html, attachments] = sendEmailViaWorker.mock.calls[0]!;
    expect(to).toBe("ana@example.com");
    expect(subject).toBe("Mario Hans FotoRental · Contrato de arriendo");
    expect(html).toContain("Ana Pérez");
    expect(attachments).toEqual([
      { filename: "Contrato_arriendo.pdf", content: "JVBERg==" },
    ]);
  });

  it("warns and sends nothing without an address", async () => {
    const result = await TransactionalEmailService.sendToCustomer("contrato", {
      email: " ",
      name: "Ana",
    });
    expect(sendEmailViaWorker).not.toHaveBeenCalled();
    expect(result).toEqual({ sent: false, warning: EMAIL_SEND_WARNING });
  });
});

describe("contract route wiring (R-09d)", () => {
  it("sends the Contrato design through the service instead of its own worker call", async () => {
    const { readFileSync } = await import("node:fs");
    const { fileURLToPath } = await import("node:url");
    const source = readFileSync(
      fileURLToPath(
        new URL("../../pages/api/contracts/generate-pdf.ts", import.meta.url),
      ),
      "utf8",
    );
    expect(source).toContain("TransactionalEmailService.sendToCustomer(");
    expect(source).toContain('"contrato"');
    expect(source).not.toContain("/send-email");
  });
});

/* H-4 (R1-001): the contract attachment is fetched only from the hosts the app writes PDFs to,
   never follows a redirect, and is read with a hard byte cap. */
describe("TransactionalEmailService — bounded contract fetch (H-4)", () => {
  const send = (contractUrl: string) =>
    TransactionalEmailService.sendForOrder("equipos-entregados", ORDER, {
      contractUrl,
    });

  it.each([
    "https://evil.example/contrato.pdf",
    "http://media.mariohans.cl/contrato.pdf",
    "https://169.254.169.254/latest/meta-data",
    "file:///etc/passwd",
  ])(
    "does not fetch %s and still sends without the attachment",
    async (url) => {
      const fetchSpy = vi.fn();
      vi.stubGlobal("fetch", fetchSpy);

      const result = await send(url);

      expect(fetchSpy).not.toHaveBeenCalled();
      expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
      expect(result.warning).toContain("contrato");
    },
  );

  it("refuses redirects", async () => {
    const fetchSpy = vi.fn(async () => new Response("%PDF", { status: 200 }));
    vi.stubGlobal("fetch", fetchSpy);

    await send("https://media.mariohans.cl/contracts/c.pdf");

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://media.mariohans.cl/contracts/c.pdf",
      expect.objectContaining({ redirect: "error" }),
    );
  });

  it("rejects an oversized PDF from its content-length without reading the body", async () => {
    const arrayBuffer = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        status: 200,
        headers: new Headers({
          "content-length": String(CONTRACT_ATTACHMENT_MAX_BYTES + 1),
        }),
        body: null,
        arrayBuffer,
      })),
    );

    const result = await send("https://media.mariohans.cl/contracts/c.pdf");

    expect(arrayBuffer).not.toHaveBeenCalled();
    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.warning).toContain("contrato");
  });

  it("stops reading a stream that passes the cap without a content-length", async () => {
    let pulled = 0;
    const chunk = new Uint8Array(1024 * 1024);
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        pulled += 1;
        controller.enqueue(chunk);
        if (pulled > 20) controller.close();
      },
    });
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(stream, { status: 200 })),
    );

    const result = await send("https://media.mariohans.cl/contracts/c.pdf");

    expect(pulled).toBeLessThanOrEqual(7);
    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.warning).toContain("contrato");
  });

  it("drops an oversized attachment handed in by the caller (contract route)", async () => {
    const big = Buffer.alloc(CONTRACT_ATTACHMENT_MAX_BYTES + 1).toString(
      "base64",
    );

    const result = await TransactionalEmailService.sendToCustomer(
      "contrato",
      { email: "ana@example.com", name: "Ana" },
      { attachment: { filename: "Contrato_arriendo.pdf", content: big } },
    );

    expect(sendEmailViaWorker.mock.calls[0]![3]).toBeUndefined();
    expect(result.sent).toBe(true);
    expect(result.warning).toContain("contrato");
  });
});

describe("TransactionalEmailService — warning wording (H-4)", () => {
  it("does not claim a status change for an account email", () => {
    expect(EMAIL_SEND_WARNING).not.toContain("estado");
  });
});
