/**
 * Invoice service — factory pattern supporting mock and live Soroban contracts.
 * Set NEXT_PUBLIC_ENABLE_MOCK_DATA=true to use mock data.
 */
import type {
  Invoice,
  CreateInvoiceFormData,
  PaginatedResponse,
  MarketplaceFilters,
  MarketplaceSort,
  InvoicePosition,
  IInvoiceService,
  ServiceError,
  Result,
} from "@/types";
import { MOCK_INVOICES } from "./mockData";
import { uploadFileToPinata, uploadInvoiceMetadata } from "@/lib/ipfs";
import { invoiceContract, marketplaceContract } from "@/lib/stellar/contracts";
import { submitTransaction, waitForTransaction } from "@/lib/stellar/client";
import { sanitizeIpfsMetadata } from "@/lib/security";
import { env } from "@/lib/env";

// ─── Helper: Create successful result ──────────────────────────────────────
function success<T>(value: T): Result<T> {
  return { ok: true, value };
}

// ─── Helper: Create error result ──────────────────────────────────────────
function failure(code: string, message: string, details?: Record<string, unknown>): Result<never> {
  return { ok: false, error: { code, message, details } };
}

// ─── Helper: Map contract errors to user-friendly messages ────────────────
function mapContractError(error: unknown): ServiceError {
  const message = error instanceof Error ? error.message : String(error);
  if (message.includes("Invoice not found")) {
    return { code: "NOT_FOUND", message: "Invoice not found" };
  }
  if (message.includes("Insufficient balance")) {
    return { code: "INSUFFICIENT_BALANCE", message: "Insufficient balance to fund this invoice" };
  }
  if (message.includes("Unauthorized")) {
    return { code: "UNAUTHORIZED", message: "You do not have permission to perform this action" };
  }
  if (message.includes("already funded")) {
    return { code: "ALREADY_FUNDED", message: "This invoice has already been funded" };
  }
  if (message.includes("already been repaid")) {
    return { code: "ALREADY_REPAID", message: "This invoice has already been repaid" };
  }
  return { code: "CONTRACT_ERROR", message: `Contract error: ${message}` };
}

// ─── Mock Invoice Service ─────────────────────────────────────────────────
class MockInvoiceService implements IInvoiceService {
  private readonly MOCK_DELAY = 300; // ms

  private delay(): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, this.MOCK_DELAY));
  }

  async getInvoices(
    filters: MarketplaceFilters = {},
    sort: MarketplaceSort = { key: "apr", direction: "desc" },
    page = 1,
    pageSize = 12
  ): Promise<Result<PaginatedResponse<Invoice>>> {
    try {
      await this.delay();
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
          case "apr":
            aVal = a.terms.apr;
            bVal = b.terms.apr;
            break;
          case "amount":
            aVal = a.metadata.amount;
            bVal = b.metadata.amount;
            break;
          case "duration":
            aVal = a.terms.tenor;
            bVal = b.terms.tenor;
            break;
          case "riskScore":
            aVal = a.riskScore;
            bVal = b.riskScore;
            break;
          default:
            aVal = new Date(a.createdAt).getTime();
            bVal = new Date(b.createdAt).getTime();
        }
        return sort.direction === "asc" ? aVal - bVal : bVal - aVal;
      });

      const start = (page - 1) * pageSize;
      return success({
        data: data.slice(start, start + pageSize),
        total: data.length,
        page,
        pageSize,
        hasMore: start + pageSize < data.length,
      });
    } catch (error) {
      return failure("FETCH_ERROR", "Failed to fetch invoices", { cause: String(error) });
    }
  }

  async getInvoice(id: string): Promise<Result<Invoice | null>> {
    try {
      await this.delay();
      return success(MOCK_INVOICES.find((i) => i.id === id) ?? null);
    } catch (error) {
      return failure("FETCH_ERROR", "Failed to fetch invoice", { cause: String(error) });
    }
  }

  async getInvoicesByOwner(ownerAddress: string): Promise<Result<Invoice[]>> {
    try {
      await this.delay();
      return success(MOCK_INVOICES.filter((i) => i.ownerAddress === ownerAddress));
    } catch (error) {
      return failure("FETCH_ERROR", "Failed to fetch invoices by owner", { cause: String(error) });
    }
  }

  async getPositions(investorAddress: string): Promise<Result<InvoicePosition[]>> {
    try {
      await this.delay();
      const amounts = [15000, 50000, 5000, 100000, 25000, 8000];
      const positions = MOCK_INVOICES.slice(0, 6).map((inv, i) => {
        const invested = amounts[i % 6];
        const isRepaid = inv.status === "repaid" || i === 1;
        const yieldEarned = isRepaid ? Math.round(invested * inv.terms.discountRate) : 0;
        return {
          invoiceId: inv.id,
          invoice: inv,
          investedAmount: invested,
          expectedReturn: invested * (1 + inv.terms.discountRate),
          yieldEarned,
          investedAt: new Date().toISOString(),
          status: (isRepaid ? "repaid" : "active") as const,
        };
      });
      return success(positions);
    } catch (error) {
      return failure("FETCH_ERROR", "Failed to fetch positions", { cause: String(error) });
    }
  }

  async getIpfsMetadata(cid: string): Promise<Result<Record<string, unknown>>> {
    try {
      const gateway = env.NEXT_PUBLIC_IPFS_GATEWAY;
      if (!/^[a-zA-Z0-9+/=_-]{10,100}$/.test(cid)) {
        return failure("INVALID_CID", "Invalid IPFS CID format");
      }
      const res = await fetch(`${gateway}/${cid}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return failure("IPFS_ERROR", `IPFS fetch failed with status ${res.status}`);
      }
      const raw: unknown = await res.json();
      const sanitized = sanitizeIpfsMetadata(raw);
      return success(sanitized);
    } catch (error) {
      return failure("IPFS_ERROR", "Failed to fetch IPFS metadata", { cause: String(error) });
    }
  }

  async createInvoice(
    formData: CreateInvoiceFormData,
    ownerAddress: string,
    onProgress?: (progress: number) => void
  ): Promise<Result<{ unsignedXdr: string; metadataCid: string }>> {
    try {
      await this.delay();
      if (!formData.document) {
        return failure("INVALID_FORM", "Invoice document is required");
      }
      onProgress?.(33);
      const mockDocCid = `mock_doc_${Date.now()}`;
      onProgress?.(66);
      const mockMetadataCid = `mock_metadata_${Date.now()}`;
      onProgress?.(100);
      return success({
        unsignedXdr: `mock_unsigned_xdr_create_${Date.now()}`,
        metadataCid: mockMetadataCid,
      });
    } catch (error) {
      return failure("CREATE_ERROR", "Failed to prepare invoice creation", { cause: String(error) });
    }
  }

  async fundInvoice(
    tokenId: string,
    amount: number,
    investorAddress: string
  ): Promise<Result<string>> {
    try {
      await this.delay();
      return success(`mock_unsigned_xdr_fund_${tokenId}_${amount}_${investorAddress}`);
    } catch (error) {
      return failure("FUND_ERROR", "Failed to prepare invoice funding", { cause: String(error) });
    }
  }

  async repayInvoice(
    tokenId: string,
    ownerAddress: string,
    invoiceOwnerAddress?: string
  ): Promise<Result<string>> {
    try {
      if (
        invoiceOwnerAddress &&
        ownerAddress.toLowerCase() !== invoiceOwnerAddress.toLowerCase()
      ) {
        return failure("UNAUTHORIZED", "Caller is not the invoice owner");
      }
      await this.delay();
      return success(`mock_unsigned_xdr_repay_${tokenId}_${ownerAddress}`);
    } catch (error) {
      return failure("REPAY_ERROR", "Failed to prepare invoice repayment", { cause: String(error) });
    }
  }

  async claimPosition(positionId: string, investorAddress: string): Promise<Result<string>> {
    try {
      await this.delay();
      return success(`mock_unsigned_xdr_claim_${positionId}_${investorAddress}`);
    } catch (error) {
      return failure("CLAIM_ERROR", "Failed to prepare position claim", { cause: String(error) });
    }
  }

  async cancelInvoice(tokenId: string, ownerAddress: string): Promise<Result<string>> {
    try {
      await this.delay();
      return success(`mock_unsigned_xdr_cancel_${tokenId}_${ownerAddress}`);
    } catch (error) {
      return failure("CANCEL_ERROR", "Failed to prepare invoice cancellation", { cause: String(error) });
    }
  }

  async submitTransaction(signedXdr: string): Promise<Result<string>> {
    try {
      await this.delay();
      return success(
        Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join("")
      );
    } catch (error) {
      return failure("SUBMIT_ERROR", "Failed to submit transaction", { cause: String(error) });
    }
  }
}

// ─── Live Invoice Service ─────────────────────────────────────────────────
class LiveInvoiceService implements IInvoiceService {
  async getInvoices(
    filters: MarketplaceFilters = {},
    sort: MarketplaceSort = { key: "apr", direction: "desc" },
    page = 1,
    pageSize = 12
  ): Promise<Result<PaginatedResponse<Invoice>>> {
    try {
      // TODO: Replace with on-chain / indexer fetch
      throw new Error("Live invoice fetch not yet implemented");
    } catch (error) {
      return failure("NOT_IMPLEMENTED", "Live invoice fetching is not yet implemented");
    }
  }

  async getInvoice(id: string): Promise<Result<Invoice | null>> {
    try {
      // TODO: Replace with on-chain fetch
      throw new Error("Live invoice fetch not yet implemented");
    } catch (error) {
      return failure("NOT_IMPLEMENTED", "Live invoice fetching is not yet implemented");
    }
  }

  async getInvoicesByOwner(ownerAddress: string): Promise<Result<Invoice[]>> {
    try {
      // TODO: Replace with on-chain fetch
      throw new Error("Live invoice fetch not yet implemented");
    } catch (error) {
      return failure("NOT_IMPLEMENTED", "Live invoice fetching is not yet implemented");
    }
  }

  async getPositions(investorAddress: string): Promise<Result<InvoicePosition[]>> {
    try {
      // TODO: Replace with on-chain fetch
      throw new Error("Live positions fetch not yet implemented");
    } catch (error) {
      return failure("NOT_IMPLEMENTED", "Live positions fetching is not yet implemented");
    }
  }

  async getIpfsMetadata(cid: string): Promise<Result<Record<string, unknown>>> {
    try {
      const gateway = env.NEXT_PUBLIC_IPFS_GATEWAY;
      if (!/^[a-zA-Z0-9+/=_-]{10,100}$/.test(cid)) {
        return failure("INVALID_CID", "Invalid IPFS CID format");
      }
      const res = await fetch(`${gateway}/${cid}`, { signal: AbortSignal.timeout(10_000) });
      if (!res.ok) {
        return failure("IPFS_ERROR", `IPFS fetch failed with status ${res.status}`);
      }
      const raw: unknown = await res.json();
      const sanitized = sanitizeIpfsMetadata(raw);
      return success(sanitized);
    } catch (error) {
      return failure("IPFS_ERROR", "Failed to fetch IPFS metadata", { cause: String(error) });
    }
  }

  async createInvoice(
    formData: CreateInvoiceFormData,
    ownerAddress: string,
    onProgress?: (progress: number) => void
  ): Promise<Result<{ unsignedXdr: string; metadataCid: string }>> {
    try {
      if (!formData.document) {
        return failure("INVALID_FORM", "Invoice document is required");
      }

      onProgress?.(25);
      const docCid = await uploadFileToPinata(
        formData.document,
        `invoice-${formData.invoiceNumber}.pdf`,
        ownerAddress,
        onProgress
      );

      onProgress?.(50);
      const daysToMaturity = Math.ceil(
        (new Date(formData.dueDate).getTime() -
          new Date(formData.listingExpiryDate).getTime()) /
          (1000 * 60 * 60 * 24)
      );
      const effectiveAPR =
        daysToMaturity > 0 && formData.discountRate > 0 && formData.discountRate < 1
          ? (formData.discountRate / (1 - formData.discountRate)) * (365 / daysToMaturity) * 100
          : 0;

      const metadata = {
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
        invoiceNumber: formData.invoiceNumber,
        issuerName: ownerAddress,
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

      onProgress?.(75);
      const metadataCid = await uploadInvoiceMetadata(metadata, ownerAddress);

      onProgress?.(85);
      const dueTimestamp = BigInt(
        Math.floor(new Date(formData.dueDate).getTime() / 1000)
      );
      const financingAmount = BigInt(
        Math.round(formData.amount * (1 - formData.discountRate) * 1_000_000)
      );

      const unsignedXdr = await invoiceContract.mintInvoice(
        {
          ipfsCid: metadataCid,
          amount: BigInt(Math.round(formData.amount * 1_000_000)),
          financingAmount,
          discountRate: Math.round(formData.discountRate * 10_000),
          dueDate: dueTimestamp,
        },
        ownerAddress
      );

      onProgress?.(100);
      return success({ unsignedXdr, metadataCid });
    } catch (error) {
      const err = mapContractError(error);
      return failure(err.code, err.message, err.details);
    }
  }

  async fundInvoice(
    tokenId: string,
    amount: number,
    investorAddress: string
  ): Promise<Result<string>> {
    try {
      const xdr = await marketplaceContract.fundInvoice(
        { tokenId: BigInt(tokenId), amount: BigInt(Math.round(amount * 1_000_000)) },
        investorAddress
      );
      return success(xdr);
    } catch (error) {
      const err = mapContractError(error);
      return failure(err.code, err.message, err.details);
    }
  }

  async repayInvoice(
    tokenId: string,
    ownerAddress: string,
    invoiceOwnerAddress?: string
  ): Promise<Result<string>> {
    try {
      if (
        invoiceOwnerAddress &&
        ownerAddress.toLowerCase() !== invoiceOwnerAddress.toLowerCase()
      ) {
        return failure("UNAUTHORIZED", "Caller is not the invoice owner");
      }

      const xdr = await marketplaceContract.repayInvoice(
        { tokenId: BigInt(tokenId) },
        ownerAddress
      );
      return success(xdr);
    } catch (error) {
      const err = mapContractError(error);
      return failure(err.code, err.message, err.details);
    }
  }

  async claimPosition(positionId: string, investorAddress: string): Promise<Result<string>> {
    try {
      const xdr = await marketplaceContract.claimYield(
        { tokenId: BigInt(positionId) },
        investorAddress
      );
      return success(xdr);
    } catch (error) {
      const err = mapContractError(error);
      return failure(err.code, err.message, err.details);
    }
  }

  async cancelInvoice(tokenId: string, ownerAddress: string): Promise<Result<string>> {
    try {
      const xdr = await marketplaceContract.cancelInvoice(
        { tokenId: BigInt(tokenId) },
        ownerAddress
      );
      return success(xdr);
    } catch (error) {
      const err = mapContractError(error);
      return failure(err.code, err.message, err.details);
    }
  }

  async submitTransaction(signedXdr: string): Promise<Result<string>> {
    try {
      const result = await submitTransaction(signedXdr);
      if (result.status === "ERROR") {
        return failure("SUBMISSION_ERROR", "Transaction submission failed", { hash: result.hash });
      }
      const confirmed = await waitForTransaction(result.hash);
      if (confirmed.status !== "SUCCESS") {
        return failure("CONFIRMATION_ERROR", "Transaction failed on-chain", { hash: result.hash });
      }
      return success(result.hash);
    } catch (error) {
      return failure("SUBMIT_ERROR", "Failed to submit transaction", { cause: String(error) });
    }
  }
}

// ─── Factory Function ─────────────────────────────────────────────────────
export function createInvoiceService(): IInvoiceService {
  if (env.NEXT_PUBLIC_ENABLE_MOCK_DATA) {
    return new MockInvoiceService();
  }
  return new LiveInvoiceService();
}

// ─── Backward Compatibility Functions (legacy API) ──────────────────────
const service = createInvoiceService();

export async function fetchInvoices(
  filters?: MarketplaceFilters,
  sort?: MarketplaceSort,
  page?: number,
  pageSize?: number
): Promise<PaginatedResponse<Invoice>> {
  const result = await service.getInvoices(filters, sort, page, pageSize);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function fetchInvoiceById(id: string): Promise<Invoice | null> {
  const result = await service.getInvoice(id);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function fetchIpfsMetadata(cid: string): Promise<Record<string, unknown>> {
  const result = await service.getIpfsMetadata(cid);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function fetchInvoicesByOwner(ownerAddress: string): Promise<Invoice[]> {
  const result = await service.getInvoicesByOwner(ownerAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function fetchPositions(investorAddress: string) {
  const result = await service.getPositions(investorAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function prepareCreateInvoice(
  formData: CreateInvoiceFormData,
  ownerAddress: string,
  onProgress?: (progress: number) => void
): Promise<{ unsignedXdr: string; metadataCid: string }> {
  const result = await service.createInvoice(formData, ownerAddress, onProgress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function prepareFundInvoice(
  tokenId: string,
  amount: number,
  investorAddress: string
): Promise<string> {
  const result = await service.fundInvoice(tokenId, amount, investorAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function prepareRepayInvoice(
  tokenId: string,
  ownerAddress: string,
  invoiceOwnerAddress?: string
): Promise<string> {
  const result = await service.repayInvoice(tokenId, ownerAddress, invoiceOwnerAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function prepareClaimPosition(
  positionId: string,
  investorAddress: string
): Promise<string> {
  const result = await service.claimPosition(positionId, investorAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function prepareCancelInvoice(
  tokenId: string,
  ownerAddress: string
): Promise<string> {
  const result = await service.cancelInvoice(tokenId, ownerAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function submitAndConfirm(signedXdr: string): Promise<string> {
  const result = await service.submitTransaction(signedXdr);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}

export async function fetchInvestorPositions(
  investorAddress: string
): Promise<InvoicePosition[]> {
  const result = await service.getPositions(investorAddress);
  if (!result.ok) throw new Error(result.error.message);
  return result.value;
}


