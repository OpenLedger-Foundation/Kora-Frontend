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
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kora Protocol Portfolio Analytics",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Portfolio Analytics | Kora Protocol",
    description: "Track your invoice financing performance on Kora Protocol.",
    images: ["/og-image.png"],
  },
  alternates: { canonical: "/analytics" },
  robots: { index: false, follow: false },
};

export default function AnalyticsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
