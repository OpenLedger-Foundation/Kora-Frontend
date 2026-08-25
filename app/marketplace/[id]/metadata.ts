/**
 * Invoice detail page metadata — server-side SEO with IPFS hydration.
 *
 * Used by `page.tsx` via `generateMetadata`. Fetches the invoice (mock or live),
 * optionally hydrates from IPFS metadata, and emits privacy-safe OG / Twitter tags.
 *
 * Closes #375
 */

import type { Metadata } from "next";
import { fetchInvoiceById } from "@/services/invoiceService";
import { validateRouteId } from "@/lib/security";
import {
  buildInvoicePageMetadata,
  buildPublicInvoiceSeo,
  fetchIpfsMetadataForSeo,
} from "@/lib/invoiceSeo";

/** ISR: revalidate invoice SEO every hour so OG tags stay fresh. */
export const revalidate = 3600;

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const safeId = validateRouteId(id);

  if (!safeId) {
    return {
      title: "Invalid Invoice | Kora Protocol",
      robots: { index: false, follow: false },
    };
  }

  try {
    const invoice = await fetchInvoiceById(safeId);
    if (!invoice) {
      return {
        title: "Invoice Not Found | Kora Protocol",
        robots: { index: false, follow: false },
      };
    }

    const ipfsMeta = await fetchIpfsMetadataForSeo(invoice.ipfsCid);
    const seo = buildPublicInvoiceSeo(invoice, ipfsMeta);
    return buildInvoicePageMetadata(seo);
  } catch {
    return {
      title: "Invoice Details | Kora Protocol",
      robots: { index: true, follow: true },
    };
  }
}
