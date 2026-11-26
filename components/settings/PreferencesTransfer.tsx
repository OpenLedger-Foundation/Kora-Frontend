"use client";

/**
 * Encrypted export/import of local preferences (#1241).
 *
 * Settings and the address book (which holds addresses and private labels) are
 * bundled and encrypted with a user passphrase before leaving the browser.
 */

import { useRef, useState } from "react";
import { Download, Upload } from "lucide-react";
import { useTranslations } from "next-intl";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useSettingsStore, sanitizeSettings } from "@/store/settingsStore";
import { useWalletStore } from "@/store";
import { decryptPreferences, encryptPreferences } from "@/lib/preferencesCrypto";

const MIN_PASSPHRASE_LENGTH = 8;

type Status = { kind: "success" | "error"; message: string } | null;

export function PreferencesTransfer() {
  const t = useTranslations("settings.transfer");
  const [passphrase, setPassphrase] = useState("");
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const passphraseValid = passphrase.length >= MIN_PASSPHRASE_LENGTH;

  const handleExport = async () => {
    if (!passphraseValid) return;
    setBusy(true);
    setStatus(null);
    try {
      const { notifications, tour, concentration } = useSettingsStore.getState();
      const addressBook = useWalletStore
        .getState()
        .addressBook.map(({ address, label }) => ({ address, label }));
      const encrypted = await encryptPreferences(
        { settings: { notifications, tour, concentration }, addressBook },
        passphrase,
      );
      const blob = new Blob([JSON.stringify(encrypted)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `kora-preferences-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus({ kind: "success", message: t("exported") });
    } catch {
      setStatus({ kind: "error", message: t("exportFailed") });
    } finally {
      setBusy(false);
    }
  };

  const handleImport = async (file: File) => {
    setBusy(true);
    setStatus(null);
    try {
      const data = (await decryptPreferences(await file.text(), passphrase)) as {
        settings?: unknown;
        addressBook?: unknown;
      };
      const { notifications, tour, concentration } = sanitizeSettings(data?.settings);
      const store = useSettingsStore.getState();
      store.setNotifications(notifications);
      store.setTourSettings(tour);
      store.setConcentrationThresholds(concentration.thresholds);

      if (Array.isArray(data?.addressBook)) {
        const { addAddressBookEntry } = useWalletStore.getState();
        for (const entry of data.addressBook) {
          if (entry && typeof entry.address === "string") {
            addAddressBookEntry(entry.address, typeof entry.label === "string" ? entry.label : "");
          }
        }
      }
      setStatus({ kind: "success", message: t("imported") });
    } catch {
      setStatus({ kind: "error", message: t("importFailed") });
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <section aria-labelledby="preferences-transfer-title" className="space-y-4">
      <div>
        <h2 id="preferences-transfer-title" className="text-lg font-semibold text-foreground">
          {t("title")}
        </h2>
        <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
      </div>

      <Input
        label={t("passphrase")}
        type="password"
        autoComplete="new-password"
        value={passphrase}
        onChange={(e) => setPassphrase(e.target.value)}
        hint={t("passphraseHint", { min: MIN_PASSPHRASE_LENGTH })}
      />

      <div className="flex flex-wrap gap-3">
        <Button
          variant="outline"
          onClick={handleExport}
          disabled={!passphraseValid || busy}
        >
          <Download className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("export")}
        </Button>
        <Button
          variant="outline"
          onClick={() => fileRef.current?.click()}
          disabled={!passphraseValid || busy}
        >
          <Upload className="mr-2 h-4 w-4" aria-hidden="true" />
          {t("import")}
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          className="sr-only"
          aria-label={t("import")}
          tabIndex={-1}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void handleImport(file);
          }}
        />
      </div>

      {status && (
        <p
          role={status.kind === "error" ? "alert" : "status"}
          className={
            status.kind === "error" ? "text-sm text-red-400" : "text-sm text-emerald-400"
          }
        >
          {status.message}
        </p>
      )}
    </section>
  );
}
