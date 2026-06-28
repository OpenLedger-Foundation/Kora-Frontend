import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Transaction History",
  description:
    "View your complete on-chain transaction history on Kora Protocol — invoice mints, funding events, repayments, and yield claims.",
  alternates: { canonical: "/transactions" },
  robots: { index: false, follow: false },
};

export default function TransactionsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
