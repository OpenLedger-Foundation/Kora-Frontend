"use client";

import { useEffect } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useWallet } from "@/hooks/useWallet";
import { useUIStore } from "@/store";
import { WalletButton } from "@/components/wallet/WalletButton";

export function ConnectWalletGuard({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isConnected } = useWallet();
  const { setIntendedDestination } = useUIStore();

  useEffect(() => {
    // If middleware rewrote with redirectTo param, persist it so post-connect redirect works
    const redirectTo = searchParams.get("redirectTo");
    if (redirectTo) setIntendedDestination(redirectTo);
  }, [searchParams, setIntendedDestination]);

  // If not connected and current path is protected, show overlay modal
  if (!isConnected && ["/invoice/create", "/dashboard/sme", "/dashboard/investor"].some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
        <div className="mx-auto max-w-md rounded-xl border border-border bg-card p-6 text-center">
          <h3 className="text-lg font-bold">Connect your wallet to continue</h3>
          <p className="mt-2 text-sm text-muted-foreground">This page requires a connected wallet.</p>
          <div className="mt-4 flex items-center justify-center gap-3">
            <WalletButton />
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
