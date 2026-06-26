import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useNetworkValidation } from "../useNetworkValidation";
import { useWalletStore } from "@/store";

// Mock the wallet store
vi.mock("@/store", () => ({
  useWalletStore: vi.fn(),
}));

describe("useNetworkValidation", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should return no mismatch when both checks pass", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => false,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.isNetworkMismatch).toBe(false);
    expect(result.current.errorMessage).toBe("");
  });

  it("should detect network enum mismatch", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.isNetworkMismatch).toBe(true);
    expect(result.current.isWrongNetwork).toBe(true);
    expect(result.current.errorMessage).toContain("wrong network");
  });

  it("should detect passphrase mismatch", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => true,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.isNetworkMismatch).toBe(true);
    expect(result.current.hasPassphraseMismatch).toBe(true);
    expect(result.current.errorMessage).toContain("passphrase");
  });

  it("should detect both network enum and passphrase mismatch", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => true,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.isNetworkMismatch).toBe(true);
    expect(result.current.isWrongNetwork).toBe(true);
    expect(result.current.hasPassphraseMismatch).toBe(true);
    // Should prioritize passphrase message
    expect(result.current.errorMessage).toContain("passphrase");
  });

  it("should provide descriptive error messages", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => true,
      hasPassphraseMismatch: () => false,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.errorMessage).toContain("switch");
    expect(result.current.errorMessage).toContain("network");
  });

  it("should provide passphrase-specific error message", () => {
    vi.mocked(useWalletStore).mockReturnValue({
      isWrongNetwork: () => false,
      hasPassphraseMismatch: () => true,
    } as any);

    const { result } = renderHook(() => useNetworkValidation());
    expect(result.current.errorMessage).toContain("passphrase");
    expect(result.current.errorMessage).toContain("does not match");
  });
});
