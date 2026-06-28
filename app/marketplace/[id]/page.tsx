import type { Metadata } from "next";
import { fetchInvoiceById } from "@/services/invoiceService";
import { formatCurrency, formatApr } from "@/lib/utils";
import { validateRouteId } from "@/lib/security";
import { notFound } from "next/navigation";
import InvoiceDetailClient from "./InvoiceDetailClient";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const safeId = validateRouteId(id);
  if (!safeId) {
    return {
      title: "Invalid Invoice | Kora Protocol",
    };
  }

  try {
    const invoice = await fetchInvoiceById(safeId);
    if (!invoice) {
      return {
        title: "Invoice Not Found | Kora Protocol",
      };
    }

    const debtorName = invoice.metadata.debtorName || "Unknown Debtor";
    const apr = formatApr(invoice.terms.apr);
    const faceValue = formatCurrency(invoice.metadata.amount);
    
    const title = `${debtorName} Invoice (${faceValue}) — APR ${apr} | Kora`;
    const description = `Invoice NFT marketplace opportunity: ${debtorName} invoice of ${faceValue} at ${apr} APR on Stellar Soroban.`;

    return {
      title,
      description,
      openGraph: {
        title,
        description,
        type: "website",
        images: [
          {
            url: "/og-image.png",
            width: 1200,
            height: 630,
            alt: `Kora Protocol Invoice: ${debtorName} - ${faceValue}`,
          },
        ],
      },
      twitter: {
        card: "summary_large_image",
        title,
        description,
        images: ["/og-image.png"],
      },
    };
  } catch (error) {
    return {
      title: "Invoice Details | Kora Protocol",
    };
  }
}

export default async function Page({ params }: Props) {
  const { id } = await params;
  const safeId = validateRouteId(id);
  if (!safeId) {
    return notFound();
  }

  return <InvoiceDetailClient id={safeId} />;
}
