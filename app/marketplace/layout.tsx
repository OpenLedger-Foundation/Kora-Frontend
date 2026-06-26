import type { Metadata } from "next";
import { ContractEventSubscriber } from "@/components/marketplace/ContractEventSubscriber";

export const metadata: Metadata = {
  title: "Invoice Marketplace",
  description:
    "Browse tokenized invoices from SMEs across Africa and emerging markets. Earn up to 32% APR by funding real-world trade finance on Stellar Soroban.",
  keywords: [
    "invoice marketplace",
    "DeFi yield",
    "trade finance",
    "Stellar",
    "USDC",
    "invoice NFT",
    "emerging markets",
  ],
  openGraph: {
    title: "Invoice Marketplace | Kora Protocol",
    description:
      "Browse and fund tokenized invoices. Earn transparent yield on real-world trade finance.",
    url: "/marketplace",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kora Protocol Invoice Marketplace",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Invoice Marketplace | Kora Protocol",
    description: "Browse and fund tokenized invoices. Earn transparent yield on real-world trade finance.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "/marketplace" },
  robots: { index: true, follow: true },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ContractEventSubscriber />
      {children}
    </>
  );
}
