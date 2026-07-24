import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/lib/env", () => ({
  env: {
    NEXT_PUBLIC_STELLAR_NETWORK: "testnet",
    NEXT_PUBLIC_ENABLE_MOCK_DATA: false,
  },
}));

vi.mock("@/lib/stellar/client", () => ({
  getAccountBalances: vi.fn(),
  getUSDCBalance: vi.fn(),
}));

import { getAccountBalances, getUSDCBalance } from "@/lib/stellar/client";
import {
  useUsdcBalance,
  pollUsdcBalanceAfterMint,
  isTestnetUsdcFaucetEnabled,
  fetchUsdcBalance,
} from "@/hooks/useUsdcBalance";
import { env } from "@/lib/env";

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <QueryClientProvider client={client}>{children}</QueryClientProvider>
    );
  };
}

describe("useUsdcBalance / faucet helpers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (env as any).NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    (env as any).NEXT_PUBLIC_ENABLE_MOCK_DATA = false;
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("isTestnetUsdcFaucetEnabled is true only on testnet", () => {
    (env as any).NEXT_PUBLIC_STELLAR_NETWORK = "testnet";
    expect(isTestnetUsdcFaucetEnabled()).toBe(true);

    (env as any).NEXT_PUBLIC_STELLAR_NETWORK = "mainnet";
    expect(isTestnetUsdcFaucetEnabled()).toBe(false);

    (env as any).NEXT_PUBLIC_STELLAR_NETWORK = "futurenet";
    expect(isTestnetUsdcFaucetEnabled()).toBe(false);
  });

  it("fetches USDC balance for an address", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      xlm: "100",
      usdc: "250.5",
      otherAssets: [],
    } as any);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });
    const { result } = renderHook(
      () => useUsdcBalance("GTESTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX"),
      { wrapper: wrapper(client) },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(250.5);
  });

  it("pollUsdcBalanceAfterMint resolves when balance increases", async () => {
    vi.mocked(getUSDCBalance)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(0)
      .mockResolvedValueOnce(10_000);

    const balance = await pollUsdcBalanceAfterMint("GTEST", {
      previousBalance: 0,
      intervalMs: 10,
      timeoutMs: 500,
    });

    expect(balance).toBe(10_000);
    expect(getUSDCBalance).toHaveBeenCalled();
  });

  it("pollUsdcBalanceAfterMint returns latest balance on timeout", async () => {
    vi.mocked(getUSDCBalance).mockResolvedValue(42);

    const balance = await pollUsdcBalanceAfterMint("GTEST", {
      previousBalance: 42,
      intervalMs: 5,
      timeoutMs: 20,
    });

    expect(balance).toBe(42);
  });

  it("fetchUsdcBalance delegates to getUSDCBalance", async () => {
    vi.mocked(getUSDCBalance).mockResolvedValue(123);
    await expect(fetchUsdcBalance("GTEST")).resolves.toBe(123);
  });

  it("supports temporary refetchInterval while polling after mint", async () => {
    vi.mocked(getAccountBalances).mockResolvedValue({
      xlm: "1",
      usdc: "0",
      otherAssets: [],
    } as any);

    const client = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    const { result, rerender } = renderHook(
      ({ interval }: { interval: number | false }) =>
        useUsdcBalance("GTESTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX", {
          refetchInterval: interval,
        }),
      {
        wrapper: wrapper(client),
        initialProps: { interval: false as number | false },
      },
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toBe(0);

    await act(async () => {
      rerender({ interval: 100 });
    });

    expect(result.current.data).toBe(0);
  });
});
