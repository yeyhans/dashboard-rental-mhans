import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// apiClient pulls lib/supabase, which throws at import time without service-role env vars.
vi.mock("../../../services/apiClient", () => ({
  apiClient: { get: vi.fn() },
}));

import { ReturnReportView } from "../ReturnReportSummary";

/** R-04b: the saved `orders.return_report`, read-only in the admin order detail. */
describe("ReturnReportSummary", () => {
  const report = {
    finalized_at: "2026-10-13T15:30:00Z",
    finalized_by: "op-1",
    lines: [
      {
        key: "0",
        label: "Cámara",
        state: "received",
        incident_type: null,
        note: null,
      },
      {
        key: "1",
        label: "Flash",
        state: "damaged",
        incident_type: "Falla eléctrica",
        note: "no enciende",
      },
    ],
  };

  it("lists every line with its state and the incident detail", () => {
    const html = renderToStaticMarkup(<ReturnReportView report={report} />);
    expect(html).toContain("Informe de devolución");
    expect(html).toContain("Cámara");
    expect(html).toContain("Recibido");
    expect(html).toContain("Flash");
    expect(html).toContain("Dañado");
    expect(html).toContain("Falla eléctrica");
    expect(html).toContain("no enciende");
  });

  it("renders nothing without a report or with a malformed one", () => {
    expect(renderToStaticMarkup(<ReturnReportView report={null} />)).toBe("");
    expect(
      renderToStaticMarkup(<ReturnReportView report={{ lines: "x" }} />),
    ).toBe("");
  });

  it("is mounted in ProcessOrder's order status card", () => {
    const source = readFileSync(
      fileURLToPath(new URL("../../orders/ProcessOrder.tsx", import.meta.url)),
      "utf8",
    );
    expect(source).toContain("ReturnReportSummary");
    expect(source).toContain("<ReturnReportSummary orderId={orderData.id} />");
    const summary = readFileSync(
      fileURLToPath(new URL("../ReturnReportSummary.tsx", import.meta.url)),
      "utf8",
    );
    // Loaded on its own: OrderService.getOrderById names its columns, so it never carries
    // return_report.
    expect(summary).toContain("/api/bodega/orders/${orderId}/report");
  });
});
