import { describe, expect, it } from "vitest";
import { getAdminInitials } from "../adminIdentity";

describe("getAdminInitials", () => {
  it("uses the first letter of the first two words of the name, uppercased", () => {
    expect(
      getAdminInitials({ name: "Mario Hans", email: "mario@mariohans.cl" }),
    ).toBe("MH");
  });

  it("uses the first two letters of a single-word name", () => {
    expect(
      getAdminInitials({ name: "Yeyson", email: "yeyson@mariohans.cl" }),
    ).toBe("YE");
  });

  it("falls back to the email local part when there is no name", () => {
    expect(getAdminInitials({ email: "yeysonhans@gmail.com" })).toBe("YE");
  });

  it("splits the email local part on separators for two initials", () => {
    expect(getAdminInitials({ email: "mario.hans@mariohans.cl" })).toBe("MH");
    expect(getAdminInitials({ email: "mario_hans@mariohans.cl" })).toBe("MH");
  });

  it("falls back to '?' when there is neither name nor email", () => {
    expect(getAdminInitials({})).toBe("?");
    expect(getAdminInitials(null)).toBe("?");
    expect(getAdminInitials(undefined)).toBe("?");
  });

  it("ignores a blank name and falls back to the email", () => {
    expect(getAdminInitials({ name: "   ", email: "ana@mariohans.cl" })).toBe(
      "AN",
    );
  });
});
