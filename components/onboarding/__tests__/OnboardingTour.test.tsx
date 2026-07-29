import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import OnboardingTour, { TOUR_STORAGE_KEY } from "../OnboardingTour";
import { useSettingsStore, DEFAULT_TOUR_SETTINGS } from "@/store/settingsStore";
import { useFeatureFlag } from "@/lib/featureFlags";

// Mock next/navigation
vi.mock("next/navigation", () => ({
  usePathname: () => "/marketplace",
}));

// Mock next-intl
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, options?: Record<string, unknown>) => {
    if (key === "step") return `Step ${options?.current} of ${options?.total}`;
    if (key === "steps.findOpportunityTitle") return "Find the right opportunity";
    if (key === "steps.findOpportunityBody") return "Search by debtor, invoice number, or jurisdiction to narrow the marketplace.";
    if (key === "steps.reviewDetailsTitle") return "Review invoice details";
    if (key === "steps.reviewDetailsBody") return "Each card summarizes the amount, return, risk tier, funding progress, and maturity.";
    if (key === "steps.mintInvoiceTitle") return "Mint an invoice";
    if (key === "steps.mintInvoiceBody") return "Upload unpaid invoice details and mint a Soroban NFT to request financing.";
    if (key === "steps.smeDashboardTitle") return "SME Dashboard";
    if (key === "steps.smeDashboardBody") return "Track your minted invoices, funding progress, and upcoming repayments.";
    if (key === "personaInvestor") return "Investor";
    if (key === "personaSme") return "SME";
    if (key === "selectPersona") return "Select persona";
    if (key === "skipTour") return "Skip tour";
    if (key === "skipLabel") return "Skip onboarding tour";
    if (key === "back") return "Back";
    if (key === "next") return "Next";
    if (key === "finish") return "Finish";
    return key;
  },
}));

// Mock featureFlags
vi.mock("@/lib/featureFlags", () => ({
  useFeatureFlag: vi.fn(),
}));

describe("OnboardingTour Component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.removeItem(TOUR_STORAGE_KEY);
    useSettingsStore.setState({
      tour: { ...DEFAULT_TOUR_SETTINGS },
    });
    vi.mocked(useFeatureFlag).mockReturnValue(true);
  });

  it("does not render when onboarding-tour feature flag is disabled", () => {
    vi.mocked(useFeatureFlag).mockReturnValue(false);

    const { container } = render(<OnboardingTour />);
    expect(container.firstChild).toBeNull();
  });

  it("renders investor tour steps by default and allows persona switching", async () => {
    render(<OnboardingTour />);

    // Verify investor title is shown after delay
    expect(await screen.findByText("Find the right opportunity", {}, { timeout: 2000 })).toBeInTheDocument();

    // Switch persona to SME
    const smeTab = screen.getByRole("button", { name: "SME" });
    fireEvent.click(smeTab);

    // Verify SME title is shown
    expect(await screen.findByText("Mint an invoice")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.persona).toBe("sme");
  });

  it("navigates through steps using Next and Back buttons", async () => {
    render(<OnboardingTour />);

    expect(await screen.findByText("Find the right opportunity", {}, { timeout: 2000 })).toBeInTheDocument();

    // Click Next
    const nextBtn = screen.getByRole("button", { name: "Next" });
    fireEvent.click(nextBtn);

    expect(await screen.findByText("Review invoice details")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.stepIndex).toBe(1);

    // Click Back
    const backBtn = screen.getByRole("button", { name: "Back" });
    fireEvent.click(backBtn);

    expect(await screen.findByText("Find the right opportunity")).toBeInTheDocument();
    expect(useSettingsStore.getState().tour.stepIndex).toBe(0);
  });

  it("completes tour when skip tour is clicked", async () => {
    render(<OnboardingTour />);

    const skipBtn = await screen.findByRole("button", { name: "Skip tour" }, { timeout: 2000 });
    fireEvent.click(skipBtn);

    expect(useSettingsStore.getState().tour.completed).toBe(true);
    expect(localStorage.getItem(TOUR_STORAGE_KEY)).toBe("true");
  });
});
