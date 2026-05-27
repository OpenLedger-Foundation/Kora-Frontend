/**
 * Invoice service — wraps contract calls with mock fallback.
 * Set NEXT_PUBLIC_ENABLE_MOCK_DATA=true to use mock data.
 */
import type { Invoice, CreateInvoiceFormData, PaginatedResponse, MarketplaceFilters, MarketplaceSort } from "@/types";
import { MOCK_INVOICES } from "./mockData";
import { uploadFileToPinata, uploadJsonToPinata } from "@/lib/ipfs";
import { invoiceContract, marketplaceContract } from "@/lib/stellar/contracts";
import { submitTransaction, waitForTransaction } from "@/lib/stellar/client";

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

export async function fetchInvoicesByOwner(ownerAddress: string): Promise<Invoice[]> {
  if (USE_MOCK) {
    return MOCK_INVOICES.filter((i) => i.ownerAddress === ownerAddress);
  }
  throw new Error("Live data fetch not yet implemented");
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
  ownerAddress: string
): Promise<{ unsignedXdr: string; metadataCid: string }> {
  if (!formData.document) throw new Error("Invoice document is required");

  // 1. Upload PDF
  const docCid = await uploadFileToPinata(
    formData.document,
    `invoice-${formData.invoiceNumber}.pdf`
  );

  // 2. Build metadata object and upload
  const metadata = {
    invoiceNumber: formData.invoiceNumber,
    issuerAddress: ownerAddress,
    debtorName: formData.debtorName,
    debtorAddress: formData.debtorAddress,
    amount: formData.amount,
    currency: formData.currency,
    issueDate: formData.issueDate,
    dueDate: formData.dueDate,
    description: formData.description,
    jurisdiction: formData.jurisdiction,
    category: formData.category,
    documentHash: docCid,
    documentUrl: `${process.env.NEXT_PUBLIC_IPFS_GATEWAY}/${docCid}`,
  };

  const metadataCid = await uploadJsonToPinata(
    metadata,
    `invoice-metadata-${formData.invoiceNumber}`
  );

  // 3. Build mint transaction
  const dueTimestamp = BigInt(Math.floor(new Date(formData.dueDate).getTime() / 1000));
  const financingAmount = BigInt(
    Math.round(formData.amount * (1 - formData.discountRate) * 1_000_000)
  );

  const tx = await invoiceContract.mintInvoice(
    {
      ipfsCid: metadataCid,
      amount: BigInt(Math.round(formData.amount * 1_000_000)),
      financingAmount,
      discountRate: Math.round(formData.discountRate * 10_000), // basis points
      dueDate: dueTimestamp,
    },
    ownerAddress
  );

  return { unsignedXdr: tx.toXDR(), metadataCid };
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
  const tx = await marketplaceContract.fundInvoice(
    BigInt(tokenId),
    BigInt(Math.round(amount * 1_000_000)),
    investorAddress
  );
  return tx.toXDR();
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
