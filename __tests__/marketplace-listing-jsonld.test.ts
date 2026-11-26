/**
 * JSON-LD structured data for public invoice listings (#1230).
 */

import { describe, it, expect, beforeAll } from "vitest";
import { MOCK_INVOICES } from "@/services/mockData";
import { buildInvoiceListingSeo } from "@/lib/invoiceSeo";
import {
  invoiceListingSchema,
  invoiceFinancialProductSchema,
  serializeSchema,
} from "@/lib/structuredData";

beforeAll(() => {
  process.env.NEXT_PUBLIC_APP_URL = "https://kora.finance";
});

const PUBLIC_STATUSES = new Set([
  "listed",
  "partially_funded",
  "fully_funded",
  "active",
  "repaid",
]);

describe("buildInvoiceListingSeo", () => {
  it("only includes publicly listable statuses", () => {
    const items = buildInvoiceListingSeo(MOCK_INVOICES);
    expect(items.length).toBeGreaterThan(0);
    for (const invoice of MOCK_INVOICES) {
      if (!PUBLIC_STATUSES.has(invoice.status)) {
        expect(items.some((item) => item.id === String(invoice.tokenId || invoice.id))).toBe(
          false
        );
      }
    }
  });

  it("reuses privacy-safe debtor labels for anonymized invoices", () => {
    const source = MOCK_INVOICES.find((i) => i.debtorPrivacy === "anonymized");
    expect(source).toBeDefined();
    const items = buildInvoiceListingSeo([source!]);
    expect(items).toHaveLength(1);
    expect(items[0].debtorLabel).not.toBe(source!.metadata.debtorName);
    expect(items[0].debtorLabel).toMatch(/,/);
  });

  it("never emits addresses or private debtor names", () => {
    const source = MOCK_INVOICES[0];
    const items = buildInvoiceListingSeo([source]);
    const blob = JSON.stringify(items);
    expect(blob).not.toContain(source.metadata.debtorAddress);
    expect(blob).not.toContain(source.metadata.issuerAddress);
    expect(blob).not.toContain(source.ownerAddress);
  });
});

describe("invoiceListingSchema", () => {
  it("emits a CollectionPage containing a numbered ItemList", () => {
    const items = buildInvoiceListingSeo(MOCK_INVOICES.slice(0, 3));
    const schema = invoiceListingSchema(items);

    expect(schema["@context"]).toBe("https://schema.org");
    expect(schema["@type"]).toBe("CollectionPage");
    expect(schema.url).toBe("https://kora.finance/marketplace");
    expect(schema.mainEntity["@type"]).toBe("ItemList");
    expect(schema.mainEntity.numberOfItems).toBe(items.length);
    expect(schema.mainEntity.itemListElement).toHaveLength(items.length);

    schema.mainEntity.itemListElement.forEach((entry, index) => {
      expect(entry.position).toBe(index + 1);
      expect(entry.url).toBe(`https://kora.finance/marketplace/${items[index].id}`);
      expect(entry.item["@type"]).toBe("FinancialProduct");
    });
  });

  it("matches the detail-page FinancialProduct shape", () => {
    const item = buildInvoiceListingSeo(MOCK_INVOICES.slice(0, 1))[0];
    const schema = invoiceListingSchema([item]);
    const listed = schema.mainEntity.itemListElement[0].item;
    const detail = invoiceFinancialProductSchema({
      id: item.id,
      invoiceNumber: item.invoiceNumber,
      debtorName: item.debtorLabel,
      amount: item.amount,
      currency: item.currency,
      apr: item.apr,
      dueDate: item.dueDate,
      jurisdiction: item.jurisdiction,
      category: item.category,
      riskTier: item.riskTier,
    });

    expect(listed).toEqual(detail);
  });

  it("serializes safely for inline script injection", () => {
    const item = buildInvoiceListingSeo(MOCK_INVOICES.slice(0, 1))[0];
    const injected = serializeSchema(
      invoiceListingSchema([
        {
          ...item,
          debtorLabel: `</script><script>alert('x')</script>`,
        },
      ])
    );

    expect(injected).not.toContain("</script>");
    expect(injected).toContain("\\u003c/script\\u003e");
    expect(() => JSON.parse(injected)).not.toThrow();
  });
});
