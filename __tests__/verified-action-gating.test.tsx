import React from "react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook as baseRenderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useWalletStore } from "@/store/walletStore";
import { useVerifiedAction } from "@/hooks/useVerifiedAction";
import { verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { NextRequest } from "next/server";

// `useVerifiedAction` composes `useWallet`, which reaches for the app router and
// the query client. Neither exists in a bare jsdom render.
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn(),
    back: vi.fn(),
    prefetch: vi.fn(),
  }),
  usePathname: () => "/dashboard/investor",
  useSearchParams: () => new URLSearchParams(),
}));

// Mock env. `useVerifiedAction` reaches `lib/stellar/client`, which builds its
// RPC and Horizon singletons at module load — the URLs must be present or the
// whole suite fails to collect.
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_STELLAR_RPC_URL: "https://soroban-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_HORIZON_URL: "https://horizon-testnet.stellar.org",
    NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE: "Test SDF Network ; September 2015",
  },
}));

// `config/walletAssets.ts` ships an invalid `TESTNET_EURC_ISSUER`, so
// `new Asset("EURC", …)` throws while `lib/stellar/contracts` loads and this
// whole suite fails to collect — a pre-existing failure unrelated to gating.
// The production constant is deliberately NOT patched here: inventing an
// issuer address would change on-chain asset identity to make a test file
// importable. Mocking the module keeps the suite honest about what it covers
// (#1123).
vi.mock("@/config/walletAssets", async () => {
  const StellarSdk =
    await vi.importActual<typeof import("@stellar/stellar-sdk")>("@stellar/stellar-sdk");
  const validIssuer = StellarSdk.StrKey.encodeEd25519PublicKey(Buffer.alloc(32, 3));
  const usdc = new StellarSdk.Asset("USDC", validIssuer);
  const eurc = new StellarSdk.Asset("EURC", validIssuer);

  return {
    TESTNET_USDC_ISSUER: validIssuer,
    TESTNET_EURC_ISSUER: validIssuer,
    WALLET_ASSETS: {
      usdc: { code: "USDC", issuer: validIssuer, trustlineLimit: "1000000", asset: usdc },
      eurc: { code: "EURC", issuer: validIssuer, trustlineLimit: "1000000", asset: eurc },
    },
    DEFAULT_WALLET_ASSETS: [
      { symbol: "XLM", type: "native", decimals: 2 },
      { symbol: "USDC", type: "credit", code: "USDC", issuer: validIssuer, decimals: 2 },
      { symbol: "EURC", type: "credit", code: "EURC", issuer: validIssuer, decimals: 2 },
    ],
    DEFAULT_FUNDING_ASSET_SYMBOL: "USDC",
    getAssetBalance: () => "0",
    hasTrustline: () => false,
  };
});

vi.mock("@/components/wallet/VerificationProvider", () => ({
  useVerification: () => ({
    requireVerification: vi.fn(async () => {
      // Simulate successful verification flow in tests
      const store = useWalletStore.getState();
      store.setVerified(true, Date.now() + 3600000);
    }),
    isVerified: useWalletStore.getState().isVerified,
    isLoading: false,
  }),
}));

/** renderHook with the QueryClientProvider `useWallet` expects. */
function renderHook<T>(cb: () => T) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return baseRenderHook(cb, {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    ),
  });
}

describe("Verified Action Gating Integration Tests", () => {
  beforeEach(() => {
    useWalletStore.getState().disconnect();
    useWalletStore.setState({
      address: "GABC1234567890TESTADDRESS",
      publicKey: "GABC1234567890TESTADDRESS",
      isConnected: true,
      provider: "freighter",
      isVerified: false,
      verifiedAt: null,
      verificationExpiresAt: null,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ─── 1. CSRF Validation on Auth Routes ──────────────────────────────────────
  describe("CSRF Validation", () => {
    function createRequest(headers: Record<string, string> = {}): NextRequest {
      const h = new Headers(headers);
      return new NextRequest("http://localhost/api/auth/verify", { method: "POST", headers: h });
    }

    it("returns 403 when CSRF header x-kora-csrf is missing", () => {
      const req = createRequest();
      const res = verifyCsrf(req);
      expect(res).not.toBeNull();
      expect(res!.status).toBe(403);
    });

    it("returns null (valid) when header matches cookie", () => {
      const token = "test-csrf-token-123";
      const h = new Headers({
        [CSRF_HEADER]: token,
        cookie: `${CSRF_COOKIE}=${token}`,
      });
      const req = new NextRequest("http://localhost/api/auth/verify", { method: "POST", headers: h });
      const res = verifyCsrf(req);
      expect(res).toBeNull();
    });
  });

  // ─── 2. Action Protection (Mint, Fund, Repay) ─────────────────────────────
  describe("Protected Actions Execution", () => {
    it("blocks unverified connected users and triggers verification prompt", async () => {
      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "invoice-creation");
      });

      // User was initially unverified, but prompt ran and verified them, then executed action
      expect(actionSpy).toHaveBeenCalledOnce();
      expect(useWalletStore.getState().isVerified).toBe(true);
    });

    it("blocks action when wallet is completely disconnected", async () => {
      useWalletStore.getState().disconnect();
      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "funding");
      });

      expect(res.requiresVerification).toBe(false);
      expect(res.error).toBe("Wallet not connected");
      expect(actionSpy).not.toHaveBeenCalled();
    });

    it("executes protected action directly when user is already verified", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3600000);

      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(actionSpy, "repayment");
      });

      expect(res.requiresVerification).toBe(false);
      expect(actionSpy).toHaveBeenCalledOnce();
    });
  });

  // ─── 2b. Investor Yield Claim (Issue #681) ────────────────────────────────
  //
  // Claiming yield moves funds and now runs through the same gate as SME
  // repayment. These pin the "claim" action type specifically, so the gating
  // cannot be dropped from the claim path while the others keep their coverage.
  describe("Investor yield claim gating", () => {
    it("prompts an unverified investor before running the claim", async () => {
      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      expect(useWalletStore.getState().isVerified).toBe(false);

      await act(async () => {
        await result.current.executeProtectedAction(claimSpy, "claim");
      });

      // The prompt ran, verified the session, and only then released the claim.
      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(claimSpy).toHaveBeenCalledOnce();
    });

    it("runs the claim with no extra prompt when the session is already valid", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);
      const verifiedAt = useWalletStore.getState().verifiedAt;

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.requiresVerification).toBe(false);
      expect(claimSpy).toHaveBeenCalledOnce();
      // A fresh prompt would have re-stamped the session.
      expect(useWalletStore.getState().verifiedAt).toBe(verifiedAt);
    });

    it("re-prompts when the claim is attempted on an expired session", async () => {
      // Two hours past the one-hour verification window.
      useWalletStore.getState().setVerified(true, Date.now() - 2 * 60 * 60 * 1000);
      expect(useWalletStore.getState().isVerificationExpired()).toBe(true);

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(claimSpy).toHaveBeenCalledOnce();
    });

    it("blocks the claim outright when no wallet is connected", async () => {
      useWalletStore.getState().disconnect();

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.error).toBe("Wallet not connected");
      expect(claimSpy).not.toHaveBeenCalled();
    });

    it("reports a failing claim as an error rather than a verification prompt", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);

      const { result } = renderHook(() => useVerifiedAction());
      const claimSpy = vi.fn(async () => {
        throw new Error("insufficient position balance");
      });

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(claimSpy, "claim");
      });

      expect(res.requiresVerification).toBe(false);
      expect(res.error).toBe("insufficient position balance");
    });
  });

  // ─── 3. Session Expiry & Re-verification ──────────────────────────────────
  describe("Session Expiry & Re-verify Prompt", () => {
    it("reports a lapsed verification as expired", () => {
      // `verifiedAt` is when the wallet proved ownership; the session lapses an
      // hour later, so a stamp two hours old is past it.
      useWalletStore.getState().setVerified(true, Date.now() - 2 * 60 * 60 * 1000);

      expect(useWalletStore.getState().isVerificationExpired()).toBe(true);
    });

    it("treats a fresh verification as still valid", () => {
      useWalletStore.getState().setVerified(true, Date.now());

      expect(useWalletStore.getState().isVerificationExpired()).toBe(false);
    });

    it("prompts for re-verification when session is expired upon action attempt", async () => {
      const expiredTimestamp = Date.now() - 1000;
      useWalletStore.getState().setVerified(true, expiredTimestamp);

      const { result } = renderHook(() => useVerifiedAction());
      const actionSpy = vi.fn(async () => {});

      await act(async () => {
        await result.current.executeProtectedAction(actionSpy, "funding");
      });

      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(actionSpy).toHaveBeenCalledOnce();
    });
  });

  // ─── 4. Position Listing Gate (Issue #1123) ──────────────────────────────
  //
  // Listing commits a seller's position to the secondary market, so it needs
  // the same session as funding/claim/repayment. These pin the "listing" type
  // itself, which did not exist before the issue and therefore had no coverage.
  describe("Position listing gating", () => {
    it("prompts an unverified seller before running the listing", async () => {
      const { result } = renderHook(() => useVerifiedAction());
      const listSpy = vi.fn(async () => {});

      expect(useWalletStore.getState().isVerified).toBe(false);

      await act(async () => {
        await result.current.executeProtectedAction(listSpy, "listing");
      });

      expect(useWalletStore.getState().isVerified).toBe(true);
      expect(listSpy).toHaveBeenCalledOnce();
    });

    it("lists with no extra prompt when the session is already valid", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);
      const verifiedAt = useWalletStore.getState().verifiedAt;

      const { result } = renderHook(() => useVerifiedAction());
      const listSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(listSpy, "listing");
      });

      expect(res.requiresVerification).toBe(false);
      expect(listSpy).toHaveBeenCalledOnce();
      expect(useWalletStore.getState().verifiedAt).toBe(verifiedAt);
    });

    it("blocks the listing outright when no wallet is connected", async () => {
      useWalletStore.getState().disconnect();

      const { result } = renderHook(() => useVerifiedAction());
      const listSpy = vi.fn(async () => {});

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(listSpy, "listing");
      });

      expect(res.error).toBe("Wallet not connected");
      expect(listSpy).not.toHaveBeenCalled();
    });

    it("reports a failing listing as an error rather than a verification prompt", async () => {
      useWalletStore.getState().setVerified(true, Date.now() + 3_600_000);

      const { result } = renderHook(() => useVerifiedAction());
      const listSpy = vi.fn(async () => {
        throw new Error("position already listed");
      });

      let res: any;
      await act(async () => {
        res = await result.current.executeProtectedAction(listSpy, "listing");
      });

      expect(res.requiresVerification).toBe(false);
      expect(res.error).toBe("position already listed");
    });
  });

  // ─── 5. Gating Call Sites (Issue #1123) ───────────────────────────────────
  //
  // The pages are far too heavy to render in jsdom, so the contract is checked
  // where it actually lives: in the source. A regression here is a page that
  // quietly calls the store/flow directly again, which no hook-level test can
  // see.
  describe("Gating call sites (source audit)", () => {
    const read = (relPath: string) =>
      readFileSync(join(process.cwd(), relPath), "utf8");

    it("declares 'listing' as a verified action type", () => {
      expect(read("hooks/useVerifiedAction.ts")).toContain('| "listing"');
    });

    it("gates the investor position-listing submit", () => {
      expect(read("app/dashboard/investor/page.tsx")).toContain(
        'executeProtectedAction(runListing, "listing")'
      );
    });

    it("gates the secondary-market acquire-position confirm", () => {
      expect(read("app/secondary/page.tsx")).toMatch(
        /executeProtectedAction\(\s*\(\) => acquirePosition[\s\S]{0,200}"funding"/
      );
    });

    it("still gates the invoice funding confirm", () => {
      expect(read("app/marketplace/[id]/InvoiceDetailClient.tsx")).toMatch(
        /executeProtectedAction\([\s\S]{0,4000}"funding"\s*\)/
      );
    });

    it("distinguishes a pending KYC review from a missing one", () => {
      // Both the inline field error and the blocking toast need it, otherwise
      // the user is told to "verify" while their verification is in progress.
      const source = read("app/marketplace/[id]/InvoiceDetailClient.tsx");
      expect(source.match(/kycStatus === "pending"/g)?.length).toBeGreaterThanOrEqual(2);
    });
  });
});
