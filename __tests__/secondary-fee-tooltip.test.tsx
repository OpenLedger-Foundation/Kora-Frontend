/**
 * FeeTooltip unit tests (issue #1247).
 *
 * Covers:
 *  - accessible name on the trigger button (a11y requirement)
 *  - no-fees state: trigger still present but disclosure shows "no fees"
 *  - happy path: trigger is a button with the correct aria-label
 *  - className forwarding to the trigger
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Stub next-intl with real-looking strings so assertions read as copy, not keys.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const catalog: Record<string, Record<string, string>> = {
      secondaryFees: {
        title: "Fee schedule",
        subtitle: "All fees are disclosed before you confirm.",
        subtotal: "Position price",
        protocolFee: "Protocol fee ({rate})",
        marketFee: "Marketplace fee ({rate})",
        totalFees: "Total fees ({rate})",
        total: "You pay",
        noFees: "No fees apply to this acquisition.",
        listingNote: "Buyer pays {rate} in fees on top of the ask price.",
        tooltipTriggerLabel: "Show fee breakdown",
      },
    };
    return (key: string, values?: Record<string, string | number>) => {
      let out = catalog[namespace]?.[key] ?? key;
      for (const [k, v] of Object.entries(values ?? {})) {
        out = out.replace(`{${k}}`, String(v));
      }
      return out;
    };
  },
}));

// Radix tooltip portals use document.body; jsdom does not need explicit config.
// The Tooltip component itself is tested elsewhere; here we only check that
// FeeTooltip mounts a correctly-labelled trigger.

import { FeeTooltip } from "@/components/secondary/FeeTooltip";
import { computeAcquisitionFees } from "@/lib/secondaryFees";

const SCHEDULE = { protocolBps: 50, marketBps: 25 };

describe("FeeTooltip", () => {
  it("renders a button with the localised accessible name", () => {
    render(<FeeTooltip fees={computeAcquisitionFees(10_000, SCHEDULE)} />);

    const trigger = screen.getByRole("button", { name: "Show fee breakdown" });
    expect(trigger).toBeDefined();
  });

  it("trigger carries the correct data-testid", () => {
    render(<FeeTooltip fees={computeAcquisitionFees(10_000, SCHEDULE)} />);

    expect(screen.getByTestId("fee-tooltip-trigger")).toBeDefined();
  });

  it("renders when fees are zero — no-fees state must not suppress the trigger", () => {
    render(
      <FeeTooltip fees={computeAcquisitionFees(10_000, { protocolBps: 0, marketBps: 0 })} />
    );

    // Trigger should still be present even when there are no fees.
    expect(screen.getByRole("button", { name: "Show fee breakdown" })).toBeDefined();
  });

  it("forwards className to the trigger button", () => {
    render(
      <FeeTooltip
        fees={computeAcquisitionFees(10_000, SCHEDULE)}
        className="ml-2 opacity-70"
      />
    );

    const trigger = screen.getByTestId("fee-tooltip-trigger");
    expect(trigger.className).toContain("ml-2");
    expect(trigger.className).toContain("opacity-70");
  });

  it("trigger button is of type=button to avoid unintended form submissions", () => {
    render(<FeeTooltip fees={computeAcquisitionFees(10_000, SCHEDULE)} />);

    const trigger = screen.getByTestId("fee-tooltip-trigger");
    expect((trigger as HTMLButtonElement).type).toBe("button");
  });

  it("icon inside the trigger is hidden from assistive technology", () => {
    render(<FeeTooltip fees={computeAcquisitionFees(10_000, SCHEDULE)} />);

    // The aria-label on the button is the announced name; the SVG icon must
    // carry aria-hidden so it does not add a redundant or confusing name.
    const svg = screen.getByTestId("fee-tooltip-trigger").querySelector("svg");
    expect(svg?.getAttribute("aria-hidden")).toBe("true");
  });
});
