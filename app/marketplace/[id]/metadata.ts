import type { Metadata } from "next";
import { fetchInvoiceById } from "@/services/invoiceService";
import {
  invoiceFinancialProductSchema,
  breadcrumbSchema,
  serializeSchema,
} from "@/lib/structuredData";

export async function generateMetadata({ params }: { params: { id: string } }): Promise<Metadata> {
  const id = params.id;
  const invoice = await fetchInvoiceById(id);
  if (!invoice) return {};

  const metaTitle = `${invoice.metadata.invoiceNumber} — ${invoice.metadata.debtorName}`;
  const metaDescription =
    invoice.metadata.description ||
    `Invoice listed on Kora — ${invoice.metadata.issuerName}. ${invoice.terms.apr.toFixed(2)}% APR, due ${invoice.metadata.dueDate}.`;
  const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const pageUrl = siteUrl ? `${siteUrl}/marketplace/${id}` : `/marketplace/${id}`;

  const image =
    invoice.metadata.documentUrl ||
    (invoice.metadata.documentHash
      ? `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/${invoice.metadata.documentHash}`
      : undefined);

  const metadata: Metadata = {
    title: metaTitle,
    description: metaDescription,
    keywords: [
      invoice.metadata.invoiceNumber,
      invoice.metadata.debtorName,
      invoice.metadata.category,
      invoice.metadata.jurisdiction,
      "invoice NFT",
      "DeFi yield",
      "Stellar Soroban",
    ],
    openGraph: {
      title: metaTitle,
      description: metaDescription,
      url: pageUrl,
      images: image
        ? [{ url: image, width: 1200, height: 630, alt: metaTitle }]
        : [{ url: "/og-image.png", width: 1200, height: 630, alt: "Kora Protocol" }],
      siteName: process.env.NEXT_PUBLIC_APP_NAME || "Kora",
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: metaTitle,
      description: metaDescription,
      images: image ? [image] : ["/og-image.png"],
    },
    alternates: { canonical: `/marketplace/${id}` },
    robots: { index: true, follow: true },
  };

  return metadata;
}
