"use client";

import { useState, useCallback, useRef } from "react";

interface UseCopyToClipboard {
  copy: (text: string) => Promise<void>;
  copied: boolean;
  error: string | null;
}

export function useCopyToClipboard(resetMs = 2000): UseCopyToClipboard {
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const copy = useCallback(
    async (text: string) => {
      if (timerRef.current) clearTimeout(timerRef.current);
      setError(null);
      try {
        if (navigator?.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          // execCommand fallback for Firefox/Safari
          const el = document.createElement("textarea");
          el.value = text;
          el.style.cssText = "position:fixed;opacity:0";
          document.body.appendChild(el);
          el.select();
          const ok = document.execCommand("copy");
          document.body.removeChild(el);
          if (!ok) throw new Error("execCommand copy failed");
        }
        setCopied(true);
        timerRef.current = setTimeout(() => setCopied(false), resetMs);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Copy failed");
        setCopied(false);
      }
    },
    [resetMs]
  );

  return { copy, copied, error };
}
