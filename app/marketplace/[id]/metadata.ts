import type { Metadata } from "next";
import { fetchInvoiceById } from "@/services/invoiceService";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = params.id;
  const invoice = await fetchInvoiceById(id);
  if (!invoice) return {};

  const metaTitle = `${invoice.metadata.invoiceNumber} — ${invoice.metadata.debtorName}`;
  const metaDescription = invoice.metadata.description || `Invoice listed on Kora — ${invoice.metadata.issuerName}`;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const pageUrl = siteUrl ? `${siteUrl}/marketplace/${id}` : `/marketplace/${id}`;

  const image = invoice.metadata.documentUrl || (invoice.metadata.documentHash ? `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/${invoice.metadata.documentHash}` : undefined);

  const metadata: Metadata = {
    title: metaTitle,
    description: metaDescription,
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: pageUrl,
      images: image ? [{ url: image }] : undefined,
      siteName: process.env.NEXT_PUBLIC_APP_NAME || "Kora",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
    },
  };

  return metadata;
}
