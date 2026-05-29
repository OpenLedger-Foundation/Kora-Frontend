"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";
import { Toaster } from "sonner";
import { useState } from "react";
import dynamic from "next/dynamic";
const WalletConnectModal = dynamic(
  () => import("@/components/wallet/WalletConnectModal").then((m) => m.WalletConnectModal),
  { ssr: false, loading: () => null }
);
const InstallPrompt = dynamic(
  () => import("@/components/pwa/InstallPrompt").then((m) => m.InstallPrompt),
  { ssr: false, loading: () => null }
);
import { ThemeProvider } from "@/components/layout/ThemeProvider";
import { useUIStore } from "@/store/uiStore";
import { env } from "@/lib/env";

function ThemedToaster() {
  const theme = useUIStore((s) => s.theme);
  return (
    <Toaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast: "bg-card border border-border text-foreground",
          description: "text-muted-foreground",
        },
      }}
    />
  );
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: { staleTime: 30_000, retry: 1 },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        {children}
        <WalletConnectModal />
        <InstallPrompt />
        <ThemedToaster />
        {env.NEXT_PUBLIC_ENABLE_DEVTOOLS && (
          <ReactQueryDevtools initialIsOpen={false} />
        )}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
