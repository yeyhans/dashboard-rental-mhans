import { describe, expect, it } from "vitest";
import { resolveAccess } from "../accessControl";

/**
 * D-3: the operator moves an order forward on the bodega sheet. Only the status endpoint (both URL
 * shapes), only PUT, only a numeric order id. The forward-only allowlist itself is enforced by the
 * endpoint (`lib/operatorOrderStatus.ts`); this file pins that nothing else under /api/orders opens.
 */
describe("resolveAccess: operator and the order status endpoint", () => {
  it("allows PUT on the order status endpoint, both URL shapes", () => {
    expect(resolveAccess("operator", "/api/orders/55/status", "PUT")).toBe(
      "allow",
    );
    expect(resolveAccess("operator", "/api/orders/status/55", "PUT")).toBe(
      "allow",
    );
    expect(resolveAccess("operator", "/api/orders/55/status/", "put")).toBe(
      "allow",
    );
  });

  it("does not open anything else under /api/orders to the operator", () => {
    expect(resolveAccess("operator", "/api/orders/55/status", "GET")).toBe(
      "forbidden",
    );
    expect(resolveAccess("operator", "/api/orders/55/status", "DELETE")).toBe(
      "forbidden",
    );
    expect(resolveAccess("operator", "/api/orders/status/55", "POST")).toBe(
      "forbidden",
    );
    expect(resolveAccess("operator", "/api/orders/55", "PUT")).toBe(
      "forbidden",
    );
    expect(resolveAccess("operator", "/api/orders/55/email", "PUT")).toBe(
      "forbidden",
    );
    expect(
      resolveAccess("operator", "/api/orders/55/generate-budget", "POST"),
    ).toBe("forbidden");
    expect(resolveAccess("operator", "/api/orders/abc/status", "PUT")).toBe(
      "forbidden",
    );
    expect(
      resolveAccess("operator", "/api/orders/55/status/extra", "PUT"),
    ).toBe("forbidden");
    expect(
      resolveAccess("operator", "/api/orders/status/55/extra", "PUT"),
    ).toBe("forbidden");
    expect(resolveAccess("operator", "/api/orders/update/55", "PUT")).toBe(
      "forbidden",
    );
  });

  it("leaves admin and super_admin unchanged", () => {
    expect(resolveAccess("admin", "/api/orders/55", "DELETE")).toBe("allow");
    expect(resolveAccess("super_admin", "/api/orders/55/status", "PUT")).toBe(
      "allow",
    );
  });
});
