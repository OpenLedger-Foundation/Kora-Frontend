/**
 * Invoice print redaction rules — Issue #1182.
 */
import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import {
  containsStellarAddress,
  getPrintDebtorAddress,
  getPrintDebtorName,
  getPrintDebtorPrivacy,
  redactStellarAddresses,
} from "@/lib/debtorPrivacy";
import { DebtorDisplay } from "@/components/invoice/DebtorDisplay";
import type { Invoice, DebtorPrivacyLevel } from "@/types/invoice";

const STREET = "12 Ngong Road, Nairobi";

function invoice(debtorPrivacy: DebtorPrivacyLevel): Partial<Invoice> {
  return {
    debtorPrivacy,
    metadata: {
      debtorName: "Acme Kenya Ltd",
      debtorAddress: STREET,
      category: "technology",
      jurisdiction: "KE",
    } as Invoice["metadata"],
  } as Partial<Invoice>;
}

describe("print privacy level", () => {
  it("never prints at 'full', even for full-disclosure invoices", () => {
    expect(getPrintDebtorPrivacy(invoice("full"))).toBe("partial");
    expect(getPrintDebtorPrivacy(invoice("partial"))).toBe("partial");
    expect(getPrintDebtorPrivacy(invoice("anonymized"))).toBe("anonymized");
  });

  it("never includes a street address", () => {
    for (const level of ["full", "partial", "anonymized"] as const) {
      expect(getPrintDebtorAddress(invoice(level))).not.toContain(STREET);
    }
    expect(getPrintDebtorAddress(invoice("full"))).toBe("Address hidden · Kenya");
  });

  it("keeps anonymized debtors anonymous on paper", () => {
    expect(getPrintDebtorName(invoice("anonymized"))).toBe("Technology Company (Kenya)");
    expect(getPrintDebtorName(invoice("partial"))).toBe("Acme Kenya Ltd");
  });

  it("defaults safely when privacy or metadata is missing", () => {
    expect(getPrintDebtorPrivacy({})).toBe("anonymized");
    expect(getPrintDebtorAddress({})).toBe("");
  });
});

describe("DebtorDisplay print twin", () => {
  it("renders a redacted print-only block alongside the post-funding full reveal", () => {
    render(<DebtorDisplay invoice={invoice("full")} isFunded variant="detail" />);
    // On screen (funded) the full address is shown, inside the print-redacted wrapper.
    const screenAddress = screen.getByText(STREET);
    expect(screenAddress.closest("[data-print-redact]")).not.toBeNull();
    // The print-only twin carries no street address.
    const printBlock = screen.getByTestId("debtor-print-details");
    expect(printBlock).toHaveAttribute("data-print-only");
    expect(printBlock.textContent).not.toContain(STREET);
  });
});

describe("redactStellarAddresses", () => {
  const ADDRESS = "GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF";
  it("truncates every address in free text", () => {
    expect(redactStellarAddresses(`from ${ADDRESS} to ${ADDRESS}`)).toBe("from GAAA…AWHF to GAAA…AWHF");
    expect(containsStellarAddress(ADDRESS)).toBe(true);
    expect(containsStellarAddress("GAAA…AWHF")).toBe(false);
  });

  it("leaves text without addresses unchanged", () => {
    expect(redactStellarAddresses("INV-001")).toBe("INV-001");
    expect(redactStellarAddresses("")).toBe("");
  });
});
