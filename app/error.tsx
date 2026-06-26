"use client";

import { useEffect } from "react";
import { AlertTriangle, RefreshCw, Home } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("error");

  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800">
        <AlertTriangle className="h-8 w-8 text-zinc-400" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold text-zinc-100">{t("title")}</h1>
        <p className="max-w-md text-sm text-zinc-400">{t("description")}</p>
        {process.env.NODE_ENV === "development" && error.message && (
          <p className="mx-auto max-w-md rounded bg-zinc-800 px-3 py-1.5 font-mono text-xs text-zinc-500">
            {error.message}
          </p>
        )}
      </div>
      <div className="flex gap-3">
        <Button variant="outline" onClick={reset} className="gap-2">
          <RefreshCw className="h-3.5 w-3.5" /> {t("tryAgain")}
        </Button>
        <Button asChild>
          <Link href="/" className="gap-2 inline-flex items-center">
            <Home className="h-3.5 w-3.5" /> {t("goHome")}
          </Link>
        </Button>
      </div>
    </div>
  );
}
