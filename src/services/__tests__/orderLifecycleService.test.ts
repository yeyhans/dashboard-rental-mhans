import { afterEach, describe, expect, it, vi } from "vitest";

/**
 * R-14: when an order enters `in-rental` the per-order contract (processing PDF, stored in
 * `orders.new_pdf_processing_url`) is generated. The status change itself must never fail
 * because of it: a failed generation becomes a warning.
 */
vi.mock("../../lib/supabase", () => ({
  supabaseAdmin: { from: vi.fn() },
}));

const { OrderLifecycleService, CONTRACT_GENERATION_WARNING } = await import(
  "../orderLifecycleService"
);

describe("OrderLifecycleService.onStatusChanged", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("generates the contract when the order enters in-rental without one", async () => {
    const generate = vi
      .spyOn(OrderLifecycleService, "generateRentalContract")
      .mockResolvedValue("https://files.example/contrato.pdf");

    const result = await OrderLifecycleService.onStatusChanged(
      { id: 42, new_pdf_processing_url: null },
      "in-rental",
    );

    expect(generate).toHaveBeenCalledWith(42);
    expect(result).toEqual({ generated: true });
  });

  it("does nothing for any other status", async () => {
    const generate = vi.spyOn(OrderLifecycleService, "generateRentalContract");

    const result = await OrderLifecycleService.onStatusChanged(
      { id: 42, new_pdf_processing_url: null },
      "preparation",
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ generated: false });
  });

  it("does not regenerate when the order already has a contract URL", async () => {
    const generate = vi.spyOn(OrderLifecycleService, "generateRentalContract");

    const result = await OrderLifecycleService.onStatusChanged(
      { id: 42, new_pdf_processing_url: "https://files.example/existente.pdf" },
      "in-rental",
    );

    expect(generate).not.toHaveBeenCalled();
    expect(result).toEqual({ generated: false });
  });

  it("turns a generator failure into a warning instead of an error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(OrderLifecycleService, "generateRentalContract").mockRejectedValue(
      new Error("R2 down"),
    );

    const result = await OrderLifecycleService.onStatusChanged(
      { id: 42, new_pdf_processing_url: null },
      "in-rental",
    );

    expect(result).toEqual({
      generated: false,
      warning: CONTRACT_GENERATION_WARNING,
    });
    expect(errorSpy).toHaveBeenCalledWith(
      expect.stringContaining("[OrderLifecycleService]"),
      expect.objectContaining({ orderId: 42 }),
    );
  });
});
