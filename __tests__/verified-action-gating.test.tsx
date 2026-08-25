import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useWalletStore } from "@/store/walletStore";
import { useVerifiedAction } from "@/hooks/useVerifiedAction";
import { verifyCsrf, CSRF_COOKIE, CSRF_HEADER } from "@/lib/csrf";
import { NextRequest } from "next/server";

// Mock env
vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_ENABLE_MOCK_DATA: true,
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
  },
}));

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

  // ─── 3. Session Expiry & Re-verification ──────────────────────────────────
  describe("Session Expiry & Re-verify Prompt", () => {
    it("clears verification state when verification expires", () => {
      const expiredTimestamp = Date.now() - 1000;
      useWalletStore.getState().setVerified(true, expiredTimestamp);

      const store = useWalletStore.getState();
      expect(store.checkVerification()).toBe(false);
      expect(store.isVerified).toBe(false);
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
});
