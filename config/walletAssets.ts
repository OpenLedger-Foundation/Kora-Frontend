import * as StellarSdk from "@stellar/stellar-sdk";

export const TESTNET_USDC_ISSUER =
  "GA5ZSEJYB37JRC5AVCIA5MOP4RHTM335X2KGX3IHOJAPP5RE34K4KZVN";
export const TESTNET_EURC_ISSUER =
  "GBBD47IF6Q4X3GQ6J3KQW7R4Z5H7L7O2N6B4V6K3QG5N5YJQ5A6L7ABC";

export const WALLET_ASSETS = {
  usdc: {
    code: "USDC",
    issuer: TESTNET_USDC_ISSUER,
    trustlineLimit: "1000000",
    asset: new StellarSdk.Asset("USDC", TESTNET_USDC_ISSUER),
  },
  eurc: {
    code: "EURC",
    issuer: TESTNET_EURC_ISSUER,
    trustlineLimit: "1000000",
    asset: new StellarSdk.Asset("EURC", TESTNET_EURC_ISSUER),
  },
} as const;

export function getAssetBalance(
  balances: Array<{ code: string; issuer?: string; balance: string }>,
  code: string,
  issuer?: string
): string {
  return (
    balances.find(
      (asset) => asset.code === code && (!issuer || asset.issuer === issuer)
    )?.balance ?? "0"
  );
}

export function hasTrustline(
  balances: Array<{ code: string; issuer?: string; balance: string }>,
  code: string,
  issuer: string
): boolean {
  return balances.some(
    (asset) => asset.code === code && asset.issuer === issuer
  );
}
