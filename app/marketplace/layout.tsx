import type { Metadata } from "next";
import dynamic from "next/dynamic";

const ContractEventSubscriber = dynamic(
  () =>
    import("@/components/marketplace/ContractEventSubscriber").then(
      (m) => m.ContractEventSubscriber
    ),
  { ssr: false, loading: () => null }
);

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
  },
  twitter: {
    title: "Invoice Marketplace | Kora Protocol",
    description: "Browse and fund tokenized invoices. Earn transparent yield on real-world trade finance.",
  },
  alternates: { canonical: "/marketplace" },
};

export default function MarketplaceLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <ContractEventSubscriber />
      {children}
    </>
  );
}
