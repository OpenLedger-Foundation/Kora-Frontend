import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";

const mintTestnetUsdc = vi.fn();
const refreshBalance = vi.fn();
const invalidate = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useWallet", () => ({
  useWallet: () => ({
    address: "GTESTADDRESSXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX",
    mintTestnetUsdc,
    refreshBalance,
  }),
}));

vi.mock("@/hooks/useToast", () => ({
  useToast: () => ({
    loading: vi.fn(),
    success: vi.fn(),
    error: vi.fn(),
  }),
}));

vi.mock("@/hooks/useUsdcBalance", async () => {
  const actual = await vi.importActual<typeof import("@/hooks/useUsdcBalance")>(
    "@/hooks/useUsdcBalance",
  );
  return {
    ...actual,
    isTestnetUsdcFaucetEnabled: vi.fn(() => true),
    useUsdcBalance: () => ({
      data: 0,
      invalidate,
      refetch: vi.fn(),
      isLoading: false,
      isSuccess: true,
    }),
  };
});

import { TestnetUsdcFaucet } from "@/components/wallet/TestnetUsdcFaucet";
import { isTestnetUsdcFaucetEnabled } from "@/hooks/useUsdcBalance";

describe("TestnetUsdcFaucet", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(isTestnetUsdcFaucetEnabled).mockReturnValue(true);
    mintTestnetUsdc.mockResolvedValue(10_000);
    refreshBalance.mockResolvedValue(undefined);
    invalidate.mockResolvedValue(undefined);
  });

  it("renders nothing when faucet is disabled (mainnet)", () => {
    vi.mocked(isTestnetUsdcFaucetEnabled).mockReturnValue(false);
    const { container } = render(<TestnetUsdcFaucet compact />);
    expect(container).toBeEmptyDOMElement();
  });

  it("shows one-click mint CTA on testnet", () => {
    render(<TestnetUsdcFaucet compact />);
    expect(screen.getByTestId("testnet-usdc-faucet")).toBeInTheDocument();
    expect(
      screen.getByTestId("testnet-usdc-faucet-button"),
    ).toBeInTheDocument();
  });

  it("mints USDC and notifies on success", async () => {
    const onSuccess = vi.fn();
    const user = userEvent.setup();
    render(<TestnetUsdcFaucet compact onSuccess={onSuccess} />);

    await user.click(screen.getByTestId("testnet-usdc-faucet-button"));

    await waitFor(() => {
      expect(mintTestnetUsdc).toHaveBeenCalledTimes(1);
      expect(onSuccess).toHaveBeenCalledWith(10_000);
      expect(invalidate).toHaveBeenCalled();
      expect(refreshBalance).toHaveBeenCalled();
    });
  });
});
