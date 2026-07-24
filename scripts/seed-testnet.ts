/**
 * Seeds a fresh Stellar testnet wallet with sample Kora invoice data for
 * local development against the live contracts.
 *
 * What it does:
 *   1. Generates a new keypair and funds it via Friendbot.
 *   2. Mints it some testnet USDC (needed to fund invoices in step 4).
 *   3. Mints 5 sample invoices on the Invoice contract.
 *   4. Partially funds 2 of those invoices on the Marketplace contract.
 *   5. Prints the wallet keypair and the minted token IDs.
 *
 * Usage:
 *   npm run seed:testnet
 *   npm run seed:testnet -- --dry-run
 *
 * --dry-run still funds the generated account (a real, sequence-numbered
 * account is required to simulate contract calls at all) and builds +
 * simulates every mint_invoice call, but never signs or submits a mint or
 * fund transaction, so no invoice or funding state is written on-chain.
 *
 * Only ever targets testnet — see assertTestnet() below.
 */
import { register } from "node:module";
import * as StellarSdk from "@stellar/stellar-sdk";

// Let this script `import` app source (lib/stellar/*, lib/env.ts) with its
// native @/ aliases and extensionless relative imports untouched — see
// resolve-hooks.mjs for why this is needed instead of a bundler/ts-node.
register("./resolve-hooks.mjs", import.meta.url);

const { env } = await import("../lib/env.ts");
const { fundTestnetAccount, submitTransaction, waitForTransaction, networkConfig } = await import(
  "../lib/stellar/client.ts"
);
const { invoiceContract, marketplaceContract, buildTestnetUsdcMintTx } = await import(
  "../lib/stellar/contracts.ts"
);

const DRY_RUN = process.argv.includes("--dry-run");

function assertTestnet(): void {
  if (env.NEXT_PUBLIC_STELLAR_NETWORK !== "testnet") {
    console.error(
      `Refusing to run: NEXT_PUBLIC_STELLAR_NETWORK is "${env.NEXT_PUBLIC_STELLAR_NETWORK}", not "testnet".\n` +
        `This script only ever seeds testnet data — set NEXT_PUBLIC_STELLAR_NETWORK=testnet to proceed.`
    );
    process.exit(1);
  }
}

// ─── Sample data ──────────────────────────────────────────────────────────────
// amount / financingAmount are scaled by 1_000_000 and discountRate by 10_000,
// matching services/invoiceService.ts's createInvoice() conversion.
// ipfsCid values are placeholders — this script never uploads to Pinata, so
// they won't resolve to real content. That's fine for exercising contract
// state locally; swap in real CIDs if you need the metadata to resolve too.

interface SeedInvoice {
  ipfsCid: string;
  amount: bigint;
  financingAmount: bigint;
  discountRate: number;
  dueDate: bigint;
  /** Set to partially fund this invoice after minting. */
  fundAmount?: bigint;
}

function daysFromNow(days: number): bigint {
  return BigInt(Math.floor(Date.now() / 1000) + days * 86_400);
}

// BigInt() calls rather than `n`-suffixed literals — the project's tsconfig
// targets ES2017, which doesn't support BigInt literal syntax.
const SEED_INVOICES: SeedInvoice[] = [
  {
    ipfsCid: "bafkreiseedinvoice00000000000000000000000000001",
    amount: BigInt(250_000_000_000),
    financingAmount: BigInt(235_000_000_000),
    discountRate: 600,
    dueDate: daysFromNow(60),
  },
  {
    ipfsCid: "bafkreiseedinvoice00000000000000000000000000002",
    amount: BigInt(90_000_000_000),
    financingAmount: BigInt(85_950_000_000),
    discountRate: 450,
    dueDate: daysFromNow(45),
    fundAmount: BigInt(40_000_000_000),
  },
  {
    ipfsCid: "bafkreiseedinvoice00000000000000000000000000003",
    amount: BigInt(500_000_000_000),
    financingAmount: BigInt(460_000_000_000),
    discountRate: 800,
    dueDate: daysFromNow(90),
  },
  {
    ipfsCid: "bafkreiseedinvoice00000000000000000000000000004",
    amount: BigInt(120_000_000_000),
    financingAmount: BigInt(114_000_000_000),
    discountRate: 500,
    dueDate: daysFromNow(30),
    fundAmount: BigInt(55_000_000_000),
  },
  {
    ipfsCid: "bafkreiseedinvoice00000000000000000000000000005",
    amount: BigInt(75_000_000_000),
    financingAmount: BigInt(72_375_000_000),
    discountRate: 350,
    dueDate: daysFromNow(75),
  },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

interface SubmitResult {
  hash: string;
  returnValue?: StellarSdk.xdr.ScVal;
}

/** Signs an unsigned XDR with `keypair`, submits it, and waits for confirmation. */
async function signAndSubmit(unsignedXdr: string, keypair: StellarSdk.Keypair): Promise<SubmitResult> {
  const tx = StellarSdk.TransactionBuilder.fromXDR(unsignedXdr, networkConfig.networkPassphrase);
  tx.sign(keypair);

  const sent = await submitTransaction(tx.toXDR());
  if (sent.status === "ERROR") {
    throw new Error(`Transaction submission failed: ${JSON.stringify(sent)}`);
  }

  const result = await waitForTransaction(sent.hash);
  if (result.status !== "SUCCESS") {
    throw new Error(`Transaction ${sent.hash} did not succeed (status: ${result.status})`);
  }

  const returnValue = (result as { returnValue?: StellarSdk.xdr.ScVal }).returnValue;
  return { hash: sent.hash, returnValue };
}

/** Parses the u64 token ID mint_invoice returns on success. */
function parseTokenId(returnValue: StellarSdk.xdr.ScVal | undefined): string {
  if (!returnValue) return "unknown";
  try {
    return returnValue.u64().toString();
  } catch {
    return "unknown";
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  assertTestnet();

  const keypair = StellarSdk.Keypair.random();
  console.log("Generated wallet:");
  console.log(`  Public Key: ${keypair.publicKey()}`);
  console.log(`  Secret Key: ${keypair.secret()}`);

  console.log("\nFunding via Friendbot...");
  await fundTestnetAccount(keypair.publicKey());
  console.log("  Funded.");

  console.log("\nMinting testnet USDC...");
  const usdcMintXdr = await buildTestnetUsdcMintTx(keypair.publicKey(), keypair.publicKey());
  if (DRY_RUN) {
    console.log(`  [dry-run] Simulated OK (${usdcMintXdr.length} byte unsigned XDR) — not submitted.`);
  } else {
    const { hash } = await signAndSubmit(usdcMintXdr, keypair);
    console.log(`  Minted (tx ${hash})`);
  }

  const tokenIds: string[] = [];

  for (const [i, invoice] of SEED_INVOICES.entries()) {
    console.log(`\nMinting invoice ${i + 1}/${SEED_INVOICES.length}...`);
    const unsignedXdr = await invoiceContract.mintInvoice(
      {
        ipfsCid: invoice.ipfsCid,
        amount: invoice.amount,
        financingAmount: invoice.financingAmount,
        discountRate: invoice.discountRate,
        dueDate: invoice.dueDate,
      },
      keypair.publicKey()
    );

    if (DRY_RUN) {
      console.log(`  [dry-run] Simulated OK (${unsignedXdr.length} byte unsigned XDR) — not submitted.`);
      tokenIds.push("(dry-run)");
      continue;
    }

    const { hash, returnValue } = await signAndSubmit(unsignedXdr, keypair);
    const tokenId = parseTokenId(returnValue);
    tokenIds.push(tokenId);
    console.log(`  Minted token ${tokenId} (tx ${hash})`);
  }

  if (DRY_RUN) {
    console.log(
      `\n[dry-run] Skipping the fund step — it needs real token IDs from a completed mint. ` +
        `${SEED_INVOICES.filter((i) => i.fundAmount).length} of the ${SEED_INVOICES.length} invoices above would be partially funded on a real run.`
    );
    console.log("\n[dry-run] Validation complete. No transactions were submitted.");
    return;
  }

  const toFund = SEED_INVOICES.map((invoice, i) => ({ invoice, tokenId: tokenIds[i] })).filter(
    (x): x is { invoice: SeedInvoice & { fundAmount: bigint }; tokenId: string } => x.invoice.fundAmount !== undefined
  );

  for (const { invoice, tokenId } of toFund) {
    console.log(`\nPartially funding token ${tokenId}...`);
    const unsignedXdr = await marketplaceContract.fundInvoice(
      { tokenId: BigInt(tokenId), amount: invoice.fundAmount },
      keypair.publicKey()
    );
    const { hash } = await signAndSubmit(unsignedXdr, keypair);
    console.log(`  Funded (tx ${hash})`);
  }

  console.log("\n─────────────────────────────────────────");
  console.log("Done. Summary:");
  console.log(`  Public Key: ${keypair.publicKey()}`);
  console.log(`  Secret Key: ${keypair.secret()}`);
  console.log(`  Token IDs:  ${tokenIds.join(", ")}`);
  console.log(`  Partially funded: ${toFund.map((x) => x.tokenId).join(", ") || "none"}`);
  console.log("─────────────────────────────────────────");
}

main().catch((err) => {
  console.error("\nSeed script failed:", err instanceof Error ? err.message : err);
  process.exit(1);
});
