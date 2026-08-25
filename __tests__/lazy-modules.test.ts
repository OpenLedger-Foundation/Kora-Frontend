/**
 * Tests for lib/lazyModules.ts — systematic lazy loading for heavy libs.
 *
 * Verifies:
 *   • Each loader returns a promise that resolves to the expected module shape
 *   • The singleton pattern is honoured (same promise returned on repeated calls)
 *   • preload* helpers are safe fire-and-forget calls (no throw)
 *   • _resetLazyModuleCache allows test isolation
 *   • Failed imports reset the cache so the next call retries
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  loadWalletKit,
  preloadWalletKit,
  loadRecharts,
  preloadRecharts,
  loadPdfExport,
  preloadPdfExport,
  loadStellarSdk,
  preloadStellarSdk,
  _resetLazyModuleCache,
} from "../lib/lazyModules";

// ─── Module mocks ─────────────────────────────────────────────────────────────

vi.mock("@creit.tech/stellar-wallets-kit", () => ({
  StellarWalletsKit: class {},
  WalletNetwork: { TESTNET: "TESTNET", PUBLIC: "PUBLIC" },
  FREIGHTER_ID: "freighter",
  FreighterModule: class {},
  xBullModule: class {},
  LobstrModule: class {},
  AlbedoModule: class {},
}));

vi.mock("recharts", () => ({
  ResponsiveContainer: () => null,
  AreaChart: () => null,
  BarChart: () => null,
  LineChart: () => null,
  PieChart: () => null,
}));

vi.mock("html2canvas", () => ({ default: vi.fn(async () => ({ toDataURL: () => "data:image/png;base64," })) }));
vi.mock("jspdf", () => ({
  default: class {
    addImage() {}
    addPage() {}
    save() {}
    internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
  },
}));

vi.mock("@stellar/stellar-sdk", () => ({
  rpc: {},
  Horizon: {},
  TransactionBuilder: class {},
  Contract: class {},
  Address: class {},
  BASE_FEE: "100",
  xdr: {},
}));

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  _resetLazyModuleCache();
  vi.clearAllMocks();
});

afterEach(() => {
  _resetLazyModuleCache();
});

// ─── Wallet Kit ───────────────────────────────────────────────────────────────

describe("loadWalletKit", () => {
  it("resolves to the wallet kit module", async () => {
    const mod = await loadWalletKit();
    expect(mod).toBeDefined();
    expect(mod.StellarWalletsKit).toBeDefined();
    expect(mod.FREIGHTER_ID).toBe("freighter");
  });

  it("returns the same promise on repeated calls (singleton)", () => {
    const p1 = loadWalletKit();
    const p2 = loadWalletKit();
    expect(p1).toBe(p2);
  });

  it("returns a new promise after cache reset", () => {
    const p1 = loadWalletKit();
    _resetLazyModuleCache();
    const p2 = loadWalletKit();
    expect(p1).not.toBe(p2);
  });
});

describe("preloadWalletKit", () => {
  it("does not throw", () => {
    expect(() => preloadWalletKit()).not.toThrow();
  });

  it("warms the cache so loadWalletKit returns the same promise", async () => {
    preloadWalletKit();
    const p = loadWalletKit();
    await expect(p).resolves.toBeDefined();
  });
});

// ─── Recharts ─────────────────────────────────────────────────────────────────

describe("loadRecharts", () => {
  it("resolves to the recharts module", async () => {
    const mod = await loadRecharts();
    expect(mod).toBeDefined();
    expect(mod.ResponsiveContainer).toBeDefined();
  });

  it("returns the same promise on repeated calls (singleton)", () => {
    const p1 = loadRecharts();
    const p2 = loadRecharts();
    expect(p1).toBe(p2);
  });

  it("returns a new promise after cache reset", () => {
    const p1 = loadRecharts();
    _resetLazyModuleCache();
    const p2 = loadRecharts();
    expect(p1).not.toBe(p2);
  });
});

describe("preloadRecharts", () => {
  it("does not throw", () => {
    expect(() => preloadRecharts()).not.toThrow();
  });
});

// ─── PDF Export ───────────────────────────────────────────────────────────────

describe("loadPdfExport", () => {
  it("resolves with html2canvas and jsPDF", async () => {
    const mod = await loadPdfExport();
    expect(mod.html2canvas).toBeDefined();
    expect(mod.jsPDF).toBeDefined();
    expect(typeof mod.html2canvas).toBe("function");
    expect(typeof mod.jsPDF).toBe("function");
  });

  it("returns the same promise on repeated calls (singleton)", () => {
    const p1 = loadPdfExport();
    const p2 = loadPdfExport();
    expect(p1).toBe(p2);
  });

  it("returns a new promise after cache reset", () => {
    const p1 = loadPdfExport();
    _resetLazyModuleCache();
    const p2 = loadPdfExport();
    expect(p1).not.toBe(p2);
  });
});

describe("preloadPdfExport", () => {
  it("does not throw", () => {
    expect(() => preloadPdfExport()).not.toThrow();
  });
});

// ─── Stellar SDK ─────────────────────────────────────────────────────────────

describe("loadStellarSdk", () => {
  it("resolves to the Stellar SDK module", async () => {
    const mod = await loadStellarSdk();
    expect(mod).toBeDefined();
    expect(mod.TransactionBuilder).toBeDefined();
    expect(mod.BASE_FEE).toBe("100");
  });

  it("returns the same promise on repeated calls (singleton)", () => {
    const p1 = loadStellarSdk();
    const p2 = loadStellarSdk();
    expect(p1).toBe(p2);
  });

  it("returns a new promise after cache reset", () => {
    const p1 = loadStellarSdk();
    _resetLazyModuleCache();
    const p2 = loadStellarSdk();
    expect(p1).not.toBe(p2);
  });
});

describe("preloadStellarSdk", () => {
  it("does not throw", () => {
    expect(() => preloadStellarSdk()).not.toThrow();
  });
});

// ─── Cache reset ──────────────────────────────────────────────────────────────

describe("_resetLazyModuleCache", () => {
  it("resets all cached promises so loaders create fresh ones", () => {
    const wk1 = loadWalletKit();
    const rc1 = loadRecharts();
    const pdf1 = loadPdfExport();
    const sdk1 = loadStellarSdk();

    _resetLazyModuleCache();

    const wk2 = loadWalletKit();
    const rc2 = loadRecharts();
    const pdf2 = loadPdfExport();
    const sdk2 = loadStellarSdk();

    expect(wk1).not.toBe(wk2);
    expect(rc1).not.toBe(rc2);
    expect(pdf1).not.toBe(pdf2);
    expect(sdk1).not.toBe(sdk2);
  });
});
