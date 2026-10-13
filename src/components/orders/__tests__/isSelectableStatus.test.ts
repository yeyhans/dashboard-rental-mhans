import { describe, expect, it } from "vitest";
import { isSelectableStatus } from "../OrderEstado";

describe("isSelectableStatus", () => {
  it("keeps the current status selectable so the control can show it", () => {
    expect(isSelectableStatus("preparation", "preparation")).toBe(true);
  });

  it("allows the next stage and cancelling", () => {
    expect(isSelectableStatus("request", "evaluation")).toBe(true);
    expect(isSelectableStatus("request", "cancelled")).toBe(true);
  });

  it("blocks skipping a stage or going backwards", () => {
    expect(isSelectableStatus("request", "completed")).toBe(false);
    expect(isSelectableStatus("in-rental", "preparation")).toBe(false);
  });

  it("blocks every change from a terminal status", () => {
    expect(isSelectableStatus("completed", "cancelled")).toBe(false);
  });

  it("does not judge a legacy origin the machine does not know", () => {
    expect(isSelectableStatus("processing", "completed")).toBe(true);
  });
});
