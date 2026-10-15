import { describe, expect, it, vi } from "vitest";
import { LEGACY_ORDER_STATUSES, ORDER_STATUSES } from "../orderStatus";
import { isStatusJump } from "../orderTransitionGate";
import { shouldOfferNotify } from "../../components/orders/OrderStatusQuickActions";

/**
 * R3-notify-classification-mismatch (admin status jump review, 2026-10-14): the "Notificar al
 * cliente" checkbox must show for exactly the changes the server treats as a jump (the ones whose
 * email it holds back unless `notify` is true). One classifier, checked against the lifecycle's.
 */
vi.mock("../supabase", () => ({ supabaseAdmin: { from: vi.fn() } }));
const { OrderLifecycleService } = await import("../../services/orderLifecycleService");

const ORIGINS = [...new Set<string>([...ORDER_STATUSES, ...LEGACY_ORDER_STATUSES])];

describe("isStatusJump", () => {
  it("is false for the next stage and for a cancel from an open stage", () => {
    expect(isStatusJump("confirmed", "preparation")).toBe(false);
    expect(isStatusJump("confirmed", "cancelled")).toBe(false);
  });

  it("is true for a skip, a step back and leaving a terminal status", () => {
    expect(isStatusJump("request", "in-rental")).toBe(true);
    expect(isStatusJump("return", "preparation")).toBe(true);
    expect(isStatusJump("completed", "return")).toBe(true);
    expect(isStatusJump("cancelled", "request")).toBe(true);
  });

  it("never judges a legacy origin a jump", () => {
    expect(isStatusJump("on-hold", "request")).toBe(false);
    expect(isStatusJump("on-hold", "in-rental")).toBe(false);
    expect(isStatusJump("processing", "completed")).toBe(false);
    expect(isStatusJump(null, "completed")).toBe(false);
  });

  it("matches the lifecycle's email rule for every origin and target", () => {
    for (const from of ORIGINS) {
      for (const to of ORDER_STATUSES) {
        expect([from, to, isStatusJump(from, to)]).toEqual([
          from,
          to,
          OrderLifecycleService.isStatusJump(from, to),
        ]);
      }
    }
  });

  it("drives the UI's notify checkbox", () => {
    for (const from of ORIGINS) {
      for (const to of ORDER_STATUSES) {
        expect([from, to, shouldOfferNotify(from, to)]).toEqual([from, to, isStatusJump(from, to)]);
      }
    }
  });
});
