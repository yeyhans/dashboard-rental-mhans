import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

/**
 * H-4: every email the dashboard sends goes through `sendEmailViaWorker`, which fails closed
 * without EMAIL_WORKER_SHARED_SECRET and has a deadline. These routes used to build their own
 * request to the worker and kept sending unauthenticated when the secret was missing.
 */
const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const SENDERS = [
  "../send-budget-notification.ts",
  "../send-manual-email.ts",
  "../send-order-completed-notification.ts",
  "../send-order-failed-notification.ts",
  "../../order/generate-budget-pdf.ts",
  "../../contracts/generate-pdf.ts",
];

describe("email senders use sendEmailViaWorker (H-4)", () => {
  it.each(SENDERS)("%s has no direct request to the worker", (file) => {
    const source = read(file);
    expect(source).not.toContain("/send-email");
    expect(source).not.toContain("createEmailWorkerHeaders");
  });

  it.each(SENDERS.slice(0, 5))(
    "%s sends through sendEmailViaWorker",
    (file) => {
      expect(read(file)).toContain("sendEmailViaWorker(");
    },
  );

  it("keeps the budget PDF alive when the email cannot go out", () => {
    const source = read("../../order/generate-budget-pdf.ts");
    // The customer email failure is logged and the PDF response still returns.
    expect(source).toMatch(/if \(!customerSend\.success\)/);
    expect(source).toContain(
      "...(emailWarning ? { warning: emailWarning } : {})",
    );
  });
});
