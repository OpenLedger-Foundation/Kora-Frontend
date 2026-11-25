"use client";

import { useId, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function InvoiceTransactionGroup({
  invoiceId, label = invoiceId, count, children,
}: {
  invoiceId: string;
  label?: string;
  count: number;
  children: ReactNode;
}) {
  const t = useTranslations("transactions");
  const contentId = useId();
  const [expanded, setExpanded] = useState(true);

  return (
    <div className="min-w-0 rounded-xl border border-border p-2">
      <Button
        type="button"
        variant="ghost"
        className="h-auto min-h-10 w-full justify-between gap-2 whitespace-normal text-start"
        aria-expanded={expanded}
        aria-controls={contentId}
        onClick={() => setExpanded((value) => !value)}
      >
        <span className="min-w-0 break-all">{t("invoiceGroup", { invoice: label, count })}</span>
        <ChevronDown className={expanded ? "h-4 w-4 shrink-0 rotate-180" : "h-4 w-4 shrink-0"} aria-hidden />
      </Button>
      <div id={contentId} hidden={!expanded}>
        <div className="space-y-2 pt-2">{children}</div>
      </div>
    </div>
  );
}
