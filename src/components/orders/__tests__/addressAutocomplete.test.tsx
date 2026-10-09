import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/services/apiClient", () => ({ apiClient: { post: vi.fn() } }));
import { renderToStaticMarkup } from "react-dom/server";
import {
  AddressInput,
  addressCity,
  addressLine,
  type NormalizedAddress,
} from "../../ui/AddressInput";

const base: NormalizedAddress = {
  formattedAddress: "Av. Apoquindo 3000, Las Condes, Chile",
  street: "Avenida Apoquindo",
  number: "3000",
  commune: "Las Condes",
  city: "Santiago",
  region: "Región Metropolitana",
  country: "Chile",
  postalCode: null,
  lat: null,
  lng: null,
};

describe("AddressInput helpers", () => {
  it("builds the street line from street and number", () => {
    expect(addressLine(base)).toBe("Avenida Apoquindo 3000");
  });

  it("falls back to the formatted address when there is no street", () => {
    expect(addressLine({ ...base, street: null, number: null })).toBe(
      base.formattedAddress,
    );
  });

  it("prefers the commune over the city", () => {
    expect(addressCity(base)).toBe("Las Condes");
    expect(addressCity({ ...base, commune: null })).toBe("Santiago");
    expect(addressCity({ ...base, commune: null, city: null })).toBe("");
  });
});

describe("AddressInput markup", () => {
  it("renders an accessible combobox that keeps the typed value", () => {
    const html = renderToStaticMarkup(
      <AddressInput
        id="addr"
        value="Apoquindo 30"
        onChange={() => {}}
        onSelect={() => {}}
      />,
    );
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-autocomplete="list"');
    expect(html).toContain('aria-expanded="false"');
    expect(html).toContain('autoComplete="off"');
    expect(html).toContain('value="Apoquindo 30"');
    expect(html).not.toContain('role="listbox"');
  });
});

const root = path.resolve(__dirname, "../../..");
const read = (relative: string) =>
  readFileSync(path.join(root, relative), "utf8");

describe("address autocomplete wiring", () => {
  it("EditOrderForm uses AddressInput for billing_address_1 and keeps the saved field names", () => {
    const source = read("components/orders/EditOrderForm.tsx");
    expect(source).toMatch(/<AddressInput[\s\S]{0,80}id="billing_address_1"/);
    expect(source).toContain(
      "handleInputChange('billing_address_1', addressLine(address))",
    );
    expect(source).toContain("handleInputChange('billing_city', city)");
  });

  it("ProcessOrder uses AddressInput for the shipping address string", () => {
    const source = read("components/orders/ProcessOrder.tsx");
    expect(source).toMatch(/<AddressInput[\s\S]{0,80}id="shippingAddressEdit"/);
    expect(source).toContain(
      "onSelect={(address) => setShippingAddress(address.formattedAddress)}",
    );
  });

  it("AddressInput talks only to the admin places endpoints through apiClient", () => {
    const source = read("components/ui/AddressInput.tsx");
    expect(source).toMatch(/["']\/api\/places\/autocomplete["']/);
    expect(source).toMatch(/["']\/api\/places\/details["']/);
    expect(source).toMatch(/from ["']@\/services\/apiClient["']/);
    expect(source).not.toContain("GOOGLE_MAPS_API_KEY");
    expect(source).not.toContain("places.googleapis.com");
  });

  it("the Google key is only read by the server-side service", () => {
    const service = read("services/placesService.ts");
    expect(service).toContain("GOOGLE_MAPS_API_KEY");
    const client = read("components/ui/AddressInput.tsx");
    expect(client).not.toContain("import.meta.env");
  });
});
