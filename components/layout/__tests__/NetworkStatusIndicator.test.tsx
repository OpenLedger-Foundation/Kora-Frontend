import { render, screen } from "@testing-library/react";
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NetworkStatusIndicator } from "../NetworkStatusIndicator";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/hooks/useNetworkStatus", () => ({
  useNetworkStatus: () => ({
    health: {
      overall: "operational",
      soroban: { status: "operational", responseTime: 120, lastChecked: new Date() },
      horizon: { status: "operational", responseTime: 80, lastChecked: new Date() },
      network: "testnet",
    },
  }),
}));

vi.mock("@/lib/xdrDraftQueue", () => ({
  listQueuedXdrDrafts: vi.fn().mockResolvedValue([{ id: "draft-1" }, { id: "draft-2" }]),
  flushQueuedXdrDrafts: vi.fn(),
}));

describe("NetworkStatusIndicator", () => {
  it("renders network status indicator element", () => {
    render(<NetworkStatusIndicator />);
    expect(screen.getByTestId("network-status-indicator")).toBeInTheDocument();
  });
});
