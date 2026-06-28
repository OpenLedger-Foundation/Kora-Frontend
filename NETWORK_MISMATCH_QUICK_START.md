# Network Mismatch Detection - Quick Start Guide

## What Was Added

A complete network mismatch detection system that warns users when their wallet is on a different Stellar network than the app expects.

## Key Components

### 1. WrongNetworkBanner (Already Wired)
Auto-displays at the top of every page when network mismatch is detected.

**Features:**
- Dismissible but re-appears on navigation
- Shows both testnet↔mainnet mismatches
- Detects passphrase mismatches (more reliable than enum)
- Already integrated in `app/layout.tsx`

### 2. WalletButton Enhancement (Already Wired)
The wallet menu now:
- Shows warning when network is wrong
- Disables "Fund Testnet" button during mismatch
- Displays detailed network status

### 3. Network Validation Hook (New - Optional for Custom Buttons)
Use `useNetworkValidation()` to disable any transaction button:

```typescript
import { useNetworkValidation } from "@/hooks/useNetworkValidation";

export function MyButton() {
  const { isNetworkMismatch, errorMessage } = useNetworkValidation();
  
  return (
    <Button 
      disabled={isNetworkMismatch}
      title={errorMessage}
      onClick={performTransaction}
    >
      Perform Action
    </Button>
  );
}
```

## What's Checked

### Network Enum Mismatch
Compares `env.NEXT_PUBLIC_STELLAR_NETWORK` with wallet's reported network.

### Passphrase Mismatch (Primary Check)
Compares `env.NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE` with wallet's passphrase.

**Why passphrases matter:**
- More reliable than enum alone
- Prevents network confusion between testnet/mainnet
- Catches edge cases where enum might match but passphrase differs

## Testing the Feature

### Test Scenario 1: Testnet → Mainnet Mismatch
1. App configured for testnet
2. User connects a mainnet wallet
3. Expected: Banner appears, passphrase mismatch detected

### Test Scenario 2: Mainnet → Testnet Mismatch
1. App configured for mainnet
2. User connects a testnet wallet
3. Expected: Banner appears, both enum and passphrase mismatches detected

### Test Scenario 3: Banner Dismissal and Re-appearance
1. Connect to wrong network
2. See banner
3. Click X to dismiss
4. Navigate to another page
5. Navigate back
6. Expected: Banner re-appears

### Test Scenario 4: Transaction Button Disabling
1. Create invoice or other transaction
2. Connect to wrong network
3. Expected: Submit buttons disabled, show helpful error message

## Implementation Details for Developers

### Wallet Store (`store/walletStore.ts`)

New methods:
```typescript
hasPassphraseMismatch(): boolean  // Returns true if passphrase mismatch detected
isWrongNetwork(): boolean         // Returns true if network enum mismatch detected
```

New state:
```typescript
walletPassphrase: string | null   // Stores wallet's network passphrase
```

### Wallet Hook (`hooks/useWallet.ts`)

Updated `connectWallet()` function now:
- Retrieves wallet's network passphrase via `getNetworkDetails()`
- Passes passphrase to store for validation
- Gracefully handles wallets without passphrase support

### Hook to Use in Components

```typescript
// Simple and flexible
const { isNetworkMismatch, errorMessage } = useNetworkValidation();
```

Returns:
- `isNetworkMismatch: boolean` - True if any mismatch detected
- `errorMessage: string` - User-friendly error message
- `isWrongNetwork: boolean` - Enum mismatch specific
- `hasPassphraseMismatch: boolean` - Passphrase mismatch specific

## File Locations

### Core Implementation
- `store/walletStore.ts` - Passphrase validation logic
- `hooks/useWallet.ts` - Passphrase retrieval during connect
- `hooks/useNetworkValidation.ts` - Utility hook for components
- `components/wallet/WrongNetworkBanner.tsx` - Banner with dismissal
- `components/wallet/WalletButton.tsx` - Button integration

### Tests
- `store/__tests__/walletStore.test.ts` - 21 test cases
- `components/wallet/__tests__/WrongNetworkBanner.test.tsx` - 12 test cases
- `hooks/__tests__/useNetworkValidation.test.ts` - 6 test cases

### Documentation
- `NETWORK_MISMATCH_IMPLEMENTATION.md` - Full technical details
- `NETWORK_MISMATCH_QUICK_START.md` - This file

## Common Patterns

### Disable Button While Network Mismatch
```typescript
const { isNetworkMismatch } = useNetworkValidation();

<Button disabled={isNetworkMismatch || isLoading}>
  Submit Invoice
</Button>
```

### Show Inline Error
```typescript
const { isNetworkMismatch, errorMessage } = useNetworkValidation();

return (
  <>
    {isNetworkMismatch && (
      <Alert variant="destructive">{errorMessage}</Alert>
    )}
    <form>
      {/* form fields */}
    </form>
  </>
);
```

### Access Store Methods Directly
```typescript
const { isWrongNetwork, hasPassphraseMismatch } = useWalletStore();

if (isWrongNetwork()) {
  // Handle network enum mismatch
}

if (hasPassphraseMismatch()) {
  // Handle passphrase mismatch
}
```

## Environment Configuration

The implementation uses existing env vars from `.env.example`:

```env
# Testnet configuration
NEXT_PUBLIC_STELLAR_NETWORK=testnet
NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Test SDF Network ; September 2015"

# Mainnet configuration (swap for production)
# NEXT_PUBLIC_STELLAR_NETWORK=mainnet
# NEXT_PUBLIC_STELLAR_NETWORK_PASSPHRASE="Public Global Stellar Network ; September 2015"
```

No additional environment variables needed.

## Rollout Notes

✅ **Already integrated:**
- WrongNetworkBanner shows automatically in app layout
- WalletButton handles disabling testnet fund button
- Existing transaction flows will benefit from the banner

📝 **Optional additions:**
- Use `useNetworkValidation()` in custom transaction buttons
- Add passphrase validation to server-side operations
- Add analytics tracking for network mismatch events

## Troubleshooting

### Banner not appearing
1. Check if wallet is actually connected (`isConnected === true`)
2. Verify `NEXT_PUBLIC_STELLAR_NETWORK` matches expected network
3. Check browser console for wallet connection errors

### Passphrase always null
Some wallet implementations may not support `getNetworkDetails()`. This is fine:
- Enum-based detection (`isWrongNetwork()`) will still work
- Passphrase check will return false but won't cause issues

### Button not disabling
1. Verify component using `useNetworkValidation()` hook
2. Check that `disabled` prop is properly bound to `isNetworkMismatch`
3. Ensure component re-renders when network state changes

## Support

For questions or issues:
1. Check `NETWORK_MISMATCH_IMPLEMENTATION.md` for full details
2. Review test cases in `__tests__` folders for usage patterns
3. Look at WalletButton component for real-world integration example
