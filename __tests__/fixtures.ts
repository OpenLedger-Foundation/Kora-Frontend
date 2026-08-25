/**
 * Test fixtures and factories for invoice and wallet mocks
 */

import type { Invoice, InvoiceStatus } from "@/types";

/**
 * Factory function to create a mock invoice with sensible defaults
 */
export function createMockInvoice(
  overrides: Partial<Invoice> = {}
): Invoice {
  const defaultInvoice: Invoice = {
    id: `inv_${Math.random().toString(36).substr(2, 9)}`,
    tokenId: "1",
    contractAddress: "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4",
    ipfsCid: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    metadata: {
      invoiceNumber: "INV-2024-0891",
      issuerName: "TechBridge Solutions Ltd",
      issuerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
      debtorName: "Safaricom PLC",
      debtorAddress: "Safaricom House, Waiyaki Way, Nairobi, Kenya",
      amount: 250000,
      currency: "USDC",
      issueDate: "2024-11-01",
      dueDate: "2025-02-01",
      description: "Enterprise software development services Q4 2024",
      jurisdiction: "KE",
      category: "technology",
      documentHash: "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
      documentUrl: "https://gateway.pinata.cloud/ipfs/QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco",
    },
    terms: {
      discountRate: 0.06,
      apr: 24.5,
      financingAmount: 235000,
      minInvestment: 1000,
      maxInvestment: 50000,
      tenor: 92,
      repaymentDate: "2025-02-01",
    },
    funding: {
      totalRaised: 188000,
      targetAmount: 235000,
      fundingProgress: 0.8,
      investorCount: 14,
      remainingCapacity: 47000,
    },
    riskTier: "A",
    riskScore: 78,
    status: "partially_funded" as InvoiceStatus,
    createdAt: "2024-11-05T10:30:00Z",
    updatedAt: "2024-11-20T14:22:00Z",
    ownerAddress: "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ",
    txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2",
  };

  return {
    ...defaultInvoice,
    ...overrides,
    metadata: {
      ...defaultInvoice.metadata,
      ...overrides.metadata,
    },
    terms: {
      ...defaultInvoice.terms,
      ...overrides.terms,
    },
    funding: {
      ...defaultInvoice.funding,
      ...overrides.funding,
    },
  };
}

/**
 * Create a list of varied mock invoices for marketplace testing
 */
export function createMockInvoices(count: number = 5): Invoice[] {
  const categories: Array<Invoice['metadata']['category']> = [
    "technology",
    "agriculture",
    "healthcare",
    "construction",
    "logistics",
  ];
  const jurisdictions: Array<Invoice['metadata']['jurisdiction']> = [
    "KE",
    "NG",
    "GH",
    "ZA",
    "US",
  ];
  const risks: Array<Invoice['riskTier']> = ["AAA", "AA", "A", "BBB", "BB"];

  const invoices: Invoice[] = [];

  for (let i = 0; i < count; i++) {
    const apr = 10 + Math.random() * 40;
    const totalRaised = Math.floor(Math.random() * 200000);
    const targetAmount = 200000 + Math.floor(Math.random() * 100000);

    invoices.push(
      createMockInvoice({
        id: `inv_${String(i).padStart(3, "0")}`,
        metadata: {
          invoiceNumber: `INV-2024-${String(i).padStart(4, "0")}`,
          debtorName: `Company ${i + 1}`,
          amount: targetAmount,
          category: categories[i % categories.length],
          jurisdiction: jurisdictions[i % jurisdictions.length],
        },
        terms: {
          apr,
          financingAmount: targetAmount,
          minInvestment: 500 + Math.floor(Math.random() * 2000),
        },
        funding: {
          totalRaised,
          targetAmount,
          fundingProgress: totalRaised / targetAmount,
          investorCount: Math.floor(Math.random() * 50),
          remainingCapacity: targetAmount - totalRaised,
        },
        riskTier: risks[i % risks.length],
        status: i % 3 === 0 ? "listed" : i % 3 === 1 ? "partially_funded" : "fully_funded",
      })
    );
  }

  return invoices;
}

/**
 * Mock wallet state
 */
export const mockWalletConnected = {
  address: "GBUQWP3BOUZX34LOCALCHIP4GEZ6YR4Z5WJGVSQ3XZPMPERJ7D7NONPC",
  publicKey: "GBUQWP3BOUZX34LOCALCHIP4GEZ6YR4Z5WJGVSQ3XZPMPERJ7D7NONPC",
  isConnected: true,
  provider: "freighter" as const,
  balance: {
    xlm: "100",
    usdc: "50000",
    eurc: "0",
  },
};

export const mockWalletDisconnected = {
  address: null,
  publicKey: null,
  isConnected: false,
  provider: null,
  balance: null,
};

/**
 * Mock transaction hook state
 */
export const mockTransactionIdle = {
  status: "idle" as const,
  txHash: undefined,
  error: undefined,
};

export const mockTransactionSigning = {
  status: "signing" as const,
  txHash: undefined,
  error: undefined,
};

export const mockTransactionSuccess = {
  status: "confirmed" as const,
  txHash: "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6",
  error: undefined,
};

export const mockTransactionFailed = {
  status: "failed" as const,
  txHash: undefined,
  error: "Transaction rejected by user",
};
