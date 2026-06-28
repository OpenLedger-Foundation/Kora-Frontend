# Kora Protocol — Architecture

This document describes the technical architecture of the Kora Protocol frontend: how it is structured, how data flows, and how it integrates with Stellar Soroban.

---

## Table of Contents

- [High-Level Overview](#high-level-overview)
- [Layer Breakdown](#layer-breakdown)
- [Data Flow](#data-flow)
- [State Management](#state-management)
- [Wallet Integration](#wallet-integration)
- [Contract Interaction](#contract-interaction)
- [IPFS Storage](#ipfs-storage)
- [Rendering Strategy](#rendering-strategy)
- [Security Considerations](#security-considerations)
- [Scalability Notes](#scalability-notes)

---

## High-Level Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        Browser (Client)                         │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────────────┐  │
│  │  Next.js App │  │  Zustand     │  │  TanStack Query      │  │
│  │  (App Router)│  │  (UI State)  │  │  (Server State)      │  │
│  └──────┬───────┘  └──────┬───────┘  └──────────┬───────────┘  │
│         │                 │                      │              │
│  ┌──────▼─────────────────▼──────────────────────▼───────────┐  │
│  │                    Service Layer                           │  │
│  │  invoiceService.ts  ·  ipfs.ts  ·  stellar/contracts.ts   │  │
│  └──────────────────────────┬──────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────────┘
                              │
          ┌───────────────────┼───────────────────┐
          │                   │                   │
   ┌──────▼──────┐   ┌────────▼───────┐   ┌──────▼──────┐
   │  Soroban    │   │  Stellar       │   │  Pinata     │
   │  RPC Node   │   │  Horizon API   │   │  IPFS       │
   └─────────────┘   └────────────────┘   └─────────────┘
```

---

## Layer Breakdown

### 1. Presentation Layer (`app/`, `components/`)

- **Next.js App Router** pages handle routing and layout.
- **Server Components** are used for static/SEO content (landing page sections).
- **Client Components** (`"use client"`) handle interactivity: wallet connection, forms, charts.
- **`components/ui/`** — headless, reusable primitives (Button, Card, Input, etc.) built on Radix UI.
- **`components/invoice/`** — domain-specific components (InvoiceCard).
- **`components/wallet/`** — wallet connection UI.
- **`components/layout/`** — Navbar, shared layout elements.

### 2. Hook Layer (`hooks/`)

Hooks encapsulate all stateful logic and side effects:

| Hook | Responsibility |
|------|---------------|
| `useWallet` | Wraps Stellar Wallets Kit; exposes connect/disconnect/sign |
| `useTransaction` | Manages the full tx lifecycle with toast notifications |
| `useInvoices` | TanStack Query wrappers for invoice data fetching |

### 3. Service Layer (`services/`)

Pure functions that abstract data access:

| Service | Responsibility |
|---------|---------------|
| `invoiceService.ts` | Fetch invoices, prepare mint/fund transactions |
| `mockData.ts` | Static mock data for development |

The service layer is the **only** place that calls `lib/stellar/` or `lib/ipfs.ts`. Components never call these directly.

### 4. Library Layer (`lib/`)

Low-level utilities and clients:

| Module | Responsibility |
|--------|---------------|
| `lib/stellar/client.ts` | Soroban RPC + Horizon singletons |
| `lib/stellar/contracts.ts` | Contract call builders (unsigned XDR) |
| `lib/ipfs.ts` | Pinata upload helpers |
| `lib/utils.ts` | Formatting, class merging, constants |
| `lib/validations/` | Zod schemas for form validation |

### 5. State Layer (`store/`)

Zustand stores for global client state:

| Store | State |
|-------|-------|
| `walletStore` | Wallet address, connection status, balances (persisted to localStorage) |
| `invoiceStore` | Marketplace filters, sort, search query |
| `uiStore` | Modal open/close, transaction status |

---

## Data Flow

### Read Flow (Marketplace)

```
User visits /marketplace
    │
    ▼
useInvoices() [TanStack Query]
    │
    ▼
fetchInvoices(filters, sort) [invoiceService.ts]
    │
    ├── MOCK_DATA=true → return MOCK_INVOICES (filtered/sorted)
    │
    └── MOCK_DATA=false → fetch from on-chain indexer / Soroban RPC
    │
    ▼
InvoiceCard components render
```

### Write Flow (Fund Invoice)

```
User clicks "Fund Invoice"
    │
    ▼
handleFund() in [id]/page.tsx
    │
    ▼
useTransaction().execute(buildFn)
    │
    ├── buildFn() → prepareFundInvoice() [invoiceService.ts]
    │                   └── marketplaceContract.fundInvoice() [contracts.ts]
    │                           └── buildContractCall() → unsigned XDR
    │
    ├── signTransaction(xdr) [useWallet → StellarWalletsKit]
    │       └── Wallet extension prompts user
    │
    └── submitAndConfirm(signedXdr) [invoiceService.ts]
            ├── submitTransaction() [client.ts → Soroban RPC]
            └── waitForTransaction() [polls until confirmed]
    │
    ▼
Toast notification + UI update
```

---

## State Management

We use **two separate state systems** for different concerns:

### Server State — TanStack Query

- Invoice listings, individual invoice data
- Automatic background refetching, caching, deduplication
- Cache keys: `["invoices", filters, sort]`, `["invoice", id]`

### Client State — Zustand

- **walletStore**: Persisted to `localStorage` via `zustand/middleware/persist`. Survives page refresh.
- **invoiceStore**: Ephemeral marketplace filter/sort state.
- **uiStore**: Ephemeral modal and transaction status.

**Rule:** Never put server data in Zustand. Never put UI state in TanStack Query.

---

## Wallet Integration

Kora uses [`@creit.tech/stellar-wallets-kit`](https://github.com/Creit-Tech/Stellar-Wallets-Kit) to support multiple Stellar wallets through a unified API.

```
useWallet hook
    │
    ▼
StellarWalletsKit (singleton)
    │
    ├── Freighter (browser extension)
    ├── xBull (browser extension)
    ├── LOBSTR (browser extension)
    └── Albedo (web-based signer)
```

The kit is instantiated lazily on first use and reused across the session. On disconnect, the singleton is cleared.

**Wallet state persistence:** The wallet address and provider are persisted to `localStorage`. On page load, if a stored address exists, the UI shows as connected — but the actual kit session must be re-established on the next transaction (the wallet extension handles this transparently).

---

## Contract Interaction

All Soroban contract interactions follow this pattern:

```typescript
// 1. Build (client-side, no signature needed)
const tx = await buildContractCall({ contractId, method, args, sourcePublicKey });
// → Simulates the transaction to get resource footprint
// → Returns an assembled Transaction object

// 2. Serialize to XDR for wallet signing
const unsignedXdr = tx.toXDR();

// 3. Sign (wallet extension)
const signedXdr = await walletKit.signTransaction(unsignedXdr, { ... });

// 4. Submit
const result = await rpc.sendTransaction(tx);

// 5. Confirm (poll)
const confirmed = await waitForTransaction(result.hash);
```

This separation means the frontend **never holds private keys**. The wallet extension is the only signer.

---

## IPFS Storage

Invoice documents and metadata are stored on IPFS via Pinata:

```
Create Invoice flow
    │
    ├── uploadFileToPinata(pdf) → docCid
    │
    ├── Build metadata JSON { ...invoiceData, documentHash: docCid }
    │
    └── uploadJsonToPinata(metadata) → metadataCid
            │
            └── metadataCid passed to mint_invoice() on-chain
```

The on-chain NFT stores only the IPFS CID. The full metadata is always retrievable from IPFS, making it tamper-proof and permanent.

---

## Rendering Strategy

| Page | Strategy | Reason |
|------|----------|--------|
| `/` (Landing) | Static + Client hydration | SEO, animations |
| `/marketplace` | Client | Dynamic filters, wallet state |
| `/marketplace/[id]` | Client | Wallet-gated fund panel |
| `/invoice/create` | Client | Form, file upload, wallet |
| `/dashboard/sme` | Client | Wallet-gated |
| `/dashboard/investor` | Client | Wallet-gated |
| `/analytics` | Client | Charts, wallet-gated |

Most pages are client-rendered because they require wallet state. Future versions may add a server-side indexer for SEO-friendly invoice pages.

---

## Security Considerations

1. **No private keys in the frontend.** All signing is delegated to wallet extensions.
2. **Environment variables.** Only `NEXT_PUBLIC_*` variables are exposed to the browser. `PINATA_JWT` is server-only and used only in API routes (not yet implemented — currently called client-side for simplicity; move to API route before production).
3. **Input validation.** All form inputs are validated with Zod before any contract call is built.
4. **IPFS content addressing.** Invoice documents are content-addressed — the CID stored on-chain is a cryptographic hash of the content, making tampering detectable.
5. **Contract simulation.** Every transaction is simulated before signing. Simulation errors surface to the user before they're asked to sign.
6. **No custodial funds.** The frontend never holds or transfers user funds directly. All value flows through Soroban smart contracts.

---

## Scalability Notes

- **Indexer:** For production, replace `fetchInvoices` with a dedicated indexer (e.g., a Soroban event indexer or a custom backend) rather than querying the RPC directly for listings.
- **Pagination:** The service layer already supports `page` and `pageSize` parameters. The marketplace UI can be extended with infinite scroll or pagination controls.
- **Caching:** TanStack Query's `staleTime` is set to 30s for listings and 60s for individual invoices. Adjust based on on-chain update frequency.
- **Multi-network:** The network is read from `NEXT_PUBLIC_STELLAR_NETWORK`. Switching to mainnet requires only an environment variable change and redeployment.

---

## Deployment & CI

- **Build:** The project builds with `next build` and is deployed as a static/SSR hybrid depending on the hosting platform.
- **CI:** CI should run `pnpm install --frozen-lockfile`, `pnpm lint`, and `pnpm test` (if tests exist) before publishing artifacts.
- **Secrets:** Use the hosting provider's secret store for server-only variables (e.g., `PINATA_JWT`, private indexer keys). Do not expose them as `NEXT_PUBLIC_*`.

## Appendix / Glossary

- **Soroban:** Stellar's smart contract platform.
- **Horizon:** Stellar's REST API for account and ledger data.
- **CID:** Content Identifier for IPFS objects.

## Contact

For architecture questions or proposals, open an issue or contact the core maintainers in the repository.
