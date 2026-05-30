import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Create Invoice",
  description:
    "Tokenize your unpaid invoice as an NFT on Stellar Soroban. Upload your document, set financing terms, and access instant USDC liquidity from global investors.",
  keywords: [
    "create invoice",
    "invoice NFT",
    "invoice tokenization",
    "Stellar Soroban",
    "USDC liquidity",
    "SME financing",
  ],
  openGraph: {
    title: "Create Invoice | Kora Protocol",
    description:
      "Tokenize your invoice as an NFT and access instant USDC liquidity from global investors.",
    url: "/invoice/create",
  },
  twitter: {
    title: "Create Invoice | Kora Protocol",
    description: "Tokenize your invoice and access instant USDC liquidity on Kora Protocol.",
  },
  alternates: { canonical: "/invoice/create" },
  robots: { index: false, follow: false },
};

import { ConnectWalletGuard } from "@/components/layout/ConnectWalletGuard";

export default function CreateInvoiceLayout({ children }: { children: React.ReactNode }) {
  return <ConnectWalletGuard>{children}</ConnectWalletGuard>;
}
