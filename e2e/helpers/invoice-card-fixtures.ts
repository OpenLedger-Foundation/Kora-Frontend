/**
 * e2e/helpers/invoice-card-fixtures.ts
 *
 * Deterministic, fully-static Invoice fixtures for visual regression tests.
 *
 * Rules:
 *  - ALL dates are hard-coded ISO strings (never `new Date()`)
 *  - `listingExpiry` is omitted on all variants so CountdownTimer never renders
 *  - `funding` values are static percentages so the progress bar is pixel-stable
 *  - Amounts, APR, tenor are fixed — nothing seeded from runtime
 */

import type { Invoice } from "@/types";

/** Shared contract / IPFS stubs — not rendered in the card UI */
const CONTRACT = "CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAABSC4";
const IPFS = "QmXoypizjW3WknFiJnKLwHCnL72vedxjQkDDP1mXWo6uco";
const OWNER = "GBVZQ4YWKJXQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQKZQ";

// ─── Active ───────────────────────────────────────────────────────────────────
export const FIXTURE_ACTIVE: Invoice = {
  id: "vr-active",
  tokenId: "vr-1",
  contractAddress: CONTRACT,
  ipfsCid: IPFS,
  metadata: {
    invoiceNumber: "INV-VR-0001",
    issuerName: "TechBridge Solutions Ltd",
    issuerAddress: OWNER,
    debtorName: "Safaricom PLC",
    debtorAddress: "Safaricom House, Nairobi, Kenya",
    amount: 250000,
    currency: "USDC",
    issueDate: "2025-01-01",
    dueDate: "2025-07-01",
    description: "Enterprise software services Q1 2025",
    jurisdiction: "KE",
    category: "technology",
    documentHash: IPFS,
    documentUrl: `https://gateway.pinata.cloud/ipfs/${IPFS}`,
  },
  terms: {
    discountRate: 0.06,
    apr: 24.5,
    financingAmount: 235000,
    minInvestment: 1000,
    maxInvestment: 50000,
    tenor: 92,
    repaymentDate: "2025-07-01",
  },
  funding: {
    totalRaised: 141000,
    targetAmount: 235000,
    fundingProgress: 0.6,
    investorCount: 14,
    remainingCapacity: 94000,
  },
  riskTier: "A",
  riskScore: 78,
  debtorPrivacy: "full",
  status: "active",
  createdAt: "2025-01-05T10:30:00Z",
  updatedAt: "2025-01-20T14:22:00Z",
  ownerAddress: OWNER,
};

// ─── Funded (fully_funded) ────────────────────────────────────────────────────
export const FIXTURE_FUNDED: Invoice = {
  id: "vr-funded",
  tokenId: "vr-2",
  contractAddress: CONTRACT,
  ipfsCid: IPFS,
  metadata: {
    invoiceNumber: "INV-VR-0002",
    issuerName: "AgriFlow Exports Ghana",
    issuerAddress: OWNER,
    debtorName: "Olam International",
    debtorAddress: "9 Temasek Boulevard, Singapore",
    amount: 500000,
    currency: "USDC",
    issueDate: "2025-01-10",
    dueDate: "2025-04-10",
    description: "Cocoa export shipment — 200MT, Q1 2025",
    jurisdiction: "GH",
    category: "agriculture",
    documentHash: IPFS,
    documentUrl: `https://gateway.pinata.cloud/ipfs/${IPFS}`,
  },
  terms: {
    discountRate: 0.04,
    apr: 18.2,
    financingAmount: 480000,
    minInvestment: 5000,
    maxInvestment: 100000,
    tenor: 90,
    repaymentDate: "2025-04-10",
  },
  funding: {
    totalRaised: 480000,
    targetAmount: 480000,
    fundingProgress: 1.0,
    investorCount: 22,
    remainingCapacity: 0,
  },
  riskTier: "AA",
  riskScore: 88,
  debtorPrivacy: "partial",
  status: "fully_funded",
  createdAt: "2025-01-12T08:00:00Z",
  updatedAt: "2025-01-25T16:45:00Z",
  ownerAddress: OWNER,
};

// ─── Repaid ───────────────────────────────────────────────────────────────────
export const FIXTURE_REPAID: Invoice = {
  id: "vr-repaid",
  tokenId: "vr-3",
  contractAddress: CONTRACT,
  ipfsCid: IPFS,
  metadata: {
    invoiceNumber: "INV-VR-0003",
    issuerName: "MediSupply Nigeria",
    issuerAddress: OWNER,
    debtorName: "Lagos State Ministry of Health",
    debtorAddress: "Secretariat, Alausa, Ikeja, Lagos",
    amount: 120000,
    currency: "USDC",
    issueDate: "2024-11-01",
    dueDate: "2025-02-01",
    description: "Medical equipment supply — Q4 2024 batch",
    jurisdiction: "NG",
    category: "healthcare",
    documentHash: IPFS,
    documentUrl: `https://gateway.pinata.cloud/ipfs/${IPFS}`,
  },
  terms: {
    discountRate: 0.08,
    apr: 32.1,
    financingAmount: 110400,
    minInvestment: 500,
    maxInvestment: 25000,
    tenor: 92,
    repaymentDate: "2025-02-01",
  },
  funding: {
    totalRaised: 110400,
    targetAmount: 110400,
    fundingProgress: 1.0,
    investorCount: 8,
    remainingCapacity: 0,
  },
  riskTier: "BBB",
  riskScore: 62,
  debtorPrivacy: "anonymized",
  status: "repaid",
  createdAt: "2024-11-05T12:00:00Z",
  updatedAt: "2025-02-02T09:10:00Z",
  ownerAddress: OWNER,
};

// ─── Overdue (active + past repaymentDate) ────────────────────────────────────
export const FIXTURE_OVERDUE: Invoice = {
  id: "vr-overdue",
  tokenId: "vr-4",
  contractAddress: CONTRACT,
  ipfsCid: IPFS,
  metadata: {
    invoiceNumber: "INV-VR-0004",
    issuerName: "BuildRight Construction SA",
    issuerAddress: OWNER,
    debtorName: "Transnet SOC Ltd",
    debtorAddress: "Carlton Centre, 150 Commissioner St, Johannesburg",
    amount: 1200000,
    currency: "USDC",
    issueDate: "2024-06-01",
    dueDate: "2024-10-01",
    description: "Infrastructure civil works — Phase 2 completion",
    jurisdiction: "ZA",
    category: "construction",
    documentHash: IPFS,
    documentUrl: `https://gateway.pinata.cloud/ipfs/${IPFS}`,
  },
  terms: {
    discountRate: 0.035,
    apr: 15.8,
    financingAmount: 1158000,
    minInvestment: 10000,
    maxInvestment: 250000,
    tenor: 122,
    // Past date → "overdue" state
    repaymentDate: "2024-10-01",
  },
  funding: {
    totalRaised: 1158000,
    targetAmount: 1158000,
    fundingProgress: 1.0,
    investorCount: 31,
    remainingCapacity: 0,
  },
  riskTier: "AA",
  riskScore: 85,
  debtorPrivacy: "full",
  status: "active",
  createdAt: "2024-06-05T07:30:00Z",
  updatedAt: "2024-10-10T11:00:00Z",
  ownerAddress: OWNER,
};

// ─── Cancelled ────────────────────────────────────────────────────────────────
export const FIXTURE_CANCELLED: Invoice = {
  id: "vr-cancelled",
  tokenId: "vr-5",
  contractAddress: CONTRACT,
  ipfsCid: IPFS,
  metadata: {
    invoiceNumber: "INV-VR-0005",
    issuerName: "SolarGrid Energy Ltd",
    issuerAddress: OWNER,
    debtorName: "Kenya Power & Lighting Co.",
    debtorAddress: "Stima Plaza, Kolobot Road, Nairobi",
    amount: 750000,
    currency: "USDC",
    issueDate: "2024-09-01",
    dueDate: "2025-02-01",
    description: "Solar panel installation — 5MW rural electrification",
    jurisdiction: "KE",
    category: "energy",
    documentHash: IPFS,
    documentUrl: `https://gateway.pinata.cloud/ipfs/${IPFS}`,
  },
  terms: {
    discountRate: 0.045,
    apr: 21.3,
    financingAmount: 716250,
    minInvestment: 2500,
    maxInvestment: 150000,
    tenor: 153,
    repaymentDate: "2025-02-01",
  },
  funding: {
    totalRaised: 0,
    targetAmount: 716250,
    fundingProgress: 0,
    investorCount: 0,
    remainingCapacity: 716250,
  },
  riskTier: "A",
  riskScore: 74,
  debtorPrivacy: "anonymized",
  status: "cancelled",
  createdAt: "2024-09-03T09:00:00Z",
  updatedAt: "2024-09-20T13:30:00Z",
  ownerAddress: OWNER,
};

/** All five card variants in render order */
export const ALL_FIXTURES = [
  { name: "active", fixture: FIXTURE_ACTIVE },
  { name: "funded", fixture: FIXTURE_FUNDED },
  { name: "repaid", fixture: FIXTURE_REPAID },
  { name: "overdue", fixture: FIXTURE_OVERDUE },
  { name: "cancelled", fixture: FIXTURE_CANCELLED },
] as const;
