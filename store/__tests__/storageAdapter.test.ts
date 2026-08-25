import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  __resetStorageAdapterForTests,
  safeStorageGetItem,
  safeStorageSetItem,
  safeStorageRemoveItem,
} from "@/store/storageAdapter";

function makeWorkingStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key: string) => (map.has(key) ? map.get(key)! : null),
    key: (index: number) => Array.from(map.keys())[index] ?? null,
    removeItem: (key: string) => {
      map.delete(key);
    },
    setItem: (key: string, value: string) => {
      map.set(key, value);
    },
  };
}

function makeThrowingStorage(): Storage {
  return {
    get length() {
      throw new Error("storage unavailable");
    },
    clear: () => {
      throw new Error("storage unavailable");
    },
    getItem: () => {
      throw new Error("storage unavailable");
    },
    key: () => {
      throw new Error("storage unavailable");
    },
    removeItem: () => {
      throw new Error("storage unavailable");
    },
    setItem: () => {
      throw new Error("storage unavailable");
    },
  };
}

describe("storageAdapter", () => {
  const originalLocalStorage = window.localStorage;
  const originalSessionStorage = window.sessionStorage;

  beforeEach(() => {
    __resetStorageAdapterForTests();
  });

  afterEach(() => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: originalLocalStorage,
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: originalSessionStorage,
    });
    __resetStorageAdapterForTests();
    vi.restoreAllMocks();
  });

  it("falls back to sessionStorage when localStorage is unavailable", () => {
    const sessionStorage = makeWorkingStorage();
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: makeThrowingStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: sessionStorage,
    });

    safeStorageSetItem("kora:test", "value");

    expect(safeStorageGetItem("kora:test")).toBe("value");
    safeStorageRemoveItem("kora:test");
    expect(safeStorageGetItem("kora:test")).toBeNull();
  });

  it("falls back to in-memory storage and warns once when both storages are unavailable", () => {
    Object.defineProperty(window, "localStorage", {
      configurable: true,
      value: makeThrowingStorage(),
    });
    Object.defineProperty(window, "sessionStorage", {
      configurable: true,
      value: makeThrowingStorage(),
    });

    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    safeStorageSetItem("kora:memory", "1");
    safeStorageSetItem("kora:memory2", "2");

    expect(safeStorageGetItem("kora:memory")).toBe("1");
    expect(safeStorageGetItem("kora:memory2")).toBe("2");
    expect(warnSpy).toHaveBeenCalledTimes(1);
  });
});
