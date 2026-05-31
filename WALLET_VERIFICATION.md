# Wallet Ownership Verification

This document describes the wallet ownership verification system that prevents wallet address spoofing by requiring users to sign a challenge message before accessing protected actions.

## Architecture

The verification system consists of:

1. **API Routes** (`app/api/auth/`)
   - `challenge/route.ts` - Generates a server-side nonce challenge
   - `verify/route.ts` - Verifies signatures using Stellar SDK

2. **Store** (`store/walletStore.ts`)
   - Tracks verification status with `isVerified` and `verifiedAt` fields
   - 1-hour session expiry
   - Auto-clears on wallet disconnect

3. **Hooks**
   - `useWallet()` - Core wallet hook with verification methods
   - `useVerifiedAction()` - Protects specific actions requiring verification

4. **Components**
   - `VerificationModal.tsx` - UI for re-verification prompts
   - `VerificationProvider.tsx` - Context provider for app-wide verification management

## Usage

### Setup

1. **Wrap your app with VerificationProvider** in `app/providers.tsx`:

```tsx
import { VerificationProvider } from "@/components/wallet/VerificationProvider";

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <VerificationProvider>
      {children}
    </VerificationProvider>
  );
}
```

### Protecting Actions

#### Method 1: Using useVerification Hook

For invoice creation:

```tsx
import { useVerification } from "@/components/wallet/VerificationProvider";

export function CreateInvoiceForm() {
  const { requireVerification } = useVerification();

  const handleSubmit = async (data: InvoiceData) => {
    try {
      // This will prompt verification if needed
      await requireVerification("invoice-creation");
      
      // Proceed with creation
      await createInvoice(data);
    } catch (error) {
      if (error instanceof Error && error.message === "Verification cancelled") {
        // User cancelled verification
        return;
      }
      // Handle other errors
    }
  };

  return <form onSubmit={handleSubmit}>...</form>;
}
```

#### Method 2: Using useVerifiedAction Hook

For more granular control with pending action retry:

```tsx
import { useVerifiedAction } from "@/hooks/useVerifiedAction";

export function FundingForm() {
  const { executeProtectedAction, verifyAndRetry } = useVerifiedAction();

  const handleFund = async (amount: string) => {
    const result = await executeProtectedAction(
      async () => {
        await fundInvoice(amount);
      },
      "funding"
    );

    if (result.requiresVerification) {
      // Prompt user for verification
      try {
        await verifyAndRetry();
      } catch {
        // Verification failed or was cancelled
      }
    } else if (result.error) {
      console.error(result.error);
    }
  };

  return <button onClick={() => handleFund("100")}>Fund</button>;
}
```

### Direct Verification Check

```tsx
import { useWallet } from "@/hooks/useWallet";

export function ProtectedButton() {
  const wallet = useWallet();

  const handleClick = async () => {
    if (!wallet.checkVerification()) {
      // Re-verify
      try {
        await wallet.verifyOwnership();
      } catch (error) {
        console.error("Verification failed:", error);
        return;
      }
    }

    // Proceed with protected action
    await performAction();
  };

  return <button onClick={handleClick}>Perform Action</button>;
}
```

## Protected Actions

The following actions should require verification:

1. **Invoice Creation** - `invoice-creation`
2. **Funding** - `funding`
3. **Repayment** - `repayment`
4. **Claim** - `claim`

## Verification Flow

1. **User initiates protected action**
   - App calls `requireVerification()` or checks `wallet.isVerified`

2. **Verification check**
   - If verification expired or invalid: show `VerificationModal`
   - If valid: proceed with action

3. **Challenge generation**
   - Backend generates random nonce: `POST /api/auth/challenge`
   - Returns challenge string with timestamp

4. **Wallet signing**
   - User signs challenge with wallet private key
   - No gas fees charged (message signing only)

5. **Signature verification**
   - Backend verifies signature: `POST /api/auth/verify`
   - Returns verification status and session expiry (1 hour)

6. **Session storage**
   - Zustand store persists `isVerified` and `verifiedAt`
   - Automatically clears on wallet disconnect

## API Endpoints

### POST /api/auth/challenge

Returns a challenge for the user to sign.

**Response:**
```json
{
  "challenge": "Verify wallet ownership\nNonce: abc123...\nTimestamp: 1234567890",
  "timestamp": 1234567890
}
```

### POST /api/auth/verify

Verifies a signed challenge.

**Request:**
```json
{
  "challenge": "Verify wallet ownership\nNonce: abc123...\nTimestamp: 1234567890",
  "signature": "base64_encoded_signature",
  "publicKey": "G..."
}
```

**Response:**
```json
{
  "verified": true,
  "expiresAt": 1234571490
}
```

## Session Management

- **Duration**: 1 hour from verification
- **Expiry check**: Automatic via `isVerificationExpired()` in store
- **Clear on disconnect**: Verification cleared when wallet disconnects
- **Persistence**: Verification status persisted to localStorage via Zustand

## Error Handling

```tsx
try {
  await wallet.verifyOwnership();
} catch (error) {
  if (error instanceof Error) {
    if (error.message.includes("Wallet not connected")) {
      // Handle wallet disconnection
    } else if (error.message.includes("Failed to verify")) {
      // Handle signature verification failure
    } else {
      // Handle other errors
    }
  }
}
```

## Testing

For mock/test environments:

```tsx
// In development with mock data enabled
if (process.env.NEXT_PUBLIC_ENABLE_MOCK_DATA === "true") {
  // Verification will succeed immediately
  await wallet.verifyOwnership();
}
```

## Security Considerations

1. **Nonce freshness**: Challenges valid for 5 minutes only
2. **Timestamp validation**: Server validates challenge timestamp
3. **Signature verification**: Uses Stellar SDK's `VerifyUtils.verify()`
4. **Session expiry**: Automatic 1-hour expiry prevents token reuse
5. **No private key exposure**: Users sign, never transmit private keys
6. **Wallet disconnection**: Clears all verification state

## Troubleshooting

### Verification always fails
- Check wallet is connected and funded
- Verify Stellar SDK version compatibility
- Check challenge timestamp isn't expired

### Modal keeps showing
- Verify `VerificationProvider` is in app layout
- Check localStorage isn't blocked
- Ensure wallet address hasn't changed

### Signature verification error
- Confirm public key matches signed message
- Check signature encoding (should be base64)
- Verify wallet uses same Stellar network
