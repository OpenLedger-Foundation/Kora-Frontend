import { fetchInvoiceById } from "@/services/invoiceService";
import { validateRouteId } from "@/lib/security";
import { notFound } from "next/navigation";
import InvoiceDetailClient from "./InvoiceDetailClient";
import {
  invoiceFinancialProductSchema,
  breadcrumbSchema,
  serializeSchema,
} from "@/lib/structuredData";
import {
  buildPublicInvoiceSeo,
  fetchIpfsMetadataForSeo,
} from "@/lib/invoiceSeo";

export { generateMetadata, revalidate } from "./metadata";

type Props = {
  params: Promise<{ id: string }>;
};

export default async function Page({ params }: Props) {
  const { id } = await params;
  const safeId = validateRouteId(id);
  if (!safeId) {
    return notFound();
  }

  // Prefetch on the server for JSON-LD (works in mock + live modes).
  // Failures fall back to client-rendered page without structured data.
  let jsonLd: string | null = null;
  let breadcrumbLd: string | null = null;

  try {
    const invoice = await fetchInvoiceById(safeId);
    if (invoice) {
      const ipfsMeta = await fetchIpfsMetadataForSeo(invoice.ipfsCid);
      const seo = buildPublicInvoiceSeo(invoice, ipfsMeta);

      jsonLd = serializeSchema(
        invoiceFinancialProductSchema({
          id: seo.id,
          invoiceNumber: seo.invoiceNumber,
          debtorName: seo.debtorLabel,
          amount: seo.amount,
          currency: seo.currency,
          apr: seo.apr,
          dueDate: seo.dueDate,
          jurisdiction: seo.jurisdiction,
          category: seo.category,
          riskTier: seo.riskTier,
        }),
      );

      breadcrumbLd = serializeSchema(
        breadcrumbSchema([
          { name: "Home", url: "/" },
          { name: "Marketplace", url: "/marketplace" },
          { name: seo.invoiceNumber, url: `/marketplace/${seo.id}` },
        ]),
      );
    }
  } catch {
    // Structured data is best-effort; page still renders.
  }

  return (
    <>
      {jsonLd ? (
        <script
          id="ld-invoice"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: jsonLd }}
        />
      ) : null}
      {breadcrumbLd ? (
        <script
          id="ld-breadcrumb-invoice"
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: breadcrumbLd }}
        />
      ) : null}
      <InvoiceDetailClient id={safeId} />
    </>
  );
}
