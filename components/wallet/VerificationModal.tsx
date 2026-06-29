import { useState } from "react";
import { useTranslations } from "next-intl";
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
  const t = useTranslations("wallet");
  const [localError, setLocalError] = useState<string | null>(null);

  const handleVerify = async () => {
    try {
      setLocalError(null);
      await onVerify();
    } catch (err) {
      setLocalError(
        err instanceof Error ? err.message : t("verification.failed")
      );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("verification.title")}</DialogTitle>
          <DialogDescription>
            {actionType
              ? t("verification.descriptionWithAction", { actionType })
              : t("verification.description")}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {error && <div className="text-sm text-red-500">{error}</div>}
          {localError && <div className="text-sm text-red-500">{localError}</div>}

          <p className="text-sm text-gray-600">
            {t("verification.signMessageHint")}
          </p>

          <div className="flex gap-3">
            <Button variant="outline" onClick={onCancel} disabled={isLoading}>
              {t("cancel")}
            </Button>
            <Button onClick={handleVerify} disabled={isLoading}>
              {isLoading ? t("verification.verifyingButton") : t("verification.verifyButton")}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
