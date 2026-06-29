/**
 * Tests for FundingYieldCalculator integration in the invoice detail page.
 *
 * Covers:
 *  a) Formula consistency with APRDisplay / InvoiceDetailClient
 *  b) Debounced updates (300 ms)
 *  c) Stale-value safety when apr changes between renders
 *  d) Correct display of expected return, annualised yield, break-even date
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { FundingYieldCalculator } from "@/components/invoice/FundingYieldCalculator";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function renderCalc(props: Partial<React.ComponentProps<typeof FundingYieldCalculator>> = {}) {
  const defaults = {
    amountInput: "10000",
    apr: 24.5,
    daysToMaturity: 90,
    repaymentDate: "2025-05-01",
    currency: "USDC",
  };
  return render(<FundingYieldCalculator {...defaults} {...props} />);
}

// ─── Formula consistency ──────────────────────────────────────────────────────

describe("FundingYieldCalculator — formula consistency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches InvoiceDetailClient formula: amount * (1 + (apr/100) * (days/365))", async () => {
    const amount = 10_000;
    const apr = 24.5;
    const days = 90;
    const expectedReturn = amount * (1 + (apr / 100) * (days / 365));

    renderCalc({ amountInput: String(amount), apr, daysToMaturity: days });
    // Advance debounce timer
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => {
      expect(screen.getByTestId("expected-return")).toHaveTextContent(
        formatCurrency(expectedReturn, "USDC")
      );
    });
  });

  it("shows net yield = expectedReturn - amount", async () => {
    const amount = 5_000;
    const apr = 18;
    const days = 60;
    const expectedReturn = amount * (1 + (apr / 100) * (days / 365));
    const netYield = expectedReturn - amount;

    renderCalc({ amountInput: String(amount), apr, daysToMaturity: days });
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => {
      expect(screen.getByTestId("net-yield")).toHaveTextContent(
        formatCurrency(netYield, "USDC")
      );
    });
  });

  it("shows APR as annualised yield", async () => {
    renderCalc({ apr: 15.75 });
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => {
      expect(screen.getByTestId("annualised-yield")).toHaveTextContent("15.75% APR");
    });
  });

  it("shows repaymentDate as break-even date", async () => {
    const repaymentDate = "2025-08-15";
    renderCalc({ repaymentDate });
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => {
      expect(screen.getByTestId("break-even-date")).toHaveTextContent(
        formatDate(repaymentDate)
      );
    });
  });
});

// ─── Debounce behaviour ───────────────────────────────────────────────────────

describe("FundingYieldCalculator — debounce (300ms)", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not render immediately when amountInput changes — waits for 300ms debounce", async () => {
    const { rerender } = renderCalc({ amountInput: "5000" });
    act(() => vi.advanceTimersByTime(300));

    // Calculator is visible after first render + debounce
    await waitFor(() => {
      expect(screen.getByTestId("funding-yield-calculator")).toBeInTheDocument();
    });

    const firstReturnText = screen.getByTestId("expected-return").textContent;

    // Change amount without advancing time — should not yet update
    rerender(
      <FundingYieldCalculator
        amountInput="20000"
        apr={24.5}
        daysToMaturity={90}
        repaymentDate="2025-05-01"
        currency="USDC"
      />
    );

    // Values should still reflect old debounced amount (5000), not 20000 yet
    expect(screen.getByTestId("expected-return").textContent).toBe(firstReturnText);

    // Now advance time — debounce fires and values update
    act(() => vi.advanceTimersByTime(300));

    await waitFor(() => {
      expect(screen.getByTestId("expected-return").textContent).not.toBe(firstReturnText);
    });
  });

  it("cancels pending debounce on rapid changes and only computes final value", async () => {
    const { rerender } = renderCalc({ amountInput: "1000" });
    act(() => vi.advanceTimersByTime(300));

    // Rapid re-renders simulating fast typing
    rerender(
      <FundingYieldCalculator amountInput="1" apr={24.5} daysToMaturity={90} repaymentDate="2025-05-01" currency="USDC" />
    );
    act(() => vi.advanceTimersByTime(50));
    rerender(
      <FundingYieldCalculator amountInput="12" apr={24.5} daysToMaturity={90} repaymentDate="2025-05-01" currency="USDC" />
    );
    act(() => vi.advanceTimersByTime(50));
    rerender(
      <FundingYieldCalculator amountInput="123" apr={24.5} daysToMaturity={90} repaymentDate="2025-05-01" currency="USDC" />
    );
    act(() => vi.advanceTimersByTime(50));
    rerender(
      <FundingYieldCalculator amountInput="1234" apr={24.5} daysToMaturity={90} repaymentDate="2025-05-01" currency="USDC" />
    );

    // Only advance to just before final debounce fires (150ms total so far — not yet 300 from last change)
    act(() => vi.advanceTimersByTime(250)); // not enough

    // Now advance remaining time
    act(() => vi.advanceTimersByTime(300));

    const expectedReturn = 1234 * (1 + (24.5 / 100) * (90 / 365));
    await waitFor(() => {
      expect(screen.getByTestId("expected-return")).toHaveTextContent(
        formatCurrency(expectedReturn, "USDC")
      );
    });
  });
});

// ─── Stale-value safety ───────────────────────────────────────────────────────

describe("FundingYieldCalculator — stale-proof APR updates", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("recalculates when apr prop changes between renders", async () => {
    const amount = 10_000;
    const days = 90;

    const { rerender } = renderCalc({ amountInput: String(amount), apr: 10, daysToMaturity: days });
    act(() => vi.advanceTimersByTime(300));

    const apr10Return = amount * (1 + (10 / 100) * (days / 365));
    await waitFor(() => {
      expect(screen.getByTestId("expected-return")).toHaveTextContent(
        formatCurrency(apr10Return, "USDC")
      );
    });

    // APR changes (e.g. invoice was re-priced)
    rerender(
      <FundingYieldCalculator amountInput={String(amount)} apr={25} daysToMaturity={days} repaymentDate="2025-05-01" currency="USDC" />
    );
    act(() => vi.advanceTimersByTime(300));

    const apr25Return = amount * (1 + (25 / 100) * (days / 365));
    await waitFor(() => {
      expect(screen.getByTestId("expected-return")).toHaveTextContent(
        formatCurrency(apr25Return, "USDC")
      );
    });
    // Ensure stale value is gone
    expect(screen.getByTestId("expected-return").textContent).not.toBe(
      formatCurrency(apr10Return, "USDC")
    );
  });
});

// ─── Edge cases ───────────────────────────────────────────────────────────────

describe("FundingYieldCalculator — edge cases", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns null (renders nothing) when amountInput is empty", () => {
    const { container } = renderCalc({ amountInput: "" });
    act(() => vi.advanceTimersByTime(300));
    // Component returns null → nothing rendered
    expect(container.firstChild).toBeNull();
  });

  it("returns null when amountInput is zero", () => {
    const { container } = renderCalc({ amountInput: "0" });
    act(() => vi.advanceTimersByTime(300));
    expect(container.firstChild).toBeNull();
  });

  it("returns null when amountInput is a negative number", () => {
    const { container } = renderCalc({ amountInput: "-100" });
    act(() => vi.advanceTimersByTime(300));
    expect(container.firstChild).toBeNull();
  });

  it("handles non-numeric input gracefully (shows nothing)", () => {
    const { container } = renderCalc({ amountInput: "abc" });
    act(() => vi.advanceTimersByTime(300));
    expect(container.firstChild).toBeNull();
  });
});
