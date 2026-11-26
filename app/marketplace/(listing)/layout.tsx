import type { ReactNode } from "react";
import { MOCK_INVOICES } from "@/services/mockData";
import { fetchInvoices } from "@/services/invoiceService";
import { buildInvoiceListingSeo } from "@/lib/invoiceSeo";
import { invoiceListingSchema, serializeSchema } from "@/lib/structuredData";

/** Keep the JSON-LD payload bounded so a large marketplace stays crawlable. */
const SEO_LISTING_SIZE = 12;

async function loadPublicListings() {
  if (process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA !== "false") {
    return MOCK_INVOICES.slice(0, SEO_LISTING_SIZE);
  }

  try {
    const page = await fetchInvoices(undefined, undefined, 1, SEO_LISTING_SIZE);
    return page.data ?? [];
  } catch {
    return [];
  }
}

/**
 * Server-rendered structured data for the public marketplace listing (#1230).
 *
 * Scoped to the `(listing)` route group so invoice detail pages keep their own
 * FinancialProduct + BreadcrumbList JSON-LD and never receive a CollectionPage
 * for the whole marketplace.
 */
export default async function MarketplaceListingLayout({
  children,
}: {
  children: ReactNode;
}) {
  let listingLd: string | null = null;

  try {
    const items = buildInvoiceListingSeo(await loadPublicListings());
    if (items.length > 0) {
      listingLd = serializeSchema(invoiceListingSchema(items));
    }
  } catch {
    // Structured data is best-effort; the listing itself still renders.
  }

  return (
    <>
      {listingLd ? (
        <script
          id="ld-marketplace-listing"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: listingLd }}
        />
      ) : null}
      {children}
    </>
  );
}
