"use client";

import { useEffect, useRef } from "react";
import { Copy, Check, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import * as Tooltip from "@radix-ui/react-tooltip";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { cn } from "@/lib/utils";

interface CopyButtonProps {
  text: string;
  className?: string;
  /** Short label describing what is being copied, for toast feedback. */
  label?: string;
}

export function CopyButton({ text, className, label }: CopyButtonProps) {
  const t = useTranslations("copyButton");
  const { copy, copied, error } = useCopyToClipboard();
  const lastResultRef = useRef<"success" | "error" | null>(null);

  // Surface every terminal result exactly once via toast. Tooltips never fire
  // on touch devices, so this is the only reliable mobile feedback channel.
  useEffect(() => {
    if (copied && lastResultRef.current !== "success") {
      lastResultRef.current = "success";
      toast.success(label ? t("copiedToast", { label }) : t("copiedToast"));
    }
    if (error && lastResultRef.current !== "error") {
      lastResultRef.current = "error";
      toast.error(label ? t("failedToast", { label }) : t("failedToast"));
    }
    if (!copied && !error) {
      lastResultRef.current = null;
    }
  }, [copied, error, label, t]);

  const failed = !copied && !!error;

  return (
    <Tooltip.Provider delayDuration={200}>
      <Tooltip.Root>
        <Tooltip.Trigger asChild>
          <button
            type="button"
            onClick={() => void copy(text)}
            aria-label={
              copied
                ? t("copiedAriaLabel")
                : failed
                  ? t("failedAriaLabel")
                  : t("copyAriaLabel")
            }
            className={cn(
              "inline-flex items-center justify-center rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground",
              className
            )}
          >
            <AnimatePresence mode="wait" initial={false}>
              {copied ? (
                <motion.span
                  key="check"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Check className="h-3.5 w-3.5 text-green-500" />
                </motion.span>
              ) : failed ? (
                <motion.span
                  key="error"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <X className="h-3.5 w-3.5 text-destructive" />
                </motion.span>
              ) : (
                <motion.span
                  key="copy"
                  initial={{ scale: 0.5, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  exit={{ scale: 0.5, opacity: 0 }}
                  transition={{ duration: 0.15 }}
                >
                  <Copy className="h-3.5 w-3.5" />
                </motion.span>
              )}
            </AnimatePresence>
          </button>
        </Tooltip.Trigger>
        <Tooltip.Portal>
          <Tooltip.Content
            side="top"
            className="rounded-md bg-foreground px-2 py-1 text-xs text-background shadow-md"
          >
            {copied
              ? t("copiedTooltip")
              : failed
                ? t("failedTooltip")
                : t("copyTooltip")}
            <Tooltip.Arrow className="fill-foreground" />
          </Tooltip.Content>
        </Tooltip.Portal>
      </Tooltip.Root>
    </Tooltip.Provider>
  );
}
