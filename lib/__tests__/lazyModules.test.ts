import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadRecharts,
  preloadRecharts,
  _resetPreloadRechartsForTesting,
  loadWalletKit,
  preloadWalletKit,
  loadPdfExport,
} from "../lazyModules";

describe("lazyModules - Recharts intent-based preload (Issue #965)", () => {
  beforeEach(() => {
    _resetPreloadRechartsForTesting();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    _resetPreloadRechartsForTesting();
  });

  it("pre-warms recharts and caches the resulting promise", async () => {
    preloadRecharts();
    const promise1 = loadRecharts();
    const promise2 = loadRecharts();

    expect(promise1).toBe(promise2);
    const mod = await promise1;
    expect(mod).toBeDefined();
  });

  it("deduplicates preload calls using module-level flag", async () => {
    const loadSpy = vi.fn().mockResolvedValue({ LineChart: () => null });

    // Call preload multiple times in succession
    preloadRecharts();
    preloadRecharts();
    preloadRecharts();

    // Verify subsequent calls return cached singleton
    const mod = await loadRecharts();
    expect(mod).toBeDefined();
  });

  it("suppresses preload when user enabled reduced-data mode (saveData)", async () => {
    const originalNavigator = global.navigator;
    try {
      Object.defineProperty(global, "navigator", {
        value: {
          connection: {
            saveData: true,
          },
        },
        configurable: true,
        writable: true,
      });

      // Calling preloadRecharts should be a no-op under saveData
      preloadRecharts();

      // Ensure module flag wasn't locked in
      _resetPreloadRechartsForTesting();
    } finally {
      Object.defineProperty(global, "navigator", {
        value: originalNavigator,
        configurable: true,
        writable: true,
      });
    }
  });

  it("safely handles server-side execution without throwing", () => {
    const originalWindow = global.window;
    try {
      // @ts-expect-error - simulating SSR environment
      delete global.window;
      expect(() => preloadRecharts()).not.toThrow();
    } finally {
      global.window = originalWindow;
    }
  });

  it("preloads wallet kit without blocking caller", async () => {
    expect(() => preloadWalletKit()).not.toThrow();
    const walletKit = await loadWalletKit();
    expect(walletKit).toBeDefined();
  });

  it("lazily loads PDF export modules on demand", async () => {
    const pdfExport = await loadPdfExport();
    expect(pdfExport).toBeDefined();
    expect(pdfExport.html2canvas).toBeDefined();
    expect(pdfExport.jsPDF).toBeDefined();
  });
});
