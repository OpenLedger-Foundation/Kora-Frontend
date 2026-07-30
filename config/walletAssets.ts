export type WalletAssetType = "native" | "credit";

export interface WalletAssetConfig {
  symbol: string;
  type: WalletAssetType;
  code?: string;
  issuer?: string;
  decimals?: number;
  lowBalanceThreshold?: number;
}

/**
 * Default asset list shown in the wallet balance panel.
 *
 * There is no existing asset config in the repo yet, so this keeps the
 * supported balances in one place rather than re-hardcoding them in hooks/UI.
 */
export const DEFAULT_WALLET_ASSETS: readonly WalletAssetConfig[] = [
  {
    symbol: "XLM",
    type: "native",
    decimals: 2,
  },
  {
    symbol: "USDC",
    type: "credit",
    code: "USDC",
    decimals: 2,
    lowBalanceThreshold: 100,
  },
  {
    symbol: "EURC",
    type: "credit",
    code: "EURC",
    decimals: 2,
  },
];

export const DEFAULT_FUNDING_ASSET_SYMBOL = "USDC";
