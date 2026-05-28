import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

// ─── Site-wide metadata ───────────────────────────────────────────────────────
// Per-page metadata is exported from each page's layout or page file.
// The `template` ensures every page title follows "Page Name | Kora Protocol".
export const metadata: Metadata = {
  // metadataBase is required for absolute URLs in openGraph/twitter images
  metadataBase: new URL(
    process.env.NEXT_PUBLIC_APP_URL ?? "https://kora-protocol.vercel.app"
  ),

  title: {
    default: "Kora Protocol — On-Chain Invoice Financing",
    template: "%s | Kora Protocol",
  },
  description:
    "SMEs tokenize unpaid invoices as NFTs on Stellar Soroban and sell them at a discount to global liquidity providers — unlocking instant stablecoin liquidity without banks.",
  keywords: [
    "invoice financing",
    "DeFi",
    "Stellar",
    "Soroban",
    "SME",
    "liquidity",
    "invoice NFT",
    "stablecoin",
    "USDC",
    "emerging markets",
    "Africa",
    "trade finance",
  ],
  authors: [{ name: "Kora Protocol" }],
  creator: "Kora Protocol",
  publisher: "Kora Protocol",

  // Canonical URL — Next.js uses metadataBase + path automatically
  alternates: {
    canonical: "/",
  },

  // Robots: index all pages, follow links
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },

  // Open Graph
  openGraph: {
    type: "website",
    locale: "en_US",
    url: "/",
    siteName: "Kora Protocol",
    title: "Kora Protocol — On-Chain Invoice Financing",
    description:
      "Tokenize invoices as NFTs on Stellar Soroban. Instant USDC liquidity for SMEs, transparent yield for investors.",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Kora Protocol — On-Chain Invoice Financing on Stellar",
      },
    ],
  },

  // Twitter / X card
  twitter: {
    card: "summary_large_image",
    site: "@KoraProtocol",
    creator: "@KoraProtocol",
    title: "Kora Protocol — On-Chain Invoice Financing",
    description:
      "Tokenize invoices as NFTs on Stellar Soroban. Instant USDC liquidity for SMEs.",
    images: ["/og-image.png"],
  },

  // App manifest / theme
  manifest: "/manifest.json",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#09090b" },
  ],
};

const themeInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem('kora-ui-store')||'{}');var t=s.state&&s.state.theme||'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background antialiased`}>
        <Providers>
          <Navbar />
          <main className="min-h-screen">{children}</main>
        </Providers>
      </body>
    </html>
  );
}
