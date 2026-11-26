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
import { render, screen, act } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import React from "react";
import en from "@/messages/en.json";
import {
  FundingYieldCalculator,
  computeYield,
} from "@/components/invoice/FundingYieldCalculator";
import { formatCurrency, formatDate } from "@/lib/utils";

// ─── Helpers ──────────────────────────────────────────────────────────────────

type CalcProps = React.ComponentProps<typeof FundingYieldCalculator>;

function calcElement(props: Partial<CalcProps> = {}) {
  const defaults = {
    amountInput: "10000",
    apr: 24.5,
    daysToMaturity: 90,
    repaymentDate: "2025-05-01",
    currency: "USDC",
  };
  return (
    <NextIntlClientProvider locale="en" messages={en} timeZone="UTC">
      <FundingYieldCalculator {...defaults} {...props} />
    </NextIntlClientProvider>
  );
}

function renderCalc(props: Partial<CalcProps> = {}) {
  return render(calcElement(props));
}

// ─── Formula consistency ──────────────────────────────────────────────────────

describe("FundingYieldCalculator — formula consistency", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("matches InvoiceDetailClient formula: amount * (1 + (apr/100) * (days/365))", () => {
    const amount = 10_000;
    const apr = 24.5;
    const days = 90;
    const expectedReturn = amount * (1 + (apr / 100) * (days / 365));

    renderCalc({ amountInput: String(amount), apr, daysToMaturity: days });
    // Advance debounce timer
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("expected-return")).toHaveTextContent(
      formatCurrency(expectedReturn, "USDC")
    );
  });

  it("shows net yield = expectedReturn - amount", () => {
    const amount = 5_000;
    const apr = 18;
    const days = 60;
    const expectedReturn = amount * (1 + (apr / 100) * (days / 365));
    const netYield = expectedReturn - amount;

    renderCalc({ amountInput: String(amount), apr, daysToMaturity: days });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("net-yield")).toHaveTextContent(
      formatCurrency(netYield, "USDC")
    );
  });

  it("shows APR as annualised yield", () => {
    renderCalc({ apr: 15.75 });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("annualised-yield")).toHaveTextContent("15.75% APR");
  });

  it("shows repaymentDate as break-even date", () => {
    const repaymentDate = "2025-08-15";
    renderCalc({ repaymentDate });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("break-even-date")).toHaveTextContent(
      formatDate(repaymentDate)
    );
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

  it("does not render immediately when amountInput changes — waits for 300ms debounce", () => {
    const { rerender } = renderCalc({ amountInput: "5000" });
    act(() => vi.advanceTimersByTime(300));

    // Calculator is visible after first render + debounce
    expect(screen.getByTestId("funding-yield-calculator")).toBeInTheDocument();

    const firstReturnText = screen.getByTestId("expected-return").textContent;

    // Change amount without advancing time — should not yet update
    rerender(
      calcElement({
        amountInput: "20000",
      })
    );

    // Values should still reflect old debounced amount (5000), not 20000 yet
    expect(screen.getByTestId("expected-return").textContent).toBe(firstReturnText);

    // Now advance time — debounce fires and values update
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("expected-return").textContent).not.toBe(firstReturnText);
  });

  it("cancels pending debounce on rapid changes and only computes final value", () => {
    const { rerender } = renderCalc({ amountInput: "1000" });
    act(() => vi.advanceTimersByTime(300));

    // Rapid re-renders simulating fast typing
    rerender(calcElement({ amountInput: "1" }));
    act(() => vi.advanceTimersByTime(50));
    rerender(calcElement({ amountInput: "12" }));
    act(() => vi.advanceTimersByTime(50));
    rerender(calcElement({ amountInput: "123" }));
    act(() => vi.advanceTimersByTime(50));
    rerender(calcElement({ amountInput: "1234" }));

    // Only advance to just before final debounce fires (150ms total so far — not yet 300 from last change)
    act(() => vi.advanceTimersByTime(250)); // not enough

    // Now advance remaining time
    act(() => vi.advanceTimersByTime(300));

    const expectedReturn = 1234 * (1 + (24.5 / 100) * (90 / 365));
    expect(screen.getByTestId("expected-return")).toHaveTextContent(
      formatCurrency(expectedReturn, "USDC")
    );
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

  it("recalculates when apr prop changes between renders", () => {
    const amount = 10_000;
    const days = 90;

    const { rerender } = renderCalc({ amountInput: String(amount), apr: 10, daysToMaturity: days });
    act(() => vi.advanceTimersByTime(300));

    const apr10Return = amount * (1 + (10 / 100) * (days / 365));
    expect(screen.getByTestId("expected-return")).toHaveTextContent(
      formatCurrency(apr10Return, "USDC")
    );

    // APR changes (e.g. invoice was re-priced)
    rerender(calcElement({ amountInput: String(amount), apr: 25 }));
    act(() => vi.advanceTimersByTime(300));

    const apr25Return = amount * (1 + (25 / 100) * (days / 365));
    expect(screen.getByTestId("expected-return")).toHaveTextContent(
      formatCurrency(apr25Return, "USDC")
    );
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

// ─── Issue #1131 — guarded edge states ────────────────────────────────────────

describe("computeYield — malformed input guards", () => {
  it.each([
    ["NaN amount", Number.NaN, 12, 90],
    ["Infinity amount", Number.POSITIVE_INFINITY, 12, 90],
    ["NaN APR", 1_000, Number.NaN, 90],
    ["Infinity APR", 1_000, Number.POSITIVE_INFINITY, 90],
    ["NaN days", 1_000, 12, Number.NaN],
    ["Infinity days", 1_000, 12, Number.POSITIVE_INFINITY],
    ["negative APR", 1_000, -1, 90],
  ])("returns null for %s", (_label, amount, apr, days) => {
    expect(computeYield(amount, apr, days)).toBeNull();
  });

  it("treats zero APR as principal-only rather than a zero expected return", () => {
    expect(computeYield(1_000, 0, 90)).toEqual({
      expectedReturn: 1_000,
      netYield: 0,
    });
  });
});

describe("FundingYieldCalculator — edge copy", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows localized copy for a zero-APR invoice instead of misleading numbers", () => {
    renderCalc({ apr: 0 });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("yield-edge-message")).toHaveTextContent(/0% APR/i);
    expect(screen.queryByTestId("expected-return")).not.toBeInTheDocument();
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/i);
  });

  it("suppresses the projection when the amount exceeds the remaining cap", () => {
    renderCalc({ amountInput: "10000", remainingCapacity: 5_000 });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("yield-edge-message")).toHaveTextContent(
      /remaining funding cap/i
    );
    expect(screen.queryByTestId("net-yield")).not.toBeInTheDocument();
  });

  it("shows localized copy when the oracle price is missing", () => {
    renderCalc({ oraclePrice: null });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("yield-edge-message")).toHaveTextContent(
      /oracle price is missing/i
    );
    // The native-currency projection is still valid; only the USD estimate is withheld.
    expect(screen.getByTestId("expected-return")).toBeInTheDocument();
    expect(screen.queryByTestId("yield-usd-estimate")).not.toBeInTheDocument();
  });

  it("renders a USD estimate when a valid oracle price is supplied", () => {
    renderCalc({ oraclePrice: 1.5 });
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("yield-usd-estimate")).toBeInTheDocument();
    expect(screen.queryByTestId("yield-edge-message")).not.toBeInTheDocument();
  });

  it.each([
    ["NaN APR", { apr: Number.NaN }],
    ["Infinity days", { daysToMaturity: Number.POSITIVE_INFINITY }],
  ])("shows invalid-data copy for %s", (_label, props) => {
    renderCalc(props);
    act(() => vi.advanceTimersByTime(300));

    expect(screen.getByTestId("yield-edge-message")).toHaveTextContent(
      /funding data is invalid/i
    );
    expect(document.body.textContent).not.toMatch(/NaN|Infinity/i);
  });
});
