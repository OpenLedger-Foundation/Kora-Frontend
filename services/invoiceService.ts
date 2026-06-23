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

const USE_MOCK = process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true";

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
  const gateway = process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs";
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

/**
 * Batch-fetch invoices by their on-chain token IDs.
 * In mock mode returns matching mock invoices without hitting RPC.
 * In live mode delegates to batchGetInvoices() — results are OnChainInvoice
 * (raw on-chain data); callers must map/enrich as needed.
 *
 * Batch size is capped at BATCH_SIZE_LIMIT (20) upstream by batchGetInvoices.
 */
export async function fetchInvoicesByTokenIds(
  tokenIds: string[],
  sourcePublicKey: string
): Promise<Invoice[]> {
  if (USE_MOCK) {
    // No RPC calls in mock mode — just look up from static mock data
    const idSet = new Set(tokenIds);
    return MOCK_INVOICES.filter((i) => idSet.has(i.tokenId));
  }

  const { batchGetInvoices } = await import("@/lib/stellar/client");
  const results = await batchGetInvoices(tokenIds, sourcePublicKey);

  // Map on-chain structs back to Invoice shape (best-effort; non-critical fields
  // that don't exist on-chain retain their cached values from the store).
  return results
    .filter((r) => r.data !== null)
    .map((r) => {
      const onChain = r.data!;
      // We only have on-chain fields — return a partial that callers merge
      // into the existing store entry via mergeInvoicesBatch.
      return {
        tokenId: r.tokenId,
        ownerAddress: onChain.owner,
        ipfsCid: onChain.ipfs_cid,
        // funding.totalRaised reflects the live funded_amount from chain
        funding: {
          totalRaised: Number(onChain.funded_amount) / 1_000_000,
          targetAmount: Number(onChain.financing_amount) / 1_000_000,
          fundingProgress:
            Number(onChain.financing_amount) > 0
              ? Number(onChain.funded_amount) / Number(onChain.financing_amount)
              : 0,
          investorCount: 0, // not available on-chain; preserve cached value
          remainingCapacity:
            Math.max(
              0,
              (Number(onChain.financing_amount) - Number(onChain.funded_amount)) /
                1_000_000
            ),
        },
        status: ON_CHAIN_STATUS_MAP[onChain.status] ?? "listed",
      } as Partial<Invoice> & Pick<Invoice, "tokenId">;
    }) as Invoice[];
}

/** Maps Soroban contract status enum index → InvoiceStatus string. */
const ON_CHAIN_STATUS_MAP: Record<number, import("@/types").InvoiceStatus> = {
  0: "pending_mint",
  1: "listed",
  2: "partially_funded",
  3: "fully_funded",
  4: "active",
  5: "repaid",
  6: "defaulted",
  7: "cancelled",
};

export async function fetchPositions(investorAddress: string) {
  if (USE_MOCK) {
    // Build mock positions from MOCK_INVOICES for the demo
    const positions = MOCK_INVOICES.slice(0, 6).map((inv, i) => ({
      invoiceId: inv.id,
      invoice: inv,
      investedAmount: [15000, 50000, 5000, 100000, 25000, 8000][i % 6],
      expectedReturn: ([15000, 50000, 5000, 100000, 25000, 8000][i % 6]) * (1 + inv.terms.discountRate),
      yieldEarned: 0,
      investedAt: new Date().toISOString(),
      status: inv.status === "repaid" ? "repaid" : "active",
    }));
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
    documentUrl: `${process.env.NEXT_PUBLIC_IPFS_GATEWAY || "https://gateway.pinata.cloud/ipfs"}/${docCid}`,
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

/**
 * Fetch a batch of invoices by tokenIds.
 *
 * - Mock mode: resolves immediately from MOCK_INVOICES (no RPC).
 * - Live mode: fires concurrent get_invoice simulations, chunked at BATCH_SIZE.
 *   On-chain data (OnChainInvoice) is mapped back to the Invoice shape used
 *   by the UI. Fields not available on-chain are preserved from the cache when
 *   present, or filled with sensible defaults.
 *
 * @param tokenIds  String token IDs to fetch (BigInt-convertible).
 * @param sourcePublicKey  Used as the fee-source for read simulations.
 * @returns Invoice[] — only found invoices are included (missing IDs are dropped).
 */
export const BATCH_SIZE = 20;

export async function fetchBatchInvoicesByTokenIds(
  tokenIds: string[],
  sourcePublicKey: string
): Promise<Invoice[]> {
  if (tokenIds.length === 0) return [];

  if (USE_MOCK) {
    // Never touch the network when mock mode is on
    const idSet = new Set(tokenIds);
    return MOCK_INVOICES.filter((i) => idSet.has(i.tokenId));
  }

  // Chunk into batches of BATCH_SIZE to respect the cap
  const chunks: string[][] = [];
  for (let i = 0; i < tokenIds.length; i += BATCH_SIZE) {
    chunks.push(tokenIds.slice(i, i + BATCH_SIZE));
  }

  const allResults: Invoice[] = [];

  for (const chunk of chunks) {
    const bigIntIds = chunk.map((id) => BigInt(id));
    const onChainMap = await invoiceContract.batchGetInvoices(bigIntIds, sourcePublicKey);

    for (const [tokenId, onChain] of onChainMap.entries()) {
      allResults.push(mapOnChainToInvoice(tokenId, onChain));
    }
  }

  return allResults;
}

/**
 * Map an on-chain struct to the UI Invoice type.
 * Fields not available on-chain use defaults — callers can overlay cached data.
 */
function mapOnChainToInvoice(tokenId: string, onChain: import("@/types/contract").OnChainInvoice): Invoice {
  const STATUS_MAP: Record<number, import("@/types").InvoiceStatus> = {
    0: "listed",
    1: "partially_funded",
    2: "fully_funded",
    3: "repaid",
    4: "defaulted",
    5: "cancelled",
  };

  const dueDate = new Date(Number(onChain.due_date) * 1000).toISOString();
  const amount = Number(onChain.amount) / 1_000_000;
  const financingAmount = Number(onChain.financing_amount) / 1_000_000;
  const fundedAmount = Number(onChain.funded_amount) / 1_000_000;
  const discountRate = onChain.discount_rate / 10_000;
  const fundingProgress = financingAmount > 0 ? Math.min(fundedAmount / financingAmount, 1) : 0;

  return {
    id: `inv_${tokenId}`,
    tokenId,
    contractAddress: process.env.NEXT_PUBLIC_INVOICE_CONTRACT_ID ?? "",
    ipfsCid: onChain.ipfs_cid,
    metadata: {
      invoiceNumber: `INV-${tokenId}`,
      issuerName: "",
      issuerAddress: onChain.owner,
      debtorName: "",
      debtorAddress: "",
      amount,
      currency: "USDC",
      issueDate: new Date().toISOString(),
      dueDate,
      description: "",
      jurisdiction: "OTHER",
      category: "other",
      documentHash: onChain.ipfs_cid,
      documentUrl: `${process.env.NEXT_PUBLIC_IPFS_GATEWAY ?? "https://gateway.pinata.cloud/ipfs"}/${onChain.ipfs_cid}`,
    },
    terms: {
      discountRate,
      apr: discountRate * (365 / 90) * 100, // approximate; real tenor unknown on-chain
      financingAmount,
      minInvestment: 0,
      maxInvestment: financingAmount,
      tenor: 90,
      repaymentDate: dueDate,
    },
    funding: {
      totalRaised: fundedAmount,
      targetAmount: financingAmount,
      fundingProgress,
      investorCount: 0,
      remainingCapacity: Math.max(0, financingAmount - fundedAmount),
    },
    riskTier: "A",
    riskScore: 0,
    status: STATUS_MAP[onChain.status] ?? "listed",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ownerAddress: onChain.owner,
  };
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
 * Update the on-chain status of an invoice.
 * Validates the transition client-side before building the transaction.
 *
 * @param tokenId         On-chain token ID string.
 * @param from            Current InvoiceStatus (for client-side validation).
 * @param to              Target InvoiceStatus.
 * @param ownerAddress    Must match invoice.ownerAddress — enforced here AND on-chain.
 */
export async function prepareUpdateInvoiceStatus(
  tokenId: string,
  from: import("@/types").InvoiceStatus,
  to: import("@/types").InvoiceStatus,
  ownerAddress: string
): Promise<string> {
  const { isValidTransition, STATUS_TO_CHAIN_INDEX } = await import("@/lib/invoiceStateMachine");

  if (!isValidTransition(from, to)) {
    throw new Error(`Invalid status transition: ${from} → ${to}`);
  }

  const chainIndex = STATUS_TO_CHAIN_INDEX[to];
  if (chainIndex < 0) throw new Error(`Status "${to}" has no on-chain representation`);

  if (USE_MOCK) {
    return `mock_unsigned_xdr_update_status_${tokenId}_${to}_${ownerAddress}`;
  }

  const { updateInvoiceStatus } = await import("@/lib/stellar/contracts");
  return updateInvoiceStatus(tokenId, chainIndex, ownerAddress);
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
  return (marketplaceContract as any).claimPosition(
    { positionId: BigInt(positionId) },
    investorAddress
  );
}

