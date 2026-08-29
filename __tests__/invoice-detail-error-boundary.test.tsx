/**
 * Error Boundary Integration Tests for Invoice Detail Page / Components
 * Issue #250
 *
 * Tests:
 * 1. Smart contract call throwing error (classified as "contract")
 * 2. IPFS / network fetch failing (classified as "network")
 * 3. Malformed invoice data runtime error (classified as "unexpected")
 * 4. Error logging verification (console.error mock)
 * 5. Recovery action ("Try again" re-mounts children and clears error state)
 */

import React, { useState } from "react";
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ErrorBoundary } from "@/components/ui/error-boundary";

// Component that throws a contract call error
const ContractErrorComponent = () => {
  throw new Error("Soroban contract invocation failed: simulation error XDR");
};

// Component that throws an IPFS/network fetch error
const IpfsFetchErrorComponent = () => {
  throw new Error("Failed to fetch IPFS document metadata from gateway");
};

// Component that throws a malformed data error
const MalformedInvoiceComponent = () => {
  const malformedInvoice: any = null;
  // Accessing property on null throws TypeError (malformed data)
  return <div>{malformedInvoice.metadata.debtorName}</div>;
};

// State-switchable component to test recovery via "Try Again"
const RecoverableInvoiceComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) {
    throw new Error("Soroban contract transaction failed");
  }
  return <div data-testid="invoice-detail-success">Invoice Details Loaded Successfully</div>;
};

describe("Invoice Detail Error Boundary Tests (#250)", () => {
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    // Suppress console.error during expected throw tests, but track calls
    consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("catches contract call throwing error and displays contract error UI", () => {
    render(
      <ErrorBoundary>
        <ContractErrorComponent />
      </ErrorBoundary>
    );

    // Verify error is logged via console.error and not swallowed
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessage = consoleErrorSpy.mock.calls.flat().join(" ");
    expect(loggedMessage).toContain("[ErrorBoundary]");
    expect(loggedMessage).toContain("Soroban contract invocation failed");

    // Verify Error Boundary renders contract error UI
    expect(screen.getByText("Contract error")).toBeInTheDocument();
    expect(screen.getByText(/A smart contract call failed/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("catches IPFS fetch failing error and displays network connection error UI", () => {
    render(
      <ErrorBoundary>
        <IpfsFetchErrorComponent />
      </ErrorBoundary>
    );

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessage = consoleErrorSpy.mock.calls.flat().join(" ");
    expect(loggedMessage).toContain("[ErrorBoundary]");
    expect(loggedMessage).toContain("Failed to fetch IPFS document metadata");

    // Verify Error Boundary renders connection error UI
    expect(screen.getByText("Connection error")).toBeInTheDocument();
    expect(screen.getByText(/Unable to reach the network/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("catches malformed invoice data runtime error and displays unexpected error UI", () => {
    render(
      <ErrorBoundary>
        <MalformedInvoiceComponent />
      </ErrorBoundary>
    );

    // Verify error was logged
    expect(consoleErrorSpy).toHaveBeenCalled();
    const loggedMessage = consoleErrorSpy.mock.calls.flat().join(" ");
    expect(loggedMessage).toContain("[ErrorBoundary]");

    // Verify Error Boundary renders generic/unexpected error UI
    expect(screen.getByText("Something went wrong")).toBeInTheDocument();
    expect(screen.getByText(/An unexpected error occurred/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Try Again/i })).toBeInTheDocument();
  });

  it("re-mounts the component and clears error state on clicking 'Try again'", async () => {
    const user = userEvent.setup();

    // Test wrapper controlling shouldThrow state
    const TestWrapper = () => {
      const [shouldThrow, setShouldThrow] = useState(true);

      return (
        <div>
          <button data-testid="fix-error-btn" onClick={() => setShouldThrow(false)}>
            Fix Error
          </button>
          <ErrorBoundary>
            <RecoverableInvoiceComponent shouldThrow={shouldThrow} />
          </ErrorBoundary>
        </div>
      );
    };

    render(<TestWrapper />);

    // Initially in error state
    expect(screen.getByText("Contract error")).toBeInTheDocument();
    const tryAgainButton = screen.getByRole("button", { name: /Try Again/i });
    expect(tryAgainButton).toBeInTheDocument();

    // Simulate fixing the underlying data error before clicking Try Again
    await user.click(screen.getByTestId("fix-error-btn"));

    // Click "Try Again" button on Error Boundary UI
    await user.click(tryAgainButton);

    // Verify error state cleared and child component successfully re-rendered
    await waitFor(() => {
      expect(screen.getByTestId("invoice-detail-success")).toBeInTheDocument();
    });
    expect(screen.queryByText("Contract error")).not.toBeInTheDocument();
  });
});
