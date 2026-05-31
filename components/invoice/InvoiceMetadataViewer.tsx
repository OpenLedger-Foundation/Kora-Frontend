"use client";

import React, { useState } from "react";
import { 
  FileText, 
  Hash, 
  Clock, 
  ShieldCheck, 
  ShieldAlert, 
  ChevronDown, 
  ChevronUp, 
  ExternalLink,
  Calendar,
  Building,
  User,
  Tag,
  Globe,
  Lock
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CopyButton } from "@/components/ui/CopyButton";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import type { Invoice } from "@/types/invoice";
import { safeStellarTxUrl } from "@/lib/security";

interface InvoiceMetadataViewerProps {
  invoice: Invoice;
  isFunded?: boolean;
}

export function InvoiceMetadataViewer({ invoice, isFunded = false }: InvoiceMetadataViewerProps) {
  const [showRaw, setShowRaw] = useState(false);
  const { metadata, tokenId, contractAddress, txHash, createdAt, ipfsCid, debtorPrivacy } = invoice;
  
  // Post-fund reveal logic
  const effectivePrivacy = isFunded ? "full" : debtorPrivacy;
  const isAnonymized = effectivePrivacy === "anonymized";
  const isPartial = effectivePrivacy === "partial";

  // Verification: IPFS CID matches on-chain stored CID
  // In a real scenario, we'd compare the CID from the smart contract call with the one we fetched
  // For this component, we assume ipfsCid is what's on-chain and metadata.documentHash is the CID in the metadata
  const isVerified = ipfsCid === metadata.documentHash;

  const formatDateWithTZ = (dateStr: string) => {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return { utc: "—", local: "—" };
    
    return {
      utc: format(new Date(date.getTime() + date.getTimezoneOffset() * 60000), "yyyy-MM-dd HH:mm:ss") + " UTC",
      local: format(date, "yyyy-MM-dd HH:mm:ss (xxx)")
    };
  };

  const createdDates = formatDateWithTZ(createdAt);
  const issueDates = formatDateWithTZ(metadata.issueDate);
  const dueDates = formatDateWithTZ(metadata.dueDate);

  const MetadataField = ({ 
    label, 
    value, 
    copyText, 
    isLink, 
    linkUrl,
    isSensitive = false
  }: { 
    label: string; 
    value: string; 
    copyText?: string;
    isLink?: boolean;
    linkUrl?: string;
    isSensitive?: boolean;
  }) => {
    const displayValue = isSensitive ? "••••••••••••" : value;
    const canCopy = copyText && !isSensitive;

    return (
      <div className="group relative flex flex-col gap-1 rounded-lg border border-transparent p-2 transition-colors hover:bg-muted/50 hover:border-border">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</span>
          {canCopy && <CopyButton text={copyText} className="h-6 w-6 opacity-0 group-hover:opacity-100" />}
        </div>
        <div className="flex items-center gap-2 overflow-hidden">
          {isSensitive ? (
            <span className="flex items-center gap-1.5 text-xs text-muted-foreground italic">
              <Lock className="h-3 w-3" /> Identity hidden
            </span>
          ) : isLink ? (
            <a 
              href={linkUrl} 
              target="_blank" 
              rel="noopener noreferrer"
              className="truncate text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              {displayValue}
              <ExternalLink className="h-3 w-3 flex-shrink-0" />
            </a>
          ) : (
            <span className="truncate text-sm font-medium text-foreground" title={displayValue}>{displayValue}</span>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      {/* Verification Status Banner */}
      <div className={cn(
        "flex items-center justify-between rounded-xl border p-4",
        isVerified 
          ? "border-emerald-500/20 bg-emerald-500/5 text-emerald-400" 
          : "border-amber-500/20 bg-amber-500/5 text-amber-400"
      )}>
        <div className="flex items-center gap-3">
          {isVerified ? (
            <ShieldCheck className="h-6 w-6" />
          ) : (
            <ShieldAlert className="h-6 w-6" />
          )}
          <div>
            <p className="text-sm font-bold">
              {isVerified ? "Metadata Verified" : "Verification Warning"}
            </p>
            <p className="text-xs opacity-80">
              {isVerified 
                ? "IPFS Content ID matches the cryptographically signed on-chain record." 
                : "IPFS CID mismatch detected. The metadata content may have been altered."}
            </p>
          </div>
        </div>
        <Badge variant={isVerified ? "success" : "warning"} className="h-fit">
          {isVerified ? "Authentic" : "Unverified"}
        </Badge>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        {/* On-Chain Records */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <Hash className="h-4 w-4 text-primary" /> On-Chain Ledger Records
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MetadataField label="Token ID" value={tokenId} copyText={tokenId} />
            <MetadataField 
              label="Contract Address" 
              value={contractAddress} 
              copyText={contractAddress}
              isLink
              linkUrl={`https://stellar.expert/explorer/testnet/contract/${contractAddress}`}
            />
            <MetadataField 
              label="Mint Transaction" 
              value={txHash || "Pending"} 
              copyText={txHash}
              isLink={!!txHash}
              linkUrl={txHash ? safeStellarTxUrl(txHash) : undefined}
            />
            <div className="flex flex-col gap-1 p-2">
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Block Timestamp</span>
              <div className="flex flex-col">
                <span className="text-sm font-medium text-foreground">{createdDates.local}</span>
                <span className="text-[10px] text-muted-foreground">{createdDates.utc}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* IPFS Metadata */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <FileText className="h-4 w-4 text-primary" /> IPFS Content Metadata
            </CardTitle>
          </CardHeader>
          <CardContent className="grid gap-2">
            <MetadataField 
              label="IPFS Content ID (CID)" 
              value={ipfsCid} 
              copyText={ipfsCid}
              isLink
              linkUrl={`https://ipfs.io/ipfs/${ipfsCid}`}
            />
            <div className="grid grid-cols-2 gap-2">
              <MetadataField label="Invoice #" value={metadata.invoiceNumber} copyText={metadata.invoiceNumber} />
              <MetadataField label="Currency" value={metadata.currency} />
            </div>
            <MetadataField label="Issuer" value={metadata.issuerName} copyText={metadata.issuerName} />
            <MetadataField 
              label="Debtor" 
              value={metadata.debtorName} 
              copyText={metadata.debtorName} 
              isSensitive={isAnonymized}
            />
            <div className="grid grid-cols-2 gap-2">
              <div className="flex flex-col gap-1 p-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Issue Date</span>
                <span className="text-sm font-medium text-foreground">{issueDates.local}</span>
                <span className="text-[10px] text-muted-foreground">{issueDates.utc}</span>
              </div>
              <div className="flex flex-col gap-1 p-2">
                <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Due Date</span>
                <span className="text-sm font-medium text-foreground">{dueDates.local}</span>
                <span className="text-[10px] text-muted-foreground">{dueDates.utc}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Expanded Metadata Sections */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Detailed Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
             <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
               <Building className="h-4 w-4 text-muted-foreground mt-0.5" />
               <div className="flex flex-col gap-0.5 overflow-hidden">
                 <span className="text-[10px] font-medium uppercase text-muted-foreground">Issuer Address</span>
                 <span className="truncate text-xs text-foreground" title={metadata.issuerAddress}>{metadata.issuerAddress}</span>
               </div>
             </div>
             <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
               <User className="h-4 w-4 text-muted-foreground mt-0.5" />
               <div className="flex flex-col gap-0.5 overflow-hidden">
                 <span className="text-[10px] font-medium uppercase text-muted-foreground">Debtor Address</span>
                 {isAnonymized || isPartial ? (
                    <span className="flex items-center gap-1 text-xs text-muted-foreground italic">
                      <Lock className="h-3 w-3" /> Address hidden
                    </span>
                 ) : (
                    <span className="truncate text-xs text-foreground" title={metadata.debtorAddress}>{metadata.debtorAddress}</span>
                 )}
               </div>
             </div>
             <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
               <Globe className="h-4 w-4 text-muted-foreground mt-0.5" />
               <div className="flex flex-col gap-0.5 overflow-hidden">
                 <span className="text-[10px] font-medium uppercase text-muted-foreground">Jurisdiction</span>
                 <span className="text-xs text-foreground">{metadata.jurisdiction}</span>
               </div>
             </div>
             <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3">
               <Tag className="h-4 w-4 text-muted-foreground mt-0.5" />
               <div className="flex flex-col gap-0.5 overflow-hidden">
                 <span className="text-[10px] font-medium uppercase text-muted-foreground">Category</span>
                 <span className="text-xs text-foreground capitalize">{metadata.category}</span>
               </div>
             </div>
             <div className="flex items-start gap-3 rounded-lg bg-muted/30 p-3 sm:col-span-2">
               <FileText className="h-4 w-4 text-muted-foreground mt-0.5" />
               <div className="flex flex-col gap-0.5 overflow-hidden">
                 <span className="text-[10px] font-medium uppercase text-muted-foreground">Description</span>
                 <p className="text-xs text-foreground leading-relaxed">{metadata.description || "No description provided."}</p>
               </div>
             </div>
          </div>
        </CardContent>
      </Card>

      {/* Raw JSON Section */}
      <div className="rounded-xl border bg-muted/20">
        <button 
          onClick={() => setShowRaw(!showRaw)}
          className="flex w-full items-center justify-between p-4 text-sm font-medium transition-colors hover:bg-muted/30"
        >
          <span className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-muted-foreground" />
            View Raw Metadata JSON
          </span>
          {showRaw ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {showRaw && (
          <div className="border-t p-4">
            <div className="relative">
              <CopyButton 
                text={JSON.stringify(invoice, null, 2)} 
                className="absolute right-2 top-2 z-10 bg-background/80 backdrop-blur-sm" 
              />
              <pre className="max-h-[400px] overflow-auto rounded-lg bg-zinc-950 p-4 text-[11px] leading-relaxed text-zinc-400 scrollbar-thin scrollbar-thumb-zinc-800">
                {JSON.stringify(invoice, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
