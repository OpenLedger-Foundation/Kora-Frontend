// ─── Soroban Contract Types ───────────────────────────────────────────────────

export interface ContractConfig {
  invoiceContractId: string;
  marketplaceContractId: string;
  tokenContractId: string;
  rpcUrl: string;
  networkPassphrase: string;
}

export type TxStatus = "idle" | "building" | "signing" | "submitting" | "success" | "error";

export interface TxState {
  status: TxStatus;
  hash?: string;
  error?: string;
}

// Mirrors the on-chain Invoice struct from the Soroban contract
export interface OnChainInvoice {
  token_id: bigint;
  owner: string;
  ipfs_cid: string;
  amount: bigint; // in stroops / smallest unit
  financing_amount: bigint;
  discount_rate: number; // basis points
  due_date: bigint; // Unix timestamp
  status: number; // enum index
  funded_amount: bigint;
}

export interface MintInvoiceParams {
  ipfsCid: string;
  amount: bigint;
  financingAmount: bigint;
  discountRate: number;
  dueDate: bigint;
}

export interface FundInvoiceParams {
  tokenId: bigint;
  amount: bigint;
}

export interface RepayInvoiceParams {
  tokenId: bigint;
}

export interface UpdateInvoiceStatusParams {
  tokenId: bigint;
  status: OnChainStatusCode;
}

/**
 * Numeric status codes as stored on-chain.
 * Keep in sync with ON_CHAIN_STATUS_MAP in invoiceService.ts.
 */
export const OnChainStatus = {
  PendingMint: 0,
  Listed: 1,
  PartiallyFunded: 2,
  FullyFunded: 3,
  Active: 4,
  Repaid: 5,
  Defaulted: 6,
  Cancelled: 7,
} as const;

export type OnChainStatusCode = (typeof OnChainStatus)[keyof typeof OnChainStatus];

// ─── API Response Wrappers ────────────────────────────────────────────────────

export interface ApiResponse<T> {
  data: T;
  success: boolean;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}

// ─── Filter / Sort Types ──────────────────────────────────────────────────────

export interface MarketplaceFilters {
  category?: string;
  jurisdiction?: string;
  riskTier?: string;
  currency?: string;
  minApr?: number;
  maxApr?: number;
  minAmount?: number;
  maxAmount?: number;
  status?: string;

  // Extended UI filter fields
  categories?: string[];
  jurisdictions?: string[];
  riskTiers?: string[];
  aprRange?: [number, number];
  activeOnly?: boolean;
}

export type MarketplaceSortKey = "apr" | "amount" | "duration" | "riskScore" | "createdAt";
export type SortDirection = "asc" | "desc";

export interface MarketplaceSort {
  key: MarketplaceSortKey;
  direction: SortDirection;
}
