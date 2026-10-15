import { describe, expect, it, vi } from "vitest";
import {
  acknowledgeOpenCheckouts,
  buildAdvanceRequest,
  buildCancelRequest,
  buildJumpRequest,
  executeStatusChange,
  statusChangeBody,
  submitStatusChange,
  type StatusChangeOutcome,
  type StatusChangeRequest,
} from "../statusChangeFlow";

/**
 * Admin status jump review findings (2026-10-14, `odd/tasks/admin-status-jump.md`):
 *  - R3-ui-submit-flow-unproved: the quick actions' submit flow, driven without a DOM (no jsdom
 *    in this project) through the same controller the component calls.
 *  - R4-post-commit-failure-reported-as-failure: once the status route answered OK, a failure in
 *    the follow-up (order-chat note) is a warning, never a failed status change.
 */

const ok = async (): Promise<StatusChangeOutcome> => ({ ok: true });

describe("quick action requests", () => {
  it("advances to the next stage with no flags", () => {
    expect(buildAdvanceRequest("preparation")).toEqual({ status: "preparation" });
  });

  it("cancels with the trimmed reason, and without one when blank", () => {
    expect(buildCancelRequest("  el cliente cambió las fechas ")).toEqual({
      status: "cancelled",
      reason: "el cliente cambió las fechas",
    });
    expect(buildCancelRequest("   ")).toEqual({ status: "cancelled" });
  });

  it("sends notify on an admin jump only when it was ticked", () => {
    expect(
      buildJumpRequest({ currentStatus: "request", target: "in-rental", notify: true, reason: "" }),
    ).toEqual({ status: "in-rental", notify: true });
    expect(
      buildJumpRequest({ currentStatus: "request", target: "in-rental", notify: false, reason: "" }),
    ).toEqual({ status: "in-rental" });
  });

  it("never sends notify for a change the server does not judge a jump", () => {
    // Sequential: the checkbox is not offered, a stale tick must not leak into the request.
    expect(
      buildJumpRequest({ currentStatus: "confirmed", target: "preparation", notify: true, reason: "" }),
    ).toEqual({ status: "preparation" });
    // Legacy origin: never a jump on the server.
    expect(
      buildJumpRequest({ currentStatus: "on-hold", target: "in-rental", notify: true, reason: "" }),
    ).toEqual({ status: "in-rental" });
  });

  it("keeps the reason only when the jump target is cancelled", () => {
    expect(
      buildJumpRequest({ currentStatus: "completed", target: "cancelled", notify: false, reason: " x " }),
    ).toEqual({ status: "cancelled", reason: "x" });
    expect(
      buildJumpRequest({ currentStatus: "request", target: "in-rental", notify: false, reason: "x" }),
    ).toEqual({ status: "in-rental" });
  });

  it("re-sends the same request with the open-checkout acknowledgement", () => {
    expect(
      acknowledgeOpenCheckouts({ status: "cancelled", reason: "x", notify: true }),
    ).toEqual({ status: "cancelled", reason: "x", notify: true, acknowledgeOpenCheckouts: true });
  });
});

describe("submitStatusChange", () => {
  it("closes the dialogs on success", async () => {
    const onChangeStatus = vi.fn(ok);
    const request = buildAdvanceRequest("preparation");
    await expect(submitStatusChange(request, onChangeStatus)).resolves.toEqual({ kind: "done" });
    expect(onChangeStatus).toHaveBeenCalledWith({ status: "preparation" });
  });

  it("submits a cancel with its reason", async () => {
    const onChangeStatus = vi.fn(ok);
    await submitStatusChange(buildCancelRequest("sin stock"), onChangeStatus);
    expect(onChangeStatus).toHaveBeenCalledWith({ status: "cancelled", reason: "sin stock" });
  });

  it("submits an admin jump with notify on and off", async () => {
    const onChangeStatus = vi.fn(ok);
    await submitStatusChange(
      buildJumpRequest({ currentStatus: "request", target: "return", notify: true, reason: "" }),
      onChangeStatus,
    );
    await submitStatusChange(
      buildJumpRequest({ currentStatus: "request", target: "return", notify: false, reason: "" }),
      onChangeStatus,
    );
    expect(onChangeStatus.mock.calls.map(([request]) => request)).toEqual([
      { status: "return", notify: true },
      { status: "return" },
    ]);
  });

  it("asks to confirm on OPEN_CHECKOUTS and re-sends with the acknowledgement", async () => {
    const onChangeStatus = vi
      .fn<(request: StatusChangeRequest) => Promise<StatusChangeOutcome>>()
      .mockResolvedValueOnce({
        ok: false,
        code: "OPEN_CHECKOUTS",
        error: "Hay unidades sin devolver",
        assetTags: ["MH-00001", "MH-00002"],
      })
      .mockResolvedValueOnce({ ok: true });
    const request = buildCancelRequest("devuelto a mano");

    const first = await submitStatusChange(request, onChangeStatus);
    expect(first).toEqual({
      kind: "confirm-open-checkouts",
      request,
      assetTags: ["MH-00001", "MH-00002"],
    });

    // "Confirmar de todos modos"
    if (first.kind !== "confirm-open-checkouts") throw new Error("unreachable");
    const second = await submitStatusChange(
      acknowledgeOpenCheckouts(first.request),
      onChangeStatus,
    );
    expect(second).toEqual({ kind: "done" });
    expect(onChangeStatus).toHaveBeenLastCalledWith({
      status: "cancelled",
      reason: "devuelto a mano",
      acknowledgeOpenCheckouts: true,
    });
  });

  it("shows an error when an acknowledged request still conflicts", async () => {
    const onChangeStatus = vi.fn(async () => ({
      ok: false as const,
      code: "OPEN_CHECKOUTS",
      error: "Hay unidades sin devolver",
      assetTags: [],
    }));
    await expect(
      submitStatusChange(acknowledgeOpenCheckouts({ status: "cancelled" }), onChangeStatus),
    ).resolves.toEqual({ kind: "error", error: "Hay unidades sin devolver" });
  });

  it("shows the route's error otherwise", async () => {
    const onChangeStatus = vi.fn(async () => ({
      ok: false as const,
      code: "INVALID_TRANSITION",
      error: "Transición de estado no permitida.",
    }));
    await expect(
      submitStatusChange(buildAdvanceRequest("evaluation"), onChangeStatus),
    ).resolves.toEqual({ kind: "error", error: "Transición de estado no permitida." });
  });
});

describe("statusChangeBody", () => {
  it("maps the request onto the route's body", () => {
    expect(
      statusChangeBody({ status: "cancelled", reason: "x", notify: true, acknowledgeOpenCheckouts: true }),
    ).toEqual({
      status: "cancelled",
      reason: "x",
      notify: true,
      acknowledge_open_checkouts: true,
    });
    expect(statusChangeBody({ status: "preparation" })).toEqual({
      status: "preparation",
      notify: false,
      acknowledge_open_checkouts: false,
    });
  });
});

describe("executeStatusChange", () => {
  const committed = async () => ({ httpStatus: 200, body: { success: true } });

  it("sends the body and posts the chat note on a sequential change", async () => {
    const send = vi.fn(committed);
    const postChatNote = vi.fn(async () => {});
    const result = await executeStatusChange("confirmed", { status: "preparation" }, { send, postChatNote });
    expect(result).toEqual({ outcome: { ok: true } });
    expect(send).toHaveBeenCalledWith({
      status: "preparation",
      notify: false,
      acknowledge_open_checkouts: false,
    });
    expect(postChatNote).toHaveBeenCalledTimes(1);
  });

  it("skips the chat note on a jump without notify and posts it with notify", async () => {
    const postChatNote = vi.fn(async () => {});
    await executeStatusChange("request", { status: "in-rental" }, { send: committed, postChatNote });
    expect(postChatNote).not.toHaveBeenCalled();
    await executeStatusChange(
      "request",
      { status: "in-rental", notify: true },
      { send: committed, postChatNote },
    );
    expect(postChatNote).toHaveBeenCalledTimes(1);
  });

  it("posts the chat note for a legacy origin, which is never a jump", async () => {
    const postChatNote = vi.fn(async () => {});
    await executeStatusChange("on-hold", { status: "in-rental" }, { send: committed, postChatNote });
    expect(postChatNote).toHaveBeenCalledTimes(1);
  });

  it("reports the change as done when only the chat note fails", async () => {
    const onUnexpectedError = vi.fn();
    const result = await executeStatusChange(
      "confirmed",
      { status: "preparation" },
      {
        send: committed,
        postChatNote: async () => {
          throw new Error("chat caído");
        },
        onUnexpectedError,
      },
    );
    expect(result.outcome).toEqual({ ok: true });
    expect(result.followUpError).toMatch(/El estado se cambió/);
    expect(result.followUpError).toContain("chat caído");
    expect(onUnexpectedError).toHaveBeenCalledWith("follow-up", expect.any(Error));
  });

  it("carries the route's warning on success", async () => {
    const result = await executeStatusChange(
      "request",
      { status: "evaluation" },
      {
        send: async () => ({ httpStatus: 200, body: { success: true, warning: "Sin correo" } }),
        postChatNote: async () => {},
      },
    );
    expect(result).toEqual({ outcome: { ok: true }, warning: "Sin correo" });
  });

  it("returns the rejection and skips the follow-up when the route refuses", async () => {
    const postChatNote = vi.fn(async () => {});
    const result = await executeStatusChange(
      "in-rental",
      { status: "cancelled" },
      {
        send: async () => ({
          httpStatus: 409,
          body: { success: false, code: "OPEN_CHECKOUTS", error: "x", data: { asset_tags: ["MH-1"] } },
        }),
        postChatNote,
      },
    );
    expect(result.outcome).toEqual({ ok: false, code: "OPEN_CHECKOUTS", error: "x", assetTags: ["MH-1"] });
    expect(postChatNote).not.toHaveBeenCalled();
  });

  it("reports a failed change when the request itself throws", async () => {
    const onUnexpectedError = vi.fn();
    const result = await executeStatusChange(
      "request",
      { status: "evaluation" },
      {
        send: async () => {
          throw new Error("Failed to fetch");
        },
        postChatNote: async () => {},
        onUnexpectedError,
      },
    );
    expect(result.outcome).toEqual({ ok: false, error: "Failed to fetch" });
    expect(onUnexpectedError).toHaveBeenCalledWith("request", expect.any(Error));
  });
});
