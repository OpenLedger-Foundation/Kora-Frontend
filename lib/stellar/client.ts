/**
 * Stellar/Soroban RPC client singleton.
 * Reads network config from environment variables.
 */
import * as StellarSdk from "@stellar/stellar-sdk";
import { env } from "@/lib/env";

const RPC_URL = env.NEXT_PUBLIC_STELLAR_RPC_URL;
const NETWORK_PASSPHRASE = env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
const HORIZON_URL = env.NEXT_PUBLIC_STELLAR_HORIZON_URL;

// Soroban RPC client
export const rpc = new StellarSdk.rpc.Server(RPC_URL, { allowHttp: false });

// Horizon server (for account info, balances)
export const horizon = new StellarSdk.Horizon.Server(HORIZON_URL);

export const networkConfig = {
  rpcUrl: RPC_URL,
  networkPassphrase: NETWORK_PASSPHRASE,
  horizonUrl: HORIZON_URL,
};

/**
 * Fetch account details from Horizon.
 */
export async function getAccount(publicKey: string) {
  return horizon.loadAccount(publicKey);
}

/**
 * Fetch XLM + token balances for a given account.
 */
export async function getAccountBalances(publicKey: string) {
  const account = await horizon.loadAccount(publicKey);
  const balances: Record<string, string> = {};

  for (const b of account.balances) {
    if (b.asset_type === "native") {
      balances["XLM"] = b.balance;
    } else if (b.asset_type === "credit_alphanum4" || b.asset_type === "credit_alphanum12") {
      balances[b.asset_code] = b.balance;
    }
  }

  return balances;
}

/**
 * Submit a signed XDR transaction to the Soroban RPC.
 */
export async function submitTransaction(signedXdr: string) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(signedXdr, NETWORK_PASSPHRASE);
  return rpc.sendTransaction(tx);
}

/**
 * Poll for transaction confirmation.
 */
export async function waitForTransaction(
  hash: string,
  maxAttempts = 30,
  intervalMs = 2000
): Promise<StellarSdk.rpc.Api.GetTransactionResponse> {
  for (let i = 0; i < maxAttempts; i++) {
    const result = await rpc.getTransaction(hash);
    if (result.status !== "NOT_FOUND") return result;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Transaction ${hash} not confirmed after ${maxAttempts} attempts`);
}
