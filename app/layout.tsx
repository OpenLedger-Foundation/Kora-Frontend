import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { Navbar } from "@/components/layout/Navbar";

const geistSans = Inter({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = JetBrains_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: { default: "Kora Protocol", template: "%s | Kora Protocol" },
  description: "On-chain invoice financing built on Stellar Soroban. Instant liquidity for SMEs.",
  keywords: ["invoice financing", "DeFi", "Stellar", "Soroban", "SME", "liquidity"],
  openGraph: {
    title: "Kora Protocol",
    description: "On-chain invoice financing built on Stellar Soroban",
    type: "website",
  },
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
