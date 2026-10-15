import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

// The image uploader pulls the Supabase client in; this render needs no data access.
vi.mock("../../../lib/supabase", () => ({ supabase: {}, supabaseAdmin: null }));

import { ProductDetail } from "../ProductDetail";

const product = {
  id: 42,
  name: "Canon EOS R5",
  status: "publish",
  stock_status: "instock",
  price: "45000",
  images: [],
  categories_ids: [],
} as unknown as Parameters<typeof ProductDetail>[0]["product"];

describe("ProductDetail view mode (canon ficha tabs)", () => {
  it("offers the Ficha and Inventario tabs, Ficha selected by default", () => {
    const html = renderToStaticMarkup(<ProductDetail product={product} categories={[]} onSave={async () => {}} />);
    const tabs = html.match(/<button[^>]*role="tab"[^>]*>[^<]*<\/button>/g) ?? [];
    expect(tabs.map((tab) => tab.replace(/<[^>]+>/g, ""))).toEqual(["Ficha", "Inventario"]);
    expect(tabs[0]).toContain('aria-selected="true"');
  });

  it("keeps the product view (Información) in the Ficha tab", () => {
    const html = renderToStaticMarkup(<ProductDetail product={product} categories={[]} onSave={async () => {}} />);
    expect(html).toContain("Canon EOS R5");
  });
});
