import { describe, it, expect, beforeEach } from "vitest";
import { useInvoiceStore } from "../store/invoiceStore";

function resetStore() {
  useInvoiceStore.setState({ comparisonList: [] });
}

describe("invoiceStore — comparison list", () => {
  beforeEach(resetStore);

  it("toggles an invoice into the comparison list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).toContain("inv_001");
  });

  it("removes an invoice already in the list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).not.toContain("inv_001");
  });

  it("allows up to 3 invoices", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().toggleComparison("inv_003");
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(3);
  });

  it("replaces the oldest when a 4th is added", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().toggleComparison("inv_003");
    useInvoiceStore.getState().toggleComparison("inv_004");
    const list = useInvoiceStore.getState().comparisonList;
    expect(list).toHaveLength(3);
    expect(list).not.toContain("inv_001"); // oldest replaced
    expect(list).toContain("inv_004");
  });

  it("removeFromComparison removes a single invoice", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().toggleComparison("inv_002");
    useInvoiceStore.getState().removeFromComparison("inv_001");
    expect(useInvoiceStore.getState().comparisonList).not.toContain("inv_001");
    expect(useInvoiceStore.getState().comparisonList).toContain("inv_002");
  });

  it("clearComparison empties the list", () => {
    useInvoiceStore.getState().toggleComparison("inv_001");
    useInvoiceStore.getState().clearComparison();
    expect(useInvoiceStore.getState().comparisonList).toHaveLength(0);
  });
});
