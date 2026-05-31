import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";
import { PageTransition } from "@/components/layout/PageTransition";
import { env } from "@/lib/env";
import { websiteSchema, organizationSchema, serializeSchema } from "@/lib/structuredData";

// Optimised font loading: display=swap prevents render-blocking, subset limits
// download size. Both fonts are preloaded by next/font automatically.
const geistSans = Inter({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
  preload: true,
});
const geistMono = JetBrains_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
  preload: false, // mono font is not LCP-critical; defer to reduce initial load
});

// ─── Site-wide metadata ───────────────────────────────────────────────────────
// Per-page metadata is exported from each page's layout or page file.
// The `template` ensures every page title follows "Page Name | Kora Protocol".
export const metadata: Metadata = {
  // metadataBase is required for absolute URLs in openGraph/twitter images
  metadataBase: new URL(env.NEXT_PUBLIC_APP_URL),

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
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Kora",
  },
  formatDetection: {
    telephone: false,
  },
};

// Security: this is a static compile-time string with zero user input — safe for dangerouslySetInnerHTML.
// classList.add() only accepts a single token and throws on whitespace, preventing injection.
const themeInitScript = `(function(){try{var s=JSON.parse(localStorage.getItem('kora-ui-store')||'{}');var t=s.state&&s.state.theme==='light'?'light':'dark';document.documentElement.classList.add(t);}catch(e){document.documentElement.classList.add('dark');}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
        {/* Apple PWA meta — Next.js metadata API doesn't cover all apple-* tags */}
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="mobile-web-app-capable" content="yes" />
        {/* DNS prefetch for external origins used at runtime */}
        <link rel="dns-prefetch" href="https://soroban-testnet.stellar.org" />
        <link rel="dns-prefetch" href="https://horizon-testnet.stellar.org" />
        <link rel="dns-prefetch" href="https://gateway.pinata.cloud" />
        {/* Preconnect to IPFS gateway — used for invoice images on marketplace */}
        <link rel="preconnect" href="https://gateway.pinata.cloud" crossOrigin="anonymous" />
        {/* Structured data: WebSite + Organization for SEO ≥ 95 */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(websiteSchema()) }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: serializeSchema(organizationSchema()) }}
        />
      </head>
      <body className={`${geistSans.variable} ${geistMono.variable} bg-background antialiased`}>
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[100] focus:rounded-md focus:bg-background focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-foreground"
        >
          Skip to content
        </a>
        <Providers>
          <Navbar />
          <main id="content" className="min-h-screen">
            <PageTransition>{children}</PageTransition>
          </main>
        </Providers>
      </body>
    </html>
  );
}
