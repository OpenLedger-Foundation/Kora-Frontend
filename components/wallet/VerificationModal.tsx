import { useState } from "react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface VerificationModalProps {
  isOpen: boolean;
  isLoading?: boolean;
  error?: string;
  actionType?: string;
  onVerify: () => Promise<void>;
  onCancel: () => void;
}

export function VerificationModal({
  isOpen,
  isLoading = false,
  error,
  actionType,
  onVerify,
  onCancel,
}: VerificationModalProps) {
  const [localError, setLocalError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      setLocalError(null);
      await onVerify();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : "Verification failed. Please try again."
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Verify Wallet Ownership</DialogTitle>
          <DialogDescription>
            Your verification has expired. Please sign a message with your wallet to continue
            {actionType && ` with ${actionType}`}.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <div className="text-sm text-red-500">{error}</div>}
          {localError && <div className="text-sm text-red-500">{localError}</div>}

          <p className="text-sm text-gray-600">
            A message will be sent to your wallet for signing. You will not be charged any gas fees.
          </p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              Cancel
            </Button>
            <Button onClick={handleVerify} disabled={isLoading}>
              {isLoading ? "Verifying..." : "Verify Ownership"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
