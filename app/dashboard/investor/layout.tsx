import type { Metadata } from "next";

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
  },
  twitter: {
    title: "Investor Dashboard | Kora Protocol",
    description: "Track your invoice financing portfolio on Kora Protocol.",
  },
  alternates: { canonical: "/dashboard/investor" },
  // Dashboards should not be indexed by search engines
  robots: { index: false, follow: false },
};

import { ConnectWalletGuard } from "@/components/layout/ConnectWalletGuard";

export default function InvestorDashboardLayout({ children }: { children: React.ReactNode }) {
  return <ConnectWalletGuard>{children}</ConnectWalletGuard>;
}
