"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useSettingsStore } from "@/store/settingsStore";
import {
  decryptPreferences, encryptPreferences, MAX_PREFERENCES_FILE_SIZE, PreferencesError,
} from "@/lib/settingsPreferencesFile";

type Mode = "export" | "import";

export function PreferencesBackup() {
  const t = useTranslations("settings.backup");
  const [feedback, setFeedback] = useState<Mode | null>(null);
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">{t("title")}</h2>
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      <div className="flex flex-wrap gap-2">
        <BackupDialog mode="export" onSuccess={setFeedback} />
        <BackupDialog mode="import" onSuccess={setFeedback} />
      </div>
      <p role="status" className="text-sm">{feedback && t(feedback === "export" ? "exported" : "imported")}</p>
    </div>
  );
}

function BackupDialog({ mode, onSuccess }: { mode: Mode; onSuccess: (mode: Mode) => void }) {
  const t = useTranslations("settings.backup");
  const id = useId();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const operation = useRef(0);
  const form = useRef<HTMLFormElement>(null);
  const importing = mode === "import";

  useEffect(() => () => { operation.current += 1; }, []);

  function changeOpen(next: boolean) {
    operation.current += 1;
    if (!next) form.current?.reset();
    setOpen(next);
    setBusy(false);
    setError("");
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    const fields = new FormData(event.currentTarget);
    const passphrase = String(fields.get("passphrase") ?? "");
    const file = fields.get("preferences");
    const current = ++operation.current;
    const settings = useSettingsStore.getState();
    setBusy(true);
    setError("");
    try {
      if (importing) {
        if (!(file instanceof File) || !file.size || file.size > MAX_PREFERENCES_FILE_SIZE) {
          throw new PreferencesError("invalidFile");
        }
        const preferences = await decryptPreferences(await file.text(), passphrase);
        if (current !== operation.current) return;
        const latest = useSettingsStore.getState();
        if (latest.activeWallet !== settings.activeWallet) {
          setError(t("walletChanged"));
          return;
        }
        latest.importPreferences(preferences);
      } else {
        const encrypted = await encryptPreferences(settings, passphrase);
        if (current !== operation.current) return;
        const url = URL.createObjectURL(new Blob([encrypted], { type: "application/json" }));
        const link = document.createElement("a");
        link.href = url;
        link.download = "kora-preferences.json";
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 0);
      }
      onSuccess(mode);
      changeOpen(false);
    } catch (failure) {
      if (current === operation.current) {
        setError(t(failure instanceof PreferencesError ? failure.code : "failed"));
      }
    } finally {
      if (current === operation.current) setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={changeOpen}>
      <DialogTrigger asChild><Button variant="outline">{t(mode)}</Button></DialogTrigger>
      <DialogContent closeLabel={t("close")} className="max-h-[90dvh] w-[calc(100%-2rem)] overflow-y-auto">
        <DialogTitle>{t(mode)}</DialogTitle>
        <DialogDescription>{t(importing ? "confirmImport" : "guidance")}</DialogDescription>
        <form ref={form} onSubmit={submit} className="space-y-4" aria-busy={busy}>
          {importing && (
            <div className="space-y-1">
              <label htmlFor={id + "-file"}>{t("file")}</label>
              <Input id={id + "-file"} name="preferences" type="file" accept=".json,application/json" required />
            </div>
          )}
          <div className="space-y-1">
            <label htmlFor={id}>{t("passphrase")}</label>
            <Input id={id} name="passphrase" type="password" autoComplete="off" required minLength={importing ? undefined : 12} />
          </div>
          {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy}>{t(importing ? "apply" : "download")}</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
