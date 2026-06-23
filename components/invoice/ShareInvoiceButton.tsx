"use client";

import { useState, useEffect } from "react";
import * as Popover from "@radix-ui/react-popover";
import { Copy, Twitter, Linkedin, QrCode } from "lucide-react";
import { Button } from "@/components/ui/button";
import QRCode from "qrcode";

type Props = {
  id: string;
  invoiceTitle?: string;
  summary?: string;
};

export default function ShareInvoiceButton({ id, invoiceTitle, summary }: Props): JSX.Element {
  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const siteBase = typeof window !== "undefined" ? window.location.origin : "";
  const utm = new URLSearchParams({ utm_source: "kora_share", utm_medium: "social", utm_campaign: "invoice_share" });
  const invoiceUrl = `${siteBase}/marketplace/${id}?${utm.toString()}`;

  useEffect(() => {
    let mounted = true;
    QRCode.toDataURL(invoiceUrl, { margin: 1, width: 240 })
      .then((dataUrl: string) => mounted && setQrDataUrl(dataUrl))
      .catch(() => mounted && setQrDataUrl(null));
    return () => {
      mounted = false;
    };
  }, [invoiceUrl]);

  const handleCopy = async (): Promise<void> => {
    try {
      if (navigator?.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(invoiceUrl);
        setCopied(true);
        // simple client-only analytics event
        if ((window as any)?.dataLayer) (window as any).dataLayer.push({ event: "share_copy", invoiceId: id });
        setTimeout(() => setCopied(false), 2000);
      } else {
        // fallback
        const el = document.createElement("textarea");
        el.value = invoiceUrl;
        document.body.appendChild(el);
        el.select();
        document.execCommand("copy");
        document.body.removeChild(el);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (e) {
      console.error("copy failed", e);
    }
  };

  const tweetText = encodeURIComponent(`${invoiceTitle ?? "Invoice"} · ${summary ?? "Invoice listed on Kora"}`);
  const twitterUrl = `https://twitter.com/intent/tweet?text=${tweetText}&url=${encodeURIComponent(invoiceUrl)}`;

  const linkedInUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(invoiceUrl)}`;

  return (
    <Popover.Root>
      <Popover.Trigger asChild>
        <Button size="sm" variant="ghost" aria-label="Share invoice">
          Share
        </Button>
      </Popover.Trigger>
      <Popover.Portal>
          <Popover.Content className="z-50 w-[260px] rounded-xl border border-zinc-800 bg-zinc-950 p-2 shadow-2xl">
          <div className="flex flex-col gap-2 p-2">
            <div className="flex items-center justify-between gap-2">
              <Button size="sm" variant="ghost" onClick={handleCopy} className="w-full">
                <Copy className="mr-2" /> {copied ? "Link copied" : "Copy link"}
              </Button>
            </div>

            <div className="flex items-center gap-2">
              <a
                href={twitterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                onClick={() => {
                  if ((window as any)?.dataLayer) (window as any).dataLayer.push({ event: "share_twitter", invoiceId: id });
                }}
              >
                <Button size="sm" variant="ghost" className="w-full">
                  <Twitter className="mr-2" /> Share on X
                </Button>
              </a>
              <a
                href={linkedInUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1"
                onClick={() => {
                  if ((window as any)?.dataLayer) (window as any).dataLayer.push({ event: "share_linkedin", invoiceId: id });
                }}
              >
                <Button size="sm" variant="ghost" className="w-full">
                  <Linkedin className="mr-2" /> LinkedIn
                </Button>
              </a>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <div className="flex-1">
                <div className="text-xs text-zinc-400">QR Code</div>
                <div className="mt-2 flex items-center justify-center">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Invoice QR" className="h-32 w-32" />
                  ) : (
                    <div className="h-32 w-32 flex items-center justify-center rounded bg-zinc-900">
                      <QrCode />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
          {/* Arrow intentionally omitted for broad Radix compatibility */}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
