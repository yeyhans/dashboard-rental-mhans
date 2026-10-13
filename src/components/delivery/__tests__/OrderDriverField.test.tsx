import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../../services/apiClient", () => ({
  apiClient: { get: vi.fn(), put: vi.fn() },
}));

import OrderDriverField from "../OrderDriverField";

const source = readFileSync(
  fileURLToPath(new URL("../OrderDriverField.tsx", import.meta.url)),
  "utf8",
);
const processOrder = readFileSync(
  fileURLToPath(new URL("../../orders/ProcessOrder.tsx", import.meta.url)),
  "utf8",
);

/** R-06: assign the driver (conductor) from the order's shipping block. */
describe("OrderDriverField", () => {
  const html = renderToStaticMarkup(<OrderDriverField orderId={9} />);

  it("renders a labelled free-text input with suggestions", () => {
    expect(html).toMatch(
      /<label[^>]*for="order-driver-9"[^>]*>Conductor<\/label>/,
    );
    expect(html).toMatch(
      /<input[^>]*id="order-driver-9"[^>]*list="order-driver-9-options"/,
    );
    expect(html).toContain('maxLength="80"');
    expect(html).toContain('<datalist id="order-driver-9-options"');
  });

  it("reads and saves through the by-order driver endpoint", () => {
    expect(source).toContain("/api/delivery/orders/${orderId}/driver");
    expect(source).toMatch(/apiClient\.put\(/);
    expect(source).toContain("driver_name:");
  });

  it("is mounted in ProcessOrder's shipping block", () => {
    expect(processOrder).toContain("import OrderDriverField from");
    expect(processOrder).toMatch(
      /<OrderDriverField orderId=\{orderData\.id\} \/>/,
    );
  });
});

/** H-2: "no shipment yet" must not stick after the order is saved with a shipping method. */
describe("OrderDriverField — refresh (H-2)", () => {
  it("reloads when the window regains focus and offers a manual re-check", () => {
    expect(source).toContain('window.addEventListener("focus"');
    expect(source).toContain('window.removeEventListener("focus"');
    expect(source).toContain("Volver a comprobar");
  });
});
