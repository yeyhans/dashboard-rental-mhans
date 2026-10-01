import { describe, expect, it } from "vitest";
import { rowActionKey } from "../rowActionKey";

describe("rowActionKey", () => {
  it("uses the item id when given", () => {
    expect(rowActionKey({ id: "edit", label: "Editar" }, 0)).toBe("edit");
  });

  it("stringifies a numeric id", () => {
    expect(rowActionKey({ id: 7, label: "Editar" }, 0)).toBe("7");
  });

  it("falls back to index + label when there is no id", () => {
    expect(rowActionKey({ label: "Ver ficha" }, 2)).toBe("2-Ver ficha");
  });

  it("produces distinct keys for duplicate labels without an id", () => {
    const keyA = rowActionKey({ label: "Ver" }, 0);
    const keyB = rowActionKey({ label: "Ver" }, 1);
    expect(keyA).not.toBe(keyB);
  });
});
