import { describe, expect, it, vi } from "vitest";

import { formatIsoDateLabel, openDatePicker } from "../dateInput";

describe("openDatePicker", () => {
  it("does nothing when there is no input", () => {
    expect(openDatePicker(null)).toBe("none");
  });

  it("opens the native picker when showPicker works", () => {
    const input = { showPicker: vi.fn(), focus: vi.fn(), click: vi.fn() };
    expect(openDatePicker(input)).toBe("picker");
    expect(input.showPicker).toHaveBeenCalledOnce();
    expect(input.focus).not.toHaveBeenCalled();
  });

  it("falls back to focus + click when showPicker throws (NotAllowedError, iframe, no gesture)", () => {
    const input = {
      showPicker: vi.fn(() => {
        throw new DOMException("blocked", "NotAllowedError");
      }),
      focus: vi.fn(),
      click: vi.fn(),
    };
    expect(openDatePicker(input)).toBe("fallback");
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.click).toHaveBeenCalledOnce();
  });

  it("falls back to focus + click when showPicker is not supported", () => {
    const input = { focus: vi.fn(), click: vi.fn() };
    expect(openDatePicker(input)).toBe("fallback");
    expect(input.focus).toHaveBeenCalledOnce();
    expect(input.click).toHaveBeenCalledOnce();
  });

  it("never throws, even when the fallback itself fails", () => {
    const input = {
      showPicker: () => {
        throw new Error("boom");
      },
      focus: () => {
        throw new Error("boom");
      },
      click: () => {
        throw new Error("boom");
      },
    };
    expect(() => openDatePicker(input)).not.toThrow();
    expect(openDatePicker(input)).toBe("fallback");
  });
});

describe("formatIsoDateLabel", () => {
  it("formats an ISO day as DD/MM/YYYY", () => {
    expect(formatIsoDateLabel("2026-10-06")).toBe("06/10/2026");
  });

  it("returns an empty string for the no-date state", () => {
    expect(formatIsoDateLabel("")).toBe("");
  });

  it("returns an empty string for anything that is not an ISO day", () => {
    expect(formatIsoDateLabel("06/10/2026")).toBe("");
    expect(formatIsoDateLabel("2026-10")).toBe("");
  });
});
