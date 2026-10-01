import { afterEach, describe, expect, it } from "vitest";
import {
  loadCatalogViewMode,
  saveCatalogViewMode,
} from "../catalogViewPreference";

function withFakeWindow<T>(run: (storage: Map<string, string>) => T): T {
  const storage = new Map<string, string>();
  const fakeLocalStorage = {
    getItem: (key: string) => (storage.has(key) ? storage.get(key)! : null),
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  };
  (globalThis as any).window = { localStorage: fakeLocalStorage };
  try {
    return run(storage);
  } finally {
    delete (globalThis as any).window;
  }
}

describe("loadCatalogViewMode / saveCatalogViewMode", () => {
  afterEach(() => {
    delete (globalThis as any).window;
  });

  it("defaults to 'list' when there is no window (SSR)", () => {
    expect(loadCatalogViewMode()).toBe("list");
  });

  it("defaults to 'list' when nothing is stored", () => {
    withFakeWindow(() => {
      expect(loadCatalogViewMode()).toBe("list");
    });
  });

  it("round-trips a saved 'grid' preference", () => {
    withFakeWindow((storage) => {
      saveCatalogViewMode("grid");
      expect(storage.get("mhans:catalog-view-mode")).toBe("grid");
      expect(loadCatalogViewMode()).toBe("grid");
    });
  });

  it("ignores a corrupted/unknown stored value instead of throwing", () => {
    withFakeWindow((storage) => {
      storage.set("mhans:catalog-view-mode", "not-a-real-mode");
      expect(loadCatalogViewMode()).toBe("list");
    });
  });

  it("never throws when localStorage access itself throws (private window / blocked storage)", () => {
    (globalThis as any).window = {
      localStorage: {
        getItem: () => {
          throw new Error("blocked");
        },
        setItem: () => {
          throw new Error("blocked");
        },
      },
    };
    expect(() => loadCatalogViewMode()).not.toThrow();
    expect(loadCatalogViewMode()).toBe("list");
    expect(() => saveCatalogViewMode("grid")).not.toThrow();
  });
});
