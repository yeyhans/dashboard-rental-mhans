import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { formatBusinessDate, formatBusinessDateTimeFull } from "../businessDay";

/**
 * D-5 (A-04). React hydration errors #418 / #423 / #425 on the order screen: `ProcessOrder`,
 * `OrderEstado` and `AdminCommunications` printed `orders.date_created` / `date_modified`
 * (timestamptz instants) with the LOCAL getters of `Date`. Astro renders the island on Vercel (UTC)
 * and the browser re-renders it in America/Santiago, so the server HTML said "14:58:03" and the
 * client "10:58:03": text content mismatch (#418/#425), then React discards the server tree and
 * client-renders the root (#423) and the first click lands on a node that is being replaced.
 *
 * The fix is one deterministic formatter bound to the business zone, shared by server and client.
 */
describe("formatBusinessDateTimeFull", () => {
  it("prints dd-mm-yyyy HH:mm:ss in Santiago, identical wherever the process runs", () => {
    // 14:58:03Z in September is 11:58:03 in Santiago (UTC-3).
    expect(formatBusinessDateTimeFull("2026-09-08T14:58:03Z")).toBe(
      "08-09-2026 11:58:03",
    );
    // June is UTC-4.
    expect(formatBusinessDateTimeFull("2026-06-10T14:58:03Z")).toBe(
      "10-06-2026 10:58:03",
    );
  });

  it("rolls the calendar day back when Santiago has not reached midnight yet", () => {
    // Server (UTC) says the 10th, Santiago still the 9th.
    expect(formatBusinessDateTimeFull("2026-06-10T03:30:07Z")).toBe(
      "09-06-2026 23:30:07",
    );
    expect(formatBusinessDate("2026-06-10T03:30:07Z")).toBe("09-06-2026");
  });

  it("prints midnight as 00:00:00, never 24", () => {
    expect(formatBusinessDateTimeFull("2026-09-09T03:00:00Z")).toBe(
      "09-09-2026 00:00:00",
    );
  });

  it("returns an em dash for an unparseable instant", () => {
    expect(formatBusinessDateTimeFull("")).toBe("—");
    expect(formatBusinessDateTimeFull("nope")).toBe("—");
  });
});

describe("server-rendered order components stay timezone-independent", () => {
  const root = resolve(__dirname, "../../components/orders");
  const files = [
    "ProcessOrder.tsx",
    "OrderEstado.tsx",
    "AdminCommunications.tsx",
  ];

  it.each(files)(
    "%s formats timestamps with the business-zone helpers, not local Date getters",
    (file) => {
      const source = readFileSync(resolve(root, file), "utf8");
      expect(source).not.toMatch(
        /\.getHours\(\)|\.getMinutes\(\)|\.getSeconds\(\)/,
      );
      expect(source).not.toMatch(
        /new Date\(orderData\.date_(created|modified)\)/,
      );
    },
  );
});
