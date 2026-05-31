/**
 * Example: Integrating wallet verification into protected actions
 * 
 * This file demonstrates how to add verification checks to invoice creation,
 * funding, repayment, and claim operations.
 */

import { useVerification } from "@/components/wallet/VerificationProvider";
import { useInvoices } from "@/hooks/useInvoices";

// ─── Example 1: Invoice Creation ───────────────────────────────────────────

export function useProtectedCreateInvoice() {
  const { requireVerification } = useVerification();
  const { createInvoice: createInvoiceQuery } = useInvoices();

  const createInvoice = async (data: any) => {
    try {
      // Step 1: Verify wallet ownership before proceeding
      await requireVerification("invoice-creation");

      // Step 2: Proceed with invoice creation
      const result = await createInvoiceQuery.mutateAsync(data);
      return result;
    } catch (error) {
      if (error instanceof Error && error.message === "Verification cancelled") {
        // User cancelled verification - silently fail or show message
        console.log("Invoice creation cancelled by user");
        throw new Error("Invoice creation cancelled");
      }
      throw error;
    }
  };

  return { createInvoice, isLoading: createInvoiceQuery.isPending };
}

// ─── Example 2: Using in a React Component ────────────────────────────────────

/**
 * Invoice creation form component with verification
 * 
 * Usage:
 * ```tsx
 * <CreateInvoiceForm onSuccess={() => navigate('/dashboard')} />
 * ```
 */
export function CreateInvoiceFormWithVerification() {
  const { requireVerification } = useVerification();
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleSubmit = async (formData: any) => {
    setIsSubmitting(true);
    setError(null);

    try {
      // Request verification before creating invoice
      await requireVerification("invoice-creation");

      // If we reach here, verification was successful
      const response = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      if (!response.ok) {
        throw new Error(`Failed to create invoice: ${response.statusText}`);
      }

      // Success
      const invoice = await response.json();
      console.log("Invoice created:", invoice);
      // Navigate or refresh list
    } catch (err) {
      if (err instanceof Error) {
        if (err.message === "Verification cancelled") {
          setError("Please verify your wallet to create an invoice");
        } else {
          setError(err.message);
        }
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={(e) => {
      e.preventDefault();
      const formData = new FormData(e.currentTarget);
      handleSubmit(Object.fromEntries(formData));
    }}>
      {/* Form fields */}
      <input type="text" name="amount" placeholder="Amount" required />
      <input type="date" name="dueDate" required />

      {error && <div className="text-red-500 text-sm">{error}</div>}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? "Creating..." : "Create Invoice"}
      </button>
    </form>
  );
}

// ─── Example 3: Fund Invoice ──────────────────────────────────────────────────

export function useFundInvoice() {
  const { requireVerification } = useVerification();

  const fundInvoice = async (invoiceId: string, amount: string) => {
    try {
      // Verify before funding
      await requireVerification("funding");

      const response = await fetch(`/api/invoices/${invoiceId}/fund`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) throw new Error("Funding failed");
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message === "Verification cancelled") {
        console.log("Funding cancelled");
      }
      throw error;
    }
  };

  return { fundInvoice };
}

// ─── Example 4: Repay Invoice ─────────────────────────────────────────────────

export function useRepayInvoice() {
  const { requireVerification } = useVerification();

  const repayInvoice = async (invoiceId: string, amount: string) => {
    try {
      // Verify before repaying
      await requireVerification("repayment");

      const response = await fetch(`/api/invoices/${invoiceId}/repay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount }),
      });

      if (!response.ok) throw new Error("Repayment failed");
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message === "Verification cancelled") {
        console.log("Repayment cancelled");
      }
      throw error;
    }
  };

  return { repayInvoice };
}

// ─── Example 5: Claim Funds ───────────────────────────────────────────────────

export function useClaimFunds() {
  const { requireVerification } = useVerification();

  const claimFunds = async (invoiceId: string) => {
    try {
      // Verify before claiming
      await requireVerification("claim");

      const response = await fetch(`/api/invoices/${invoiceId}/claim`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });

      if (!response.ok) throw new Error("Claim failed");
      return await response.json();
    } catch (error) {
      if (error instanceof Error && error.message === "Verification cancelled") {
        console.log("Claim cancelled");
      }
      throw error;
    }
  };

  return { claimFunds };
}

// ─── Example 6: Manual Verification Check ─────────────────────────────────────

/**
 * For advanced scenarios where you need finer control over verification flow
 */
export function useManualVerification() {
  const wallet = useWallet();
  const [isVerifying, setIsVerifying] = React.useState(false);

  const manualVerify = async () => {
    setIsVerifying(true);
    try {
      // Check if already verified
      if (wallet.checkVerification()) {
        console.log("Already verified");
        return true;
      }

      // Perform verification
      const verified = await wallet.verifyOwnership();
      return verified;
    } catch (error) {
      console.error("Manual verification failed:", error);
      return false;
    } finally {
      setIsVerifying(false);
    }
  };

  return { manualVerify, isVerifying, isVerified: wallet.isVerified };
}

// ─── Example 7: Protected Button Component ────────────────────────────────────

export function ProtectedActionButton({
  actionType,
  onClick,
  children,
}: {
  actionType: "invoice-creation" | "funding" | "repayment" | "claim";
  onClick: () => Promise<void>;
  children: React.ReactNode;
}) {
  const { requireVerification, isVerified, isLoading } = useVerification();
  const [isExecuting, setIsExecuting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const handleClick = async () => {
    setIsExecuting(true);
    setError(null);

    try {
      // Ensure verification
      await requireVerification(actionType);

      // Execute the protected action
      await onClick();
    } catch (err) {
      if (err instanceof Error && err.message !== "Verification cancelled") {
        setError(err.message);
      }
    } finally {
      setIsExecuting(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleClick}
        disabled={isExecuting || isLoading}
        className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
      >
        {isExecuting || isLoading ? "Processing..." : children}
      </button>
      {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
    </div>
  );
}

// ─── Setup Guide ──────────────────────────────────────────────────────────────

/**
 * To use verification in your app:
 * 
 * 1. Add VerificationProvider to your root layout:
 *    ```tsx
 *    // app/providers.tsx
 *    import { VerificationProvider } from "@/components/wallet/VerificationProvider";
 *    
 *    export function Providers({ children }: { children: React.ReactNode }) {
 *      return (
 *        <VerificationProvider>
 *          {children}
 *        </VerificationProvider>
 *      );
 *    }
 *    ```
 * 
 * 2. Use the hooks in your components:
 *    ```tsx
 *    const { requireVerification } = useVerification();
 *    
 *    const handleAction = async () => {
 *      await requireVerification("invoice-creation");
 *      // Proceed with action
 *    };
 *    ```
 * 
 * 3. The VerificationModal will automatically show when needed
 */
