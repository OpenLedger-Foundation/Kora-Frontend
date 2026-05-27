// ─── Invoice Types ────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | "draft"
  | "pending_mint"
  | "listed"
  | "partially_funded"
  | "fully_funded"
  | "active"
  | "repaid"
  | "defaulted"
  | "cancelled";

export type RiskTier = "AAA" | "AA" | "A" | "BBB" | "BB" | "B" | "CCC";

export type InvoiceCurrency = "USDC" | "EURC" | "XLM";

export type InvoiceJurisdiction = "US" | "EU" | "UK" | "NG" | "KE" | "GH" | "ZA" | "OTHER";

export type InvoiceCategory =
  | "technology"
  | "manufacturing"
  | "logistics"
  | "healthcare"
  | "retail"
  | "construction"
  | "agriculture"
  | "energy"
  | "finance"
  | "other";

export interface InvoiceMetadata {
  invoiceNumber: string;
  issuerName: string;
  issuerAddress: string;
  debtorName: string;
  debtorAddress: string;
  amount: number;
  currency: InvoiceCurrency;
  issueDate: string; // ISO 8601
  dueDate: string; // ISO 8601
  description: string;
  jurisdiction: InvoiceJurisdiction;
  category: InvoiceCategory;
  documentHash: string; // IPFS CID of the PDF
  documentUrl: string;
}

export interface InvoiceFinancingTerms {
  discountRate: number; // e.g. 0.05 = 5%
  apr: number; // annualised percentage rate
  financingAmount: number; // amount being raised (< invoice amount)
  minInvestment: number;
  maxInvestment: number;
  tenor: number; // days until repayment
  repaymentDate: string; // ISO 8601
}

export interface InvoiceFunding {
  totalRaised: number;
  targetAmount: number;
  fundingProgress: number; // 0–1
  investorCount: number;
  remainingCapacity: number;
}

export interface Invoice {
  id: string;
  tokenId: string; // on-chain NFT token ID
  contractAddress: string;
  ipfsCid: string;
  metadata: InvoiceMetadata;
  terms: InvoiceFinancingTerms;
  funding: InvoiceFunding;
  riskTier: RiskTier;
  riskScore: number; // 0–100
  status: InvoiceStatus;
  createdAt: string;
  updatedAt: string;
  ownerAddress: string; // SME wallet
  txHash?: string; // mint transaction
}

export interface InvoicePosition {
  invoiceId: string;
  invoice: Invoice;
  investedAmount: number;
  expectedReturn: number;
  yieldEarned: number;
  investedAt: string;
  status: "active" | "repaid" | "defaulted";
}

// ─── Create Invoice Form ──────────────────────────────────────────────────────

export interface CreateInvoiceFormData {
  invoiceNumber: string;
  debtorName: string;
  debtorAddress: string;
  amount: number;
  currency: InvoiceCurrency;
  issueDate: string;
  dueDate: string;
  description: string;
  jurisdiction: InvoiceJurisdiction;
  category: InvoiceCategory;
  discountRate: number;
  minInvestment: number;
  listingExpiryDate: string;
  document: File | null;
}
