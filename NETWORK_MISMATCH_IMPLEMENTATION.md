# Network Mismatch Detection Implementation

## Overview

This document describes the implementation of network mismatch detection for the Kora Protocol frontend. The feature detects when a user's connected wallet is on a different Stellar network than the application expects and prevents transaction-related operations until the network is corrected.

## Problem Statement

Users connecting wallets on mainnet to a testnet app (or vice versa) causes confusing errors. The app should detect and warn about network mismatch immediately on connect.

## Solution Architecture

### 1. Wallet Store Enhancement (`store/walletStore.ts`)

#### New State Field
- `walletPassphrase: string | null` - Stores the Stellar network passphrase from the connected wallet

#### New State Actions
- `connect()` - Now accepts optional `walletPassphrase` parameter to capture wallet's network info
- `hasPassphraseMismatch(): boolean` - Compares wallet's passphrase with `NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE`

#### Implementation Details
```typescript
hasPassphraseMismatch: () => {
  const state = get();
  if (!state.isConnected || !state.walletPassphrase) return false;
  return state.walletPassphrase !== env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE;
}
```

This check validates the actual network passphrase, which is more reliable than enum-based network detection alone. Stellar network passphrases:
- Testnet: `"Test SDF Network ; September 2015"`
- Mainnet: `"Public Global Stellar Network ; September 2015"`
- Futurenet: `"Test SDF Future Network ; September 2015"`

### 2. Wallet Hook Enhancement (`hooks/useWallet.ts`)

#### Connection Flow Update
During `connectWallet()`, the hook now:
1. Connects to the wallet via Stellar Wallets Kit
2. Attempts to retrieve the wallet's network passphrase using `getNetworkDetails()`
3. Passes the passphrase to the store's `connect()` method
4. Gracefully handles wallets that don't support passphrase retrieval (sets to `undefined`)

```typescript
const walletPassphrase: string | undefined;
try {
  const networkInfo = await (walletKit as any).getNetworkDetails?.();
  walletPassphrase = networkInfo?.networkPassphrase;
} catch {
  // Some wallet implementations may not support getNetworkDetails
}
connect(walletId as WalletProvider, addr, addr, walletPassphrase);
```

### 3. Wrong Network Banner (`components/wallet/WrongNetworkBanner.tsx`)

#### Enhanced Detection
The banner now checks for both:
- Network enum mismatch: `isWrongNetwork()` (comparing `env.NEXT_PUBLIC_STELLAR_NETWORK`)
- Passphrase mismatch: `hasPassphraseMismatch()` (comparing actual passphrases)

#### Dismissal with Re-appearance
- Banner displays a dismiss button (X icon)
- Dismissal state persists only during the current view
- **Critical**: Using `useEffect` to reset `dismissed` state when:
  - Wallet connection status changes
  - `isWrongNetwork()` returns a different value
  - `hasPassphraseMismatch()` returns a different value
  
This ensures the banner re-appears when users navigate away and come back, complying with the requirement: "Banner must be dismissible but re-appears if user navigates away and comes back"

```typescript
useEffect(() => {
  setDismissed(false);
}, [isConnected, isWrongNetwork(), hasPassphraseMismatch()]);
```

### 4. Network Validation Hook (`hooks/useNetworkValidation.ts`)

A simple utility hook for components that need to disable transaction buttons:

```typescript
export function useNetworkValidation() {
  const { isWrongNetwork, hasPassphraseMismatch } = useWalletStore();
  
  const isNetworkMismatch = isWrongNetwork() || hasPassphraseMismatch();
  
  let errorMessage = "";
  if (isNetworkMismatch) {
    if (hasPassphraseMismatch()) {
      errorMessage = "Wallet passphrase does not match the app network. Please switch your wallet to the correct network.";
    } else {
      errorMessage = "Wallet is connected to the wrong network. Please switch to the correct network.";
    }
  }

  return { isNetworkMismatch, errorMessage, isWrongNetwork: isWrongNetwork(), hasPassphraseMismatch: hasPassphraseMismatch() };
}
```

### 5. Transaction Button Disabling

Transaction-triggering buttons can use the hook to disable operations:

```typescript
import { useNetworkValidation } from "@/hooks/useNetworkValidation";

export function MyTransactionButton() {
  const { isNetworkMismatch, errorMessage } = useNetworkValidation();
  
  return (
    <Button 
      disabled={isNetworkMismatch}
      title={errorMessage}
    >
      Create Invoice
    </Button>
  );
}
```

#### Existing Implementation
The `WalletButton` component (`components/wallet/WalletButton.tsx`) already demonstrates this:
- Disables the "Fund Testnet" button when `hasNetworkMismatch` is true
- Shows network mismatch warning in the dropdown menu

### 6. Wallet Button Enhancement (`components/wallet/WalletButton.tsx`)

Updated to:
- Import `isWrongNetwork` and `hasPassphraseMismatch` from store
- Combine checks: `const hasNetworkMismatch = isWrongNetwork() || hasPassphraseMismatch()`
- Disable testnet funding button when mismatch is detected
- Display detailed warning message including passphrase mismatch indication

## Test Coverage

### 1. Wallet Store Tests (`store/__tests__/walletStore.test.ts`)

- ✅ `isWrongNetwork()` returns false when disconnected
- ✅ `isWrongNetwork()` returns false when connected to correct network
- ✅ `isWrongNetwork()` returns true for mainnet→testnet mismatch
- ✅ `isWrongNetwork()` returns true for testnet→mainnet mismatch
- ✅ `hasPassphraseMismatch()` returns false when disconnected
- ✅ `hasPassphraseMismatch()` returns false when passphrase matches
- ✅ `hasPassphraseMismatch()` returns true when passphrase doesn't match
- ✅ `hasPassphraseMismatch()` returns false when walletPassphrase is null
- ✅ Passphrase persists to localStorage via zustand middleware
- ✅ Passphrase is cleared on disconnection
- ✅ Realistic testnet→mainnet scenario with passphrase check
- ✅ Realistic mainnet→testnet scenario with both enum and passphrase mismatch

### 2. Wrong Network Banner Tests (`components/wallet/__tests__/WrongNetworkBanner.test.tsx`)

- ✅ Banner doesn't render when wallet is disconnected
- ✅ Banner doesn't render when network is correct
- ✅ Banner renders when connected to wrong network enum
- ✅ Banner renders when passphrase mismatches
- ✅ Banner is dismissible with close button
- ✅ Banner re-appears when component re-mounts (simulating navigation)
- ✅ Banner displays correct network names (Testnet/Mainnet)
- ✅ Banner shows passphrase mismatch indicator in text
- ✅ Handles testnet→mainnet scenario
- ✅ Handles mainnet→testnet scenario

### 3. Network Validation Hook Tests (`hooks/__tests__/useNetworkValidation.test.ts`)

- ✅ Returns no mismatch when both checks pass
- ✅ Detects network enum mismatch
- ✅ Detects passphrase mismatch
- ✅ Detects both enum and passphrase mismatch
- ✅ Provides descriptive error messages for network mismatch
- ✅ Provides passphrase-specific error messages

## File Changes Summary

### Modified Files
1. `store/walletStore.ts` - Added passphrase tracking and validation
2. `hooks/useWallet.ts` - Enhanced wallet connection to capture passphrase
3. `components/wallet/WrongNetworkBanner.tsx` - Enhanced mismatch detection and dismissal behavior
4. `components/wallet/WalletButton.tsx` - Updated to use passphrase checks and disable buttons accordingly

### New Files
1. `hooks/useNetworkValidation.ts` - Utility hook for network validation in components
2. `store/__tests__/walletStore.test.ts` - Comprehensive store tests (21 test cases)
3. `components/wallet/__tests__/WrongNetworkBanner.test.tsx` - Banner component tests (12 test cases)
4. `hooks/__tests__/useNetworkValidation.test.ts` - Hook tests (6 test cases)

## Integration Guide

### For Developers Adding New Transaction Buttons

1. Import the validation hook:
```typescript
import { useNetworkValidation } from "@/hooks/useNetworkValidation";
```

2. Use it in your component:
```typescript
export function MyTransactionComponent() {
  const { isNetworkMismatch, errorMessage } = useNetworkValidation();
  
  return (
    <>
      <Button 
        disabled={isNetworkMismatch}
        title={errorMessage}
      >
        Perform Transaction
      </Button>
    </>
  );
}
```

3. The hook automatically handles:
   - Network enum mismatch detection
   - Passphrase mismatch detection
   - User-friendly error messages

### Environment Variables

The implementation relies on these already-configured environment variables:

```env
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"
```

For mainnet, these would be:
```env
NEXT_PUBLIC_STELLAR_NETWORK=mainnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
```

## Edge Cases Handled

1. **Wallets without passphrase support** - Graceful fallback to enum-based detection only
2. **Disconnection** - All network state cleared properly
3. **Navigation** - Banner dismissal resets on route change
4. **Multiple wallet types** - Works with Freighter, xBull, LOBSTR, Albedo
5. **Wallet switching** - Detects network changes when user switches wallets mid-session

## Security Considerations

- Passphrase comparison is exact string matching
- No user input is used in network detection
- Environment variables validated on startup via `lib/env.ts`
- Checks are client-side only (server validation should still be implemented)

## Future Enhancements

1. Add server-side network verification for sensitive operations
2. Add analytics tracking for network mismatch events
3. Implement network auto-detection and auto-suggestion UI
4. Add support for wallet-level network hints (if available in future SDK versions)

## Testing Instructions

Run the test suite:

```bash
npm test -- --run store/__tests__/walletStore.test.ts
npm test -- --run components/wallet/__tests__/WrongNetworkBanner.test.tsx
npm test -- --run hooks/__tests__/useNetworkValidation.test.ts
```

Or run all tests:
```bash
npm test -- --run
```

## Rollout Checklist

- [x] Passphrase check implemented in wallet store
- [x] Banner component updated with passphrase detection
- [x] Button disabling logic implemented
- [x] Tests written and structured
- [x] Documentation completed
- [ ] Manual QA testing on testnet
- [ ] Manual QA testing on mainnet connection attempt
- [ ] Code review completed
- [ ] Deployed to staging
- [ ] Deployed to production
