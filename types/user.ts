// ─── Wallet / User Types ──────────────────────────────────────────────────────

export type UserRole = "sme" | "investor" | "admin";

export type WalletProvider =
  | "freighter"
  | "xbull"
  | "albedo"
  | "rabet"
  | "lobstr"
  | "hana";

export type WalletNetwork = "testnet" | "mainnet" | "futurenet";
export interface WalletState {
  address: string | null;
  publicKey: string | null;
  isConnected: boolean;
  provider: WalletProvider | null;
  network: "testnet" | "mainnet" | "futurenet";
  balance: WalletBalance | null;
  isVerified: boolean;
  verifiedAt: number | null;
}

export interface WalletBalance {
  xlm: string;
  usdc: string;
  eurc: string;
}

export interface WalletStateDisconnected {
  status: "disconnected";
  address: null;
  publicKey: null;
  provider: null;
  network: WalletNetwork;
  balance: null;
}

export interface WalletStateConnecting {
  status: "connecting";
  address: null;
  publicKey: null;
  provider: WalletProvider;
  network: WalletNetwork;
  balance: null;
}

export interface WalletStateConnected {
  status: "connected";
  address: string;
  publicKey: string;
  provider: WalletProvider;
  network: WalletNetwork;
  balance: WalletBalance;
}

export type WalletState =
  | WalletStateDisconnected
  | WalletStateConnecting
  | WalletStateConnected;

export interface UserProfile {
  id: string;
  walletAddress: string;
  role: UserRole;
  displayName: string;
  companyName?: string;
  email?: string;
  kycStatus: "none" | "pending" | "verified" | "rejected";
  createdAt: string;
  avatarUrl?: string;
}

export interface SMEProfile extends UserProfile {
  role: "sme";
  businessRegistrationNumber?: string;
  jurisdiction: string;
  totalInvoicesCreated: number;
  totalFinanced: number;
  repaymentRate: number; // 0–1
}

export interface InvestorProfile extends UserProfile {
  role: "investor";
  totalInvested: number;
  totalYieldEarned: number;
  activePositions: number;
  portfolioValue: number;
}
