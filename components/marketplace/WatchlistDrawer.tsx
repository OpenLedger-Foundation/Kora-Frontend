"use client";

import Link from "next/link";
import { Bell, BellOff, Star, X } from "lucide-react";
import { useInvoiceStore } from "@/store";
import type { NotificationPreferences } from "@/store/invoiceStore";
import { formatCurrency, formatApr } from "@/lib/utils";

interface WatchlistDrawerProps {
  open: boolean;
  onClose: () => void;
}

const preferenceLabels: Array<[keyof NotificationPreferences, string]> = [
  ["fundingProgress", "Funding progress"],
  ["status", "Status changes"],
  ["apr", "APR changes"],
];

export function WatchlistDrawer({ open, onClose }: WatchlistDrawerProps) {
  const invoices = useInvoiceStore((state) => state.invoices);
  const watchedIds = useInvoiceStore((state) => state.watchedInvoiceIds);
  const preferences = useInvoiceStore((state) => state.notificationPreferences);
  const setPreferences = useInvoiceStore((state) => state.setNotificationPreferences);
  const toggleWatched = useInvoiceStore((state) => state.toggleWatchedInvoice);
  const watched = watchedIds
    .map((id) => invoices.find((invoice) => invoice.id === id))
    .filter((invoice): invoice is NonNullable<typeof invoice> => Boolean(invoice));

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50" role="dialog" aria-modal="true" aria-label="Invoice watchlist">
      <button className="absolute inset-0 bg-black/50" onClick={onClose} aria-label="Close watchlist" />
      <aside className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col border-l border-border bg-card p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <div>
            <p className="flex items-center gap-2 text-lg font-semibold"><Star className="h-5 w-5 fill-primary text-primary" /> Watchlist</p>
            <p className="mt-1 text-xs text-muted-foreground">{watched.length} watched invoice{watched.length === 1 ? "" : "s"}</p>
          </div>
          <button className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground" onClick={onClose} aria-label="Close watchlist"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto py-4">
          {watched.length === 0 ? <p className="py-10 text-center text-sm text-muted-foreground">Star an invoice to track it here.</p> : watched.map((invoice) => (
            <div key={invoice.id} className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
              <Link href={`/marketplace/${invoice.id}`} onClick={onClose} className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{invoice.metadata.debtorName}</p>
                <p className="mt-1 text-xs text-muted-foreground">{formatCurrency(invoice.funding.totalRaised, invoice.metadata.currency, true)} raised · {formatApr(invoice.terms.apr)}</p>
              </Link>
              <button onClick={() => toggleWatched(invoice.id)} className="rounded-md p-2 text-primary hover:bg-muted" aria-label={`Unstar ${invoice.metadata.invoiceNumber}`}><Star className="h-4 w-4 fill-current" /></button>
            </div>
          ))}
        </div>
        <div className="border-t border-border pt-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold"><Bell className="h-4 w-4" /> Alert preferences</p>
          {preferenceLabels.map(([key, label]) => (
            <label key={key} className="flex cursor-pointer items-center justify-between py-2 text-sm text-muted-foreground">
              {label}
              <input type="checkbox" checked={preferences[key]} onChange={(event) => setPreferences({ [key]: event.target.checked })} className="h-4 w-4 accent-primary" />
            </label>
          ))}
          {!Object.values(preferences).some(Boolean) && <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground"><BellOff className="h-3 w-3" /> Alerts are paused.</p>}
        </div>
      </aside>
    </div>
  );
}