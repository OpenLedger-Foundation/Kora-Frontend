/**
 * Offline Page Component Integration Tests (#255)
 */

import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import OfflinePage from "@/app/offline/page";

// Mock next-intl translations hook
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => {
    const translations: Record<string, string> = {
      title: "You are offline",
      subtitle: "Connect to the internet to access live market data and perform transactions.",
      availableOffline: "Available Offline",
      cachedListings: "Cached marketplace listings",
      cachedAssets: "Cached document previews",
      requiresConnection: "Requires Connection",
      walletSigning: "Wallet signing & transaction submission",
      invoiceCreation: "Invoice creation",
      liveData: "Live price & balance updates",
      browseCached: "Browse Cached Marketplace",
      reload: "Try Reconnecting",
    };
    return translations[key] || key;
  },
}));

describe("Offline Page Fallback (#255)", () => {
  it("renders offline error title and subtitle", () => {
    render(<OfflinePage />);
    expect(screen.getByText("You are offline")).toBeInTheDocument();
    expect(
      screen.getByText("Connect to the internet to access live market data and perform transactions.")
    ).toBeInTheDocument();
  });

  it("lists available offline features and online requirements", () => {
    render(<OfflinePage />);
    expect(screen.getByText("Available Offline")).toBeInTheDocument();
    expect(screen.getByText("Cached marketplace listings")).toBeInTheDocument();
    expect(screen.getByText("Requires Connection")).toBeInTheDocument();
    expect(screen.getByText("Wallet signing & transaction submission")).toBeInTheDocument();
  });

  it("provides link to browse cached marketplace", () => {
    render(<OfflinePage />);
    const link = screen.getByRole("link", { name: /Browse Cached Marketplace/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute("href", "/marketplace");
  });
});
