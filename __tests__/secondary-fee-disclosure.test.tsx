/**
 * Fee disclosure rendering (issue #597).
 *
 * The component must not do arithmetic of its own — every figure it shows comes
 * from `computeAcquisitionFees`. These assert what a buyer actually reads.
 */

import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// next-intl needs a provider; substituting the real catalog keeps the assertions
// about user-visible copy rather than about translation keys.
vi.mock("next-intl", () => ({
  useTranslations: (namespace: string) => {
    const messages: Record<string, Record<string, string>> = {
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
      },
    };
    return (key: string, values?: Record<string, string | number>) => {
      let out = messages[namespace]?.[key] ?? key;
      for (const [k, v] of Object.entries(values ?? {})) {
        out = out.replace(`{${k}}`, String(v));
      }
      return out;
    };
  },
}));

import { FeeDisclosure } from "@/components/secondary/FeeDisclosure";
import { computeAcquisitionFees } from "@/lib/secondaryFees";

const SCHEDULE = { protocolBps: 50, marketBps: 25 };

describe("FeeDisclosure", () => {
  it("shows each fee line and the total the buyer pays", () => {
    render(<FeeDisclosure fees={computeAcquisitionFees(10_000, SCHEDULE)} />);

    expect(screen.getByText("Position price")).toBeDefined();
    expect(screen.getByText("Protocol fee (0.5%)")).toBeDefined();
    expect(screen.getByText("Marketplace fee (0.25%)")).toBeDefined();
    expect(screen.getByText("You pay")).toBeDefined();
  });

  it("shows a total that equals price plus fees", () => {
    const fees = computeAcquisitionFees(10_000, SCHEDULE);
    render(<FeeDisclosure fees={fees} />);

    // 10,000 + 50 + 25
    expect(screen.getByTestId("fee-total").textContent).toContain("10,075");
  });

  it("states plainly when no fees apply rather than rendering an empty table", () => {
    render(
      <FeeDisclosure
        fees={computeAcquisitionFees(10_000, { protocolBps: 0, marketBps: 0 })}
      />
    );

    expect(screen.getByTestId("fee-disclosure-none")).toBeDefined();
    expect(screen.queryByTestId("fee-disclosure")).toBeNull();
  });

  it("omits a fee line whose rate is zero", () => {
    render(
      <FeeDisclosure
        fees={computeAcquisitionFees(10_000, { protocolBps: 50, marketBps: 0 })}
      />
    );

    expect(screen.getByText("Protocol fee (0.5%)")).toBeDefined();
    expect(screen.queryByText(/Marketplace fee/)).toBeNull();
  });

  it("renders a one-line summary in the inline variant", () => {
    render(
      <FeeDisclosure
        variant="inline"
        fees={computeAcquisitionFees(10_000, SCHEDULE)}
      />
    );

    expect(screen.getByTestId("fee-disclosure-inline").textContent).toContain("0.75%");
  });
});
