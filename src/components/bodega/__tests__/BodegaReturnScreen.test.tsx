import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

// apiClient pulls lib/supabase, which throws at import time without service-role env vars.
vi.mock("../../../services/apiClient", () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    handleJsonResponse: vi.fn(),
  },
}));

import BodegaReturnScreen, { isReturnScreenOrder } from "../BodegaReturnScreen";
import type { ScanSheet } from "../../../services/bodegaService";

const read = (relative: string) =>
  readFileSync(fileURLToPath(new URL(relative, import.meta.url)), "utf8");

const SHEET: ScanSheet = {
  order: {
    id: 7,
    status: "return",
    reference: "PED-7",
    client: "Ana Pérez",
    project: "Rodaje",
    startDate: "2026-10-08",
    endDate: "2026-10-12",
  },
  lines: [
    { productId: 10, name: "Cámara X", quantity: 2, open: 0, returned: 2 },
    { productId: 11, name: "Trípode", quantity: 1, open: 1, returned: 0 },
  ],
  lineItems: [
    { name: "Cámara X", sku: "CAM-1", product_id: 10, quantity: 2 },
    { name: "Trípode", sku: "TRI-1", product_id: 11, quantity: 1 },
  ] as any,
};

/**
 * R-04b: /bodega and /check-in share one reception flow. The operator's order screen keeps the
 * gun scanner as the primary input and mounts the same `CheckInReceptionPanel` below it.
 */
describe("BodegaReturnScreen", () => {
  const html = renderToStaticMarkup(
    <BodegaReturnScreen sheet={SHEET} todayIsoDay="2026-10-13" />,
  );

  it("keeps the scanner and mounts the shared reception panel", () => {
    expect(html).toContain('aria-label="Dirección del movimiento"');
    expect(html).toContain('aria-label="Estado de recepción — Cámara X"');
    expect(html).toContain("Marcar todos como recibidos");
    expect(html).toContain("Finalizar devolución");
  });

  it("seeds the panel with units already back: a fully returned line starts Recibido", () => {
    const camara = html.slice(
      html.indexOf('aria-label="Estado de recepción — Cámara X"'),
      html.indexOf('aria-label="Estado de recepción — Trípode"'),
    );
    expect(camara).toMatch(/aria-pressed="true"[^>]*>Recibido<\/button>/);
  });

  it("uses the shared component, not a copy", () => {
    const source = read("../BodegaReturnScreen.tsx");
    expect(source).toContain('from "../checkin/CheckInReceptionPanel"');
    expect(source).toContain('variant="mobile"');
  });
});

describe("isReturnScreenOrder", () => {
  it("is true for a return, and for an in-rental order whose rental ended", () => {
    expect(isReturnScreenOrder("return", "2026-10-20", "2026-10-13")).toBe(
      true,
    );
    expect(isReturnScreenOrder("in-rental", "2026-10-13", "2026-10-13")).toBe(
      true,
    );
  });

  it("is false before the rental ends and for pickups", () => {
    expect(isReturnScreenOrder("in-rental", "2026-10-20", "2026-10-13")).toBe(
      false,
    );
    expect(isReturnScreenOrder("preparation", "2026-10-01", "2026-10-13")).toBe(
      false,
    );
    expect(isReturnScreenOrder(null, null, "2026-10-13")).toBe(false);
  });
});

describe("bodega order page", () => {
  it("mounts the return screen for returns and the plain scanner otherwise", () => {
    const page = read("../../../pages/bodega/orden/[id].astro");
    expect(page).toContain("BodegaReturnScreen");
    expect(page).toMatch(/isReturnScreenOrder\(/);
    expect(page).toContain("<BodegaScanner client:load sheet={sheet} />");
  });

  it("forwards scanner check-ins to the panel", () => {
    const scanner = read("../BodegaScanner.tsx");
    expect(scanner).toContain("onCheckedIn?.(");
  });
});
