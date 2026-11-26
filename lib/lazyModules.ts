/**
 * Systematic lazy loading for heavy third-party libraries.
 *
 * Problem
 * ───────
 * Three library groups dominate the initial JS bundle:
 *   1. @creit.tech/stellar-wallets-kit  — Stellar wallet adapters (~180 kB gz)
 *   2. recharts                          — chart primitives (~120 kB gz)
 *   3. PDF export (html2canvas + jspdf)  — only used on explicit user action
 *
 * Strategy
 * ─────────
 * Each group is wrapped in a lazy loader that:
 *   • Returns a singleton promise (import() is called at most once per session)
 *   • Is typed so callers never lose type safety
 *   • Can be pre-warmed with `preload*()` helpers when the user signals intent
 *     (e.g. hovering a "Connect Wallet" button)
 *
 * Usage
 * ─────
 *   // Trigger load on demand
 *   const { StellarWalletsKit, FREIGHTER_ID, … } = await loadWalletKit();
 *
 *   // Pre-warm on hover / focus to hide latency
 *   <button onMouseEnter={preloadWalletKit} onClick={handleConnect}>
 *     Connect Wallet
 *   </button>
 */

// ─── 1. Stellar Wallets Kit ───────────────────────────────────────────────────

type WalletKitModule = typeof import("@creit.tech/stellar-wallets-kit");

let _walletKitPromise: Promise<WalletKitModule> | null = null;

/**
 * Lazily loads @creit.tech/stellar-wallets-kit.
 * The promise is cached — repeated calls return the same import.
 */
export function loadWalletKit(): Promise<WalletKitModule> {
  if (!_walletKitPromise) {
    _walletKitPromise = import("@creit.tech/stellar-wallets-kit").catch(
      (err) => {
        // Reset so the next call retries on a transient network failure.
        _walletKitPromise = null;
        throw err;
      }
    );
  }
  return _walletKitPromise;
}

/**
 * Pre-warm the wallet kit bundle without blocking the caller.
 * Safe to call on hover/focus — resolves silently on error.
 */
export function preloadWalletKit(): void {
  loadWalletKit().catch(() => undefined);
}

// ─── 2. Recharts ─────────────────────────────────────────────────────────────

type RechartsModule = typeof import("recharts");

let _rechartsPromise: Promise<RechartsModule> | null = null;

/**
 * Lazily loads the entire recharts module.
 * Use this when you need to construct chart elements programmatically.
 * For JSX-based chart components prefer Next.js `dynamic()` with `ssr: false`
 * (already applied on AnalyticsCharts in app/analytics/page.tsx) — this
 * loader covers imperative / non-React use-cases.
 */
export function loadRecharts(): Promise<RechartsModule> {
  if (!_rechartsPromise) {
    _rechartsPromise = import("recharts").catch((err) => {
      _rechartsPromise = null;
      throw err;
    });
  }
  return _rechartsPromise;
}

/**
 * Pre-warm recharts when the user navigates to or hovers the analytics section.
 */
export function preloadRecharts(): void {
  loadRecharts().catch(() => undefined);
}

// ─── 3. PDF export (html2canvas + jsPDF) ─────────────────────────────────────

interface PdfExportModule {
  html2canvas: typeof import("html2canvas").default;
  jsPDF: typeof import("jspdf").default;
}

let _pdfExportPromise: Promise<PdfExportModule> | null = null;

/**
 * Lazily loads html2canvas and jsPDF in parallel.
 * Both libraries are only needed when the user explicitly triggers PDF export,
 * so they should never appear in the initial bundle.
 */
export function loadPdfExport(): Promise<PdfExportModule> {
  if (!_pdfExportPromise) {
    _pdfExportPromise = Promise.all([
      import("html2canvas"),
      import("jspdf"),
    ])
      .then(([html2canvasMod, jsPDFMod]) => ({
        html2canvas: html2canvasMod.default,
        jsPDF: jsPDFMod.default,
      }))
      .catch((err) => {
        _pdfExportPromise = null;
        throw err;
      });
  }
  return _pdfExportPromise;
}

/**
 * Pre-warm the PDF export bundle when the user hovers an export button.
 */
export function preloadPdfExport(): void {
  loadPdfExport().catch(() => undefined);
}

// ─── 4. Stellar SDK (heavy — only needed for XDR construction) ────────────────

type StellarSdkModule = typeof import("@stellar/stellar-sdk");

let _stellarSdkPromise: Promise<StellarSdkModule> | null = null;

/**
 * Lazily loads @stellar/stellar-sdk.
 * The SDK is large (~400 kB gz) and only needed for transaction signing flows.
 * Pre-warm when the user shows intent to transact (e.g. clicks "Fund Invoice").
 */
export function loadStellarSdk(): Promise<StellarSdkModule> {
  if (!_stellarSdkPromise) {
    _stellarSdkPromise = import("@stellar/stellar-sdk").catch((err) => {
      _stellarSdkPromise = null;
      throw err;
    });
  }
  return _stellarSdkPromise;
}

/**
 * Pre-warm the Stellar SDK when the user signals intent to transact.
 */
export function preloadStellarSdk(): void {
  loadStellarSdk().catch(() => undefined);
}

// ─── 5. Analytics chart components ───────────────────────────────────────────
//
// These components render recharts internally. Importing them eagerly pulls
// recharts (and the component tree) into the main bundle. Each loader below
// returns the component's default export via a cached, retry-on-failure
// dynamic import so callers can feed it to Next.js `dynamic()` or render it
// imperatively.

type AnalyticsChartsModule =
  typeof import("@/components/analytics/AnalyticsCharts");

let _analyticsChartsPromise: Promise<AnalyticsChartsModule> | null = null;

/**
 * Lazily loads the AnalyticsCharts component module.
 */
export function loadAnalyticsCharts(): Promise<AnalyticsChartsModule> {
  if (!_analyticsChartsPromise) {
    _analyticsChartsPromise = import("@/components/analytics/AnalyticsCharts").catch(
      (err) => {
        _analyticsChartsPromise = null;
        throw err;
      }
    );
  }
  return _analyticsChartsPromise;
}

/**
 * Pre-warm the analytics charts bundle (e.g. on nav hover).
 */
export function preloadAnalyticsCharts(): void {
  loadAnalyticsCharts().catch(() => undefined);
}

type YieldVarianceChartModule =
  typeof import("@/components/analytics/YieldVarianceChart");

let _yieldVarianceChartPromise: Promise<YieldVarianceChartModule> | null = null;

/**
 * Lazily loads the YieldVarianceChart component module.
 */
export function loadYieldVarianceChart(): Promise<YieldVarianceChartModule> {
  if (!_yieldVarianceChartPromise) {
    _yieldVarianceChartPromise = import(
      "@/components/analytics/YieldVarianceChart"
    ).catch((err) => {
      _yieldVarianceChartPromise = null;
      throw err;
    });
  }
  return _yieldVarianceChartPromise;
}

/**
 * Pre-warm the yield variance chart bundle.
 */
export function preloadYieldVarianceChart(): void {
  loadYieldVarianceChart().catch(() => undefined);
}

type SellerAnalyticsDashboardModule =
  typeof import("@/components/analytics/SellerAnalyticsDashboard");

let _sellerAnalyticsDashboardPromise: Promise<SellerAnalyticsDashboardModule> | null =
  null;

/**
 * Lazily loads the SellerAnalyticsDashboard component module.
 */
export function loadSellerAnalyticsDashboard(): Promise<SellerAnalyticsDashboardModule> {
  if (!_sellerAnalyticsDashboardPromise) {
    _sellerAnalyticsDashboardPromise = import(
      "@/components/analytics/SellerAnalyticsDashboard"
    ).catch((err) => {
      _sellerAnalyticsDashboardPromise = null;
      throw err;
    });
  }
  return _sellerAnalyticsDashboardPromise;
}

/**
 * Pre-warm the seller analytics dashboard bundle.
 */
export function preloadSellerAnalyticsDashboard(): void {
  loadSellerAnalyticsDashboard().catch(() => undefined);
}

// ─── 6. Dashboard chart components ───────────────────────────────────────────

type PortfolioDonutModule =
  typeof import("@/components/dashboard/PortfolioDonut");

let _portfolioDonutPromise: Promise<PortfolioDonutModule> | null = null;

/**
 * Lazily loads the PortfolioDonut component module.
 */
export function loadPortfolioDonut(): Promise<PortfolioDonutModule> {
  if (!_portfolioDonutPromise) {
    _portfolioDonutPromise = import("@/components/dashboard/PortfolioDonut").catch(
      (err) => {
        _portfolioDonutPromise = null;
        throw err;
      }
    );
  }
  return _portfolioDonutPromise;
}

/**
 * Pre-warm the portfolio donut chart bundle.
 */
export function preloadPortfolioDonut(): void {
  loadPortfolioDonut().catch(() => undefined);
}

type YieldProjectionCalculatorModule =
  typeof import("@/components/dashboard/YieldProjectionCalculator");

let _yieldProjectionCalculatorPromise: Promise<YieldProjectionCalculatorModule> | null =
  null;

/**
 * Lazily loads the YieldProjectionCalculator component module.
 */
export function loadYieldProjectionCalculator(): Promise<YieldProjectionCalculatorModule> {
  if (!_yieldProjectionCalculatorPromise) {
    _yieldProjectionCalculatorPromise = import(
      "@/components/dashboard/YieldProjectionCalculator"
    ).catch((err) => {
      _yieldProjectionCalculatorPromise = null;
      throw err;
    });
  }
  return _yieldProjectionCalculatorPromise;
}

/**
 * Pre-warm the yield projection calculator bundle.
 */
export function preloadYieldProjectionCalculator(): void {
  loadYieldProjectionCalculator().catch(() => undefined);
}

// ─── Utility: reset all cached promises (useful in tests) ────────────────────

export function _resetLazyModuleCache(): void {
  _walletKitPromise = null;
  _rechartsPromise = null;
  _pdfExportPromise = null;
  _stellarSdkPromise = null;
  _analyticsChartsPromise = null;
  _yieldVarianceChartPromise = null;
  _sellerAnalyticsDashboardPromise = null;
  _portfolioDonutPromise = null;
  _yieldProjectionCalculatorPromise = null;
}
