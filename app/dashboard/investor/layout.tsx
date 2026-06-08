import type { Metadata } from "next";
import { ContractEventSubscriber } from "@/components/marketplace/ContractEventSubscriber";

export const metadata: Metadata = {
  title: "Investor Dashboard",
  description:
    "Track your invoice financing portfolio. Monitor active positions, expected yield, and repayment schedules across all your Kora Protocol investments.",
  keywords: [
    "investor dashboard",
    "portfolio tracker",
    "DeFi yield",
    "invoice financing",
    "Stellar",
  ],
  openGraph: {
    title: "Investor Dashboard | Kora Protocol",
    description:
      "Track your invoice financing portfolio — active positions, yield, and repayment schedules.",
    url: "/dashboard/investor",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kora Protocol Investor Dashboard",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Investor Dashboard | Kora Protocol",
    description: "Track your invoice financing portfolio on Kora Protocol.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "/dashboard/investor" },
  robots: { index: false, follow: false },
};

import { ConnectWalletGuard } from "@/components/layout/ConnectWalletGuard";

export default function InvestorDashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <ConnectWalletGuard>
      <ContractEventSubscriber />
      {children}
    </ConnectWalletGuard>
  );
}
