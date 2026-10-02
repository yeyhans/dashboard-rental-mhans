import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS } from "../../../siteSettings";
import { buildBudgetDocumentData } from "../budgetData";
import { buildProcessingDocumentData } from "../processingData";
import { buildUserContractData } from "../contractData";
import { settingsOverride } from "../../__tests__/fixtures";

const NOW = new Date("2026-05-16T15:00:00Z");
const order = {
  id: 9,
  billing: { first_name: "Ana", last_name: "Soto", email: "a@x.cl" },
  line_items: [{ name: "Cámara", price: 10000, quantity: 1 }],
  metadata: {
    num_jornadas: 1,
    order_fecha_inicio: "2026-02-01",
    order_fecha_termino: "2026-02-01",
    calculated_subtotal: 10000,
    calculated_iva: 1900,
    calculated_total: 11900,
  },
};

describe("mappers take SiteSettings", () => {
  it("budget defaults to DEFAULT_SETTINGS when the parameter is omitted", () => {
    const data = buildBudgetDocumentData(order, null, NOW);
    expect(data.bank.accountNumber).toBe(DEFAULT_SETTINGS.bank.accountNumber);
    expect(data.policies.footer).toBe(DEFAULT_SETTINGS.policies.footer);
    expect(data.totals.reserve).toBe(2975);
    expect(data.totals.reserveLabel).toBe("Reserva 25%");
  });

  it("budget uses the settings default reserve only when the order has none", () => {
    const withDefault = buildBudgetDocumentData(
      order,
      null,
      NOW,
      settingsOverride,
    );
    expect(withDefault.totals.reserve).toBe(3570);
    expect(withDefault.totals.reserveLabel).toBe("Reserva 30%");
    const configured = buildBudgetDocumentData(
      { ...order, reserve_type: "percent", reserve_value: 50 },
      null,
      NOW,
      settingsOverride,
    );
    expect(configured.totals.reserveLabel).toBe("Reserva 50%");
  });

  it("budget carries bank and policies from the settings", () => {
    const data = buildBudgetDocumentData(order, null, NOW, settingsOverride);
    expect(data.bank).toEqual(settingsOverride.bank);
    expect(data.policies).toEqual({
      acceptance: settingsOverride.policies.acceptance,
      footer: settingsOverride.policies.footer,
    });
  });

  it("processing carries landlord, pickup addresses and the default reserve pct", () => {
    const data = buildProcessingDocumentData(
      order,
      null,
      NOW,
      settingsOverride,
    );
    expect(data.landlord).toMatchObject({
      name: "Valentina Paz Orrego Díaz",
      company: "Luz y Cámara Rental SpA",
      companyRut: "76.111.222-3",
    });
    expect(data.annex.pickupAddress).toBe(
      "Av. Italia 1500, Ñuñoa o Los Leones 300, Providencia",
    );
    expect(data.annex.reservePct).toBe(30);
  });

  it("contract carries landlord, bank, reserve pct, e-mail and website", () => {
    const data = buildUserContractData({ user_id: 1 }, NOW, settingsOverride);
    expect(data.landlord.signatureUrl).toBe(
      settingsOverride.representative.signatureUrl,
    );
    expect(data.bank.accountNumber).toBe("99887766");
    expect(data.reservePct).toBe(30);
    expect(data.landlordEmail).toBe("hola@luzcamara.cl");
    expect(data.website).toBe("https://luzcamara.cl");
  });

  it("contract falls back to the default contact e-mail when settings has none", () => {
    const blank = {
      ...DEFAULT_SETTINGS,
      contact: { ...DEFAULT_SETTINGS.contact, email: "" },
    };
    const data = buildUserContractData({ user_id: 1 }, NOW, blank);
    expect(data.landlordEmail).toBe(DEFAULT_SETTINGS.bank.email);
  });
});
