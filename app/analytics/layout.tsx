import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Portfolio Analytics",
  description:
    "Visualize your invoice financing performance. Track portfolio growth, yield earned, annualized returns, and risk distribution across your Kora Protocol positions.",
  keywords: [
    "portfolio analytics",
    "DeFi analytics",
    "yield tracking",
    "invoice financing",
    "Stellar",
  ],
  openGraph: {
    title: "Portfolio Analytics | Kora Protocol",
    description:
      "Visualize portfolio growth, yield, and risk distribution across your invoice financing positions.",
    url: "/analytics",
  },
  twitter: {
    title: "Portfolio Analytics | Kora Protocol",
    description: "Track your invoice financing performance on Kora Protocol.",
  },
  alternates: { canonical: "/analytics" },
  robots: { index: false, follow: false },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
