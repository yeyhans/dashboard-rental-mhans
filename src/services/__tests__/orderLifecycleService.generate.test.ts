import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * `OrderLifecycleService.generateRentalContract`: render the processing PDF, upload it to R2 and
 * store `orders.new_pdf_processing_url`. The PDF renderer, site settings and R2 worker are mocked;
 * what is under test is the orchestration, the failure paths and the deadline.
 */
const state = vi.hoisted(() => ({
  orderRow: {
    data: { id: 42, customer_id: 7, status: "in-rental" } as unknown,
    error: null as unknown,
  },
  orderUpdates: [] as unknown[],
  updateError: null as unknown,
}));

const generatePdfBuffer = vi.hoisted(() => vi.fn());

vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: {
    from: (table: string) => {
      if (table === "orders") {
        return {
          select: () => ({
            eq: () => ({ single: async () => state.orderRow }),
          }),
          update: (payload: unknown) => {
            state.orderUpdates.push(payload);
            return { eq: async () => ({ error: state.updateError }) };
          },
        };
      }
      if (table === "user_profiles") {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({ data: { rut: "1-9" }, error: null }),
            }),
          }),
        };
      }
      throw new Error(`unexpected table: ${table}`);
    },
  },
}));

vi.mock("../../lib/pdf/core/pdfService", () => ({ generatePdfBuffer }));
vi.mock("../../lib/pdf/components/processing/ProcessingDocument", () => ({
  ProcessingDocument: () => null,
}));
vi.mock("../../lib/pdf/mappers/processingData", () => ({
  buildProcessingDocumentData: () => ({}),
}));
vi.mock("../siteSettingsService", () => ({
  SiteSettingsService: { get: async () => ({}) },
}));

const { OrderLifecycleService, CONTRACT_GENERATION_TIMEOUT_MS } = await import(
  "../orderLifecycleService"
);

const PDF_BYTES = Buffer.from("%PDF-1.7 test");

describe("OrderLifecycleService.generateRentalContract", () => {
  beforeEach(() => {
    vi.stubEnv("PUBLIC_CLOUDFLARE_WORKER_URL", "https://workers.example");
    state.orderUpdates = [];
    state.updateError = null;
    state.orderRow = {
      data: { id: 42, customer_id: 7, status: "in-rental" },
      error: null,
    };
    generatePdfBuffer.mockResolvedValue(PDF_BYTES);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.unstubAllGlobals();
    vi.useRealTimers();
    generatePdfBuffer.mockReset();
  });

  it("uploads the PDF and stores its URL on the order", async () => {
    const fetchSpy = vi.fn(
      async () =>
        new Response(
          JSON.stringify({ success: true, url: "https://r2/c.pdf" }),
          {
            status: 200,
          },
        ),
    );
    vi.stubGlobal("fetch", fetchSpy);

    const url = await OrderLifecycleService.generateRentalContract(42);

    expect(url).toBe("https://r2/c.pdf");
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://workers.example/upload-pdf-only",
      expect.objectContaining({
        method: "POST",
        signal: expect.any(AbortSignal),
      }),
    );
    expect(state.orderUpdates).toEqual([
      expect.objectContaining({ new_pdf_processing_url: "https://r2/c.pdf" }),
    ]);
  });

  it("throws and stores nothing when the upload fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response("down", { status: 502 })),
    );

    await expect(
      OrderLifecycleService.generateRentalContract(42),
    ).rejects.toThrow("502");
    expect(state.orderUpdates).toEqual([]);
  });

  it("throws when the rendered bytes are not a PDF", async () => {
    generatePdfBuffer.mockResolvedValue(Buffer.from("<html>"));
    vi.stubGlobal("fetch", vi.fn());

    await expect(
      OrderLifecycleService.generateRentalContract(42),
    ).rejects.toThrow("inválido");
    expect(state.orderUpdates).toEqual([]);
  });

  it("throws when the order does not exist", async () => {
    state.orderRow = { data: null, error: null };

    await expect(
      OrderLifecycleService.generateRentalContract(42),
    ).rejects.toThrow();
  });

  it("gives up after the deadline instead of hanging the status request", async () => {
    vi.useFakeTimers();
    generatePdfBuffer.mockReturnValue(new Promise(() => {}));
    vi.stubGlobal("fetch", vi.fn());

    const pending = OrderLifecycleService.generateRentalContract(42);
    const assertion = expect(pending).rejects.toThrow("tiempo");
    await vi.advanceTimersByTimeAsync(CONTRACT_GENERATION_TIMEOUT_MS + 1);
    await assertion;
    expect(state.orderUpdates).toEqual([]);
  });

  it("aborts the upload when it outlives the deadline", async () => {
    vi.useFakeTimers();
    vi.stubGlobal(
      "fetch",
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener("abort", () =>
              reject(new DOMException("aborted", "AbortError")),
            );
          }),
      ),
    );

    const pending = OrderLifecycleService.generateRentalContract(42);
    const assertion = expect(pending).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(CONTRACT_GENERATION_TIMEOUT_MS + 1);
    await assertion;
    expect(state.orderUpdates).toEqual([]);
  });
});
