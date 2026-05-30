/**
 * Invoice service — wraps contract calls with mock fallback.
 * Set NEXT_PUBLIC_ENABLE_MOCK_DATA=true to use mock data.
 */
import type { Invoice, CreateInvoiceFormData, PaginatedResponse, MarketplaceFilters, MarketplaceSort } from "@/types";
import { MOCK_INVOICES } from "./mockData";
import { uploadFileToPinata, uploadInvoiceMetadata } from "@/lib/ipfs";
import { invoiceContract, marketplaceContract } from "@/lib/stellar/contracts";
import { submitTransaction, waitForTransaction } from "@/lib/stellar/client";
import { sanitizeIpfsMetadata } from "@/lib/security";
import { env } from "@/lib/env";

const USE_MOCK = env.NEXT_PUBLIC_ENABLE_MOCK_DATA;

// ─── Read Operations ──────────────────────────────────────────────────────────

export async function fetchInvoices(
  filters: MarketplaceFilters = {},
  sort: MarketplaceSort = { key: "apr", direction: "desc" },
  page = 1,
  pageSize = 12
): Promise<PaginatedResponse<Invoice>> {
  if (USE_MOCK) {
    let data = [...MOCK_INVOICES];

    // Apply filters
    if (filters.category) data = data.filter((i) => i.metadata.category === filters.category);
    if (filters.categories && filters.categories.length > 0) {
      data = data.filter((i) => filters.categories!.includes(i.metadata.category));
    }
    if (filters.jurisdiction) data = data.filter((i) => i.metadata.jurisdiction === filters.jurisdiction);
    if (filters.jurisdictions && filters.jurisdictions.length > 0) {
      data = data.filter((i) => filters.jurisdictions!.includes(i.metadata.jurisdiction));
    }
    if (filters.riskTier) data = data.filter((i) => i.riskTier === filters.riskTier);
    if (filters.riskTiers && filters.riskTiers.length > 0) {
      data = data.filter((i) => filters.riskTiers!.includes(i.riskTier));
    }
    if (filters.currency) data = data.filter((i) => i.metadata.currency === filters.currency);
    if (filters.minApr) data = data.filter((i) => i.terms.apr >= filters.minApr!);
    if (filters.maxApr) data = data.filter((i) => i.terms.apr <= filters.maxApr!);
    if (filters.aprRange) {
      const [min, max] = filters.aprRange;
      data = data.filter((i) => i.terms.apr >= min && i.terms.apr <= max);
    }
    if (filters.status) data = data.filter((i) => i.status === filters.status);
    if (filters.activeOnly) {
      data = data.filter((i) => i.status === "listed" || i.status === "partially_funded");
    }

    // Apply sort
    data.sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sort.key) {
        case "apr": aVal = a.terms.apr; bVal = b.terms.apr; break;
        case "amount": aVal = a.metadata.amount; bVal = b.metadata.amount; break;
        case "duration": aVal = a.terms.tenor; bVal = b.terms.tenor; break;
        case "riskScore": aVal = a.riskScore; bVal = b.riskScore; break;
        default: aVal = new Date(a.createdAt).getTime(); bVal = new Date(b.createdAt).getTime();
      }
      return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
    });

    const start = (page - 1) * pageSize;
    return {
      data: data.slice(start, start + pageSize),
      total: data.length,
      page,
      pageSize,
      hasMore: start + pageSize < data.length,
    };
  }

  // TODO: replace with on-chain / indexer fetch
  throw new Error("Live data fetch not yet implemented");
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  if (USE_MOCK) {
    return MOCK_INVOICES.find((i) => i.id === id) ?? null;
  }
  throw new Error("Live data fetch not yet implemented");
}

/**
 * Fetches and sanitizes invoice metadata from IPFS.
 * All fields from untrusted external sources are sanitized before use.
 */
export async function fetchIpfsMetadata(cid: string): Promise<Record<string, unknown>> {
  const gateway = env.NEXT_PUBLIC_IPFS_GATEWAY;
  // Validate CID before making the request
  if (!/^[a-zA-Z0-9+/=_-]{10,100}$/.test(cid)) {
    throw new Error("Invalid IPFS CID");
  }
  const res = await fetch(`${gateway}/${cid}`, { signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`IPFS fetch failed: ${res.status}`);
  const raw: unknown = await res.json();
  return sanitizeIpfsMetadata(raw);
}

export async function fetchInvoicesByOwner(ownerAddress: string): Promise<Invoice[]> {
  if (USE_MOCK) {
    return MOCK_INVOICES.filter((i) => i.ownerAddress === ownerAddress);
  }
  throw new Error("Live data fetch not yet implemented");
}

export async function fetchPositions(investorAddress: string) {
  if (USE_MOCK) {
    const amounts = [15000, 50000, 5000, 100000, 25000, 8000];
    const positions = MOCK_INVOICES.slice(0, 6).map((inv, i) => {
      const invested = amounts[i % 6];
      const isRepaid = inv.status === "repaid" || i === 1; // force inv_002 as repaid
      const yieldEarned = isRepaid ? Math.round(invested * inv.terms.discountRate) : 0;
      return {
        invoiceId: inv.id,
        invoice: inv,
        investedAmount: invested,
        expectedReturn: invested * (1 + inv.terms.discountRate),
        yieldEarned,
        investedAt: new Date().toISOString(),
        status: isRepaid ? ("repaid" as const) : ("active" as const),
        claimed: false,
      };
    });
    return positions;
  }
  throw new Error("Live positions fetch not yet implemented");
}

// ─── Write Operations ─────────────────────────────────────────────────────────

/**
 * Full create-invoice flow:
 * 1. Upload PDF to IPFS
 * 2. Upload metadata JSON to IPFS
 * 3. Build mint transaction
 * 4. Return unsigned XDR for wallet signing
 */
export async function prepareCreateInvoice(
  formData: CreateInvoiceFormData,
  ownerAddress: string,
  onProgress?: (progress: number) => void
): Promise<{ unsignedXdr: string; metadataCid: string }> {
  if (!formData.document) throw new Error("Invoice document is required");

  // 1. Upload PDF
  const docCid = await uploadFileToPinata(
    formData.document,
    `invoice-${formData.invoiceNumber}.pdf`,
    ownerAddress,
    onProgress
  );

  // Calculate APR for standard metadata
  const daysToMaturity = Math.ceil(
    (new Date(formData.dueDate).getTime() - new Date(formData.listingExpiryDate).getTime()) / (1000 * 60 * 60 * 24)
  );
  const effectiveAPR = daysToMaturity > 0 && formData.discountRate > 0 && formData.discountRate < 1
    ? (formData.discountRate / (1 - formData.discountRate)) * (365 / daysToMaturity) * 100
    : 0;

  // 2. Build metadata object and upload
  const metadata = {
    // Standard schema properties
    name: "Invoice Asset",
    description: formData.description || "Tokenized Invoice Factoring Asset",
    image: `ipfs://${docCid}`,
    properties: {
      debtor: formData.debtorName,
      amount: formData.amount,
      apr: Number(effectiveAPR.toFixed(2)),
      dueDate: formData.dueDate,
      jurisdiction: formData.jurisdiction,
    },

    // Backward compatibility flat properties
    invoiceNumber: formData.invoiceNumber,
    issuerName: ownerAddress, // wallet address used as issuer name when not provided
    issuerAddress: ownerAddress,
    debtorName: formData.debtorName,
    debtorAddress: formData.debtorAddress,
    amount: formData.amount,
    currency: formData.currency,
    issueDate: formData.issueDate,
    dueDate: formData.dueDate,
    jurisdiction: formData.jurisdiction,
    category: formData.category,
    documentHash: docCid,
    documentUrl: `${env.NEXT_PUBLIC_IPFS_GATEWAY}/${docCid}`,
  };

  const metadataCid = await uploadInvoiceMetadata(
    metadata,
    ownerAddress
  );

  // 3. Build mint transaction
  const dueTimestamp = BigInt(Math.floor(new Date(formData.dueDate).getTime() / 1000));
  const financingAmount = BigInt(
    Math.round(formData.amount * (1 - formData.discountRate) * 1_000_000)
  );

  const unsignedXdr = await invoiceContract.mintInvoice(
    {
      ipfsCid: metadataCid,
      amount: BigInt(Math.round(formData.amount * 1_000_000)),
      financingAmount,
      discountRate: Math.round(formData.discountRate * 10_000), // basis points
      dueDate: dueTimestamp,
    },
    ownerAddress
  );

  return { unsignedXdr, metadataCid };
}

/**
 * Fund an invoice — returns unsigned XDR for wallet signing.
 */
export async function prepareFundInvoice(
  tokenId: string,
  amount: number,
  investorAddress: string
): Promise<string> {
  if (USE_MOCK) {
    return `mock_unsigned_xdr_fund_invoice_${tokenId}_${amount}_${investorAddress}`;
  }
  return marketplaceContract.fundInvoice(
    { tokenId: BigInt(tokenId), amount: BigInt(Math.round(amount * 1_000_000)) },
    investorAddress
  );
}

/**
 * Submit a signed XDR and wait for confirmation.
 */
export async function submitAndConfirm(signedXdr: string): Promise<string> {
  if (USE_MOCK || signedXdr.startsWith("mock_")) {
    await new Promise((resolve) => setTimeout(resolve, 1500));
    return Array.from({ length: 64 }, () =>
      Math.floor(Math.random() * 16).toString(16)
    ).join("");
  }
  const result = await submitTransaction(signedXdr);
  if (result.status === "ERROR") throw new Error("Transaction submission failed");
  const confirmed = await waitForTransaction(result.hash);
  if (confirmed.status !== "SUCCESS") throw new Error("Transaction failed on-chain");
  return result.hash;
}

export async function fetchInvestorPositions(investorAddress: string): Promise<import("@/types").InvoicePosition[]> {
  if (USE_MOCK) {
    // Return mock positions derived from mock invoices
    return MOCK_INVOICES.slice(0, 2).map((invoice) => ({
      invoiceId: invoice.id,
      invoice,
      investedAmount: 1000,
      expectedReturn: 1050,
      yieldEarned: 0,
      investedAt: new Date().toISOString(),
      status: "active" as const,
    }));
  }
  throw new Error("Live positions fetch not yet implemented");
}

/**
 * Repay a fully-funded invoice — returns unsigned XDR for wallet signing.
 */
export async function prepareRepayInvoice(
  tokenId: string,
  ownerAddress: string
): Promise<string> {
  if (USE_MOCK) {
    return `mock_unsigned_xdr_repay_invoice_${tokenId}_${ownerAddress}`;
  }
  return marketplaceContract.repayInvoice({ tokenId: BigInt(tokenId) }, ownerAddress);
}

/**
 * Claim yield from a repaid position — returns unsigned XDR for wallet signing.
 */
export async function prepareClaimPosition(
  positionId: string,
  investorAddress: string
): Promise<string> {
  if (USE_MOCK) {
    return `mock_unsigned_xdr_claim_position_${positionId}_${investorAddress}`;
  }
  return marketplaceContract.claimYield(
    { tokenId: BigInt(positionId) },
    investorAddress
  );
}

/**
 * Cancel a pending/listed invoice — returns unsigned XDR for wallet signing.
 */
export async function prepareCancelInvoice(
  tokenId: string,
  ownerAddress: string
): Promise<string> {
  if (USE_MOCK) {
    return `mock_unsigned_xdr_cancel_invoice_${tokenId}_${ownerAddress}`;
  }
  return marketplaceContract.cancelInvoice({ tokenId: BigInt(tokenId) }, ownerAddress);
}


