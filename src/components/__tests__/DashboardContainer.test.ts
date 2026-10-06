import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(__dirname, "../DashboardContainer.tsx"),
  "utf-8",
);

describe("DashboardContainer KPI strip (D-1)", () => {
  it("passes a destination href to the KPIs that have one", () => {
    expect(source).toMatch(/href=\{DASHBOARD_KPI_HREFS\[kpi\.key\]\}/);
    expect(source).toMatch(
      /DASHBOARD_KPI_HREFS[^=]*=\s*\{[^}]*pedidosActivos:\s*"\/orders"/s,
    );
  });

  it("no longer renders the duplicated second KPI row (01.4)", () => {
    expect(source).not.toContain("OrderKpiRow");
  });
});
