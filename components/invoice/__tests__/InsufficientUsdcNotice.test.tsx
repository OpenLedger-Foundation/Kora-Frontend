/**
 * Insufficient USDC funding state (#1245).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

const { faucetEnabled } = vi.hoisted(() => ({
  faucetEnabled: vi.fn(() => false),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const messages: Record<string, string> = {
      title: "Insufficient USDC balance",
      description:
        "Your wallet has {available} USDC, but this investment needs {required}. Acquire USDC, then refresh your balance to continue.",
      acquire: "Acquire USDC",
    };
    return (key: string, values?: Record<string, string | number>) => {
      let out = messages[key] ?? key;
      for (const [k, v] of Object.entries(values ?? {})) {
        out = out.replace(`{${k}}`, String(v));
      }
      return out;
    };
  },
}));

vi.mock("@/hooks/useUsdcBalance", () => ({
  isTestnetUsdcFaucetEnabled: () => faucetEnabled(),
}));

vi.mock("@/lib/env", () => ({
  env: { NEXT_PUBLIC_USDC_ACQUIRE_URL: "https://example.com/bridge" },
}));

vi.mock("@/components/wallet/TestnetUsdcFaucet", () => ({
  TestnetUsdcFaucet: ({ compact }: { compact?: boolean }) => (
    <div data-testid="testnet-usdc-faucet" data-compact={String(compact)} />
  ),
}));

import { InsufficientUsdcNotice } from "@/components/invoice/InsufficientUsdcNotice";

describe("InsufficientUsdcNotice", () => {
  beforeEach(() => {
    faucetEnabled.mockReturnValue(false);
  });

  it("announces the shortfall with the available and required amounts", () => {
    render(<InsufficientUsdcNotice available={25} required={100} />);

    const alert = screen.getByRole("alert");
    expect(alert).toHaveTextContent("Insufficient USDC balance");
    expect(alert).toHaveTextContent("$25.00 USDC");
    expect(alert).toHaveTextContent("$100.00 USDC");
  });

  it("links to the configured acquisition page off testnet", () => {
    render(<InsufficientUsdcNotice available={0} required={100} />);

    expect(screen.getByRole("link", { name: /acquire usdc/i })).toHaveAttribute(
      "href",
      "https://example.com/bridge"
    );
    expect(screen.queryByTestId("testnet-usdc-faucet")).toBeNull();
  });

  it("offers the in-app faucet on testnet instead of an external link", () => {
    faucetEnabled.mockReturnValue(true);

    render(<InsufficientUsdcNotice available={0} required={100} />);

    const faucet = screen.getByTestId("testnet-usdc-faucet");
    expect(faucet).toHaveAttribute("data-compact", "true");
    expect(screen.queryByRole("link", { name: /acquire usdc/i })).toBeNull();
  });
});
