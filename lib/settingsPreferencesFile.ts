import { z } from "zod";
import type { useSettingsStore } from "@/store/settingsStore";

const notificationsSchema = z.object({
  txConfirmed: z.boolean(),
  invoiceFunded: z.boolean(),
  yieldAvailable: z.boolean(),
  maturityReminder: z.boolean(),
  fundingAlerts: z.boolean(),
  repaymentAlerts: z.boolean(),
  maturityReminderDays: z.union([z.literal(1), z.literal(3), z.literal(7)]),
  fundingProgress: z.boolean(),
  status: z.boolean(),
  apr: z.boolean(),
});

const threshold = z.number().finite().min(0).max(100);
const thresholdsSchema = z.object({
  debtor: threshold,
  jurisdiction: threshold,
  riskTier: threshold,
});
const preferencesSchema = z.object({
  notifications: notificationsSchema.strict(),
  thresholds: thresholdsSchema.strict(),
}).strict();

const metadata = {
  format: "kora-preferences",
  version: 1,
  cipher: "AES-GCM",
  kdf: "PBKDF2",
  hash: "SHA-256",
  iterations: 600_000,
} as const;

const envelopeSchema = z.object({
  format: z.literal(metadata.format),
  version: z.literal(metadata.version),
  cipher: z.literal(metadata.cipher),
  kdf: z.literal(metadata.kdf),
  hash: z.literal(metadata.hash),
  iterations: z.literal(metadata.iterations),
  salt: z.string(),
  iv: z.string(),
  ciphertext: z.string(),
}).strict();

export const MAX_PREFERENCES_FILE_SIZE = 16_384;
export type PreferencesErrorCode = "invalidFile" | "unsupportedVersion" | "decryptFailed" | "invalidSettings";

export class PreferencesError extends Error {
  constructor(readonly code: PreferencesErrorCode) {
    super(code);
  }
}

function encode(bytes: Uint8Array) {
  return btoa(String.fromCharCode(...bytes));
}

function decode(value: string) {
  try {
    const bytes = Uint8Array.from(atob(value), (char) => char.charCodeAt(0));
    if (encode(bytes) === value) return bytes;
  } catch {
    // Invalid base64.
  }
  throw new PreferencesError("invalidFile");
}

function parseJSON(text: string, code: PreferencesErrorCode): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new PreferencesError(code);
  }
}

const encoder = new TextEncoder();
const additionalData = encoder.encode(JSON.stringify(metadata));

async function deriveKey(passphrase: string, salt: Uint8Array<ArrayBuffer>) {
  const material = await crypto.subtle.importKey(
    "raw", encoder.encode(passphrase), "PBKDF2", false, ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: metadata.kdf, hash: metadata.hash, iterations: metadata.iterations, salt },
    material, { name: metadata.cipher, length: 256 }, false, ["encrypt", "decrypt"],
  );
}

export async function encryptPreferences(
  state: Pick<ReturnType<typeof useSettingsStore.getState>, "notifications" | "concentration">,
  passphrase: string,
) {
  // The non-strict inner schemas project only portable fields on export.
  const preferences = {
    notifications: notificationsSchema.parse(state.notifications),
    thresholds: thresholdsSchema.parse(state.concentration.thresholds),
  };
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: metadata.cipher, iv, additionalData }, key, encoder.encode(JSON.stringify(preferences)),
  );
  return JSON.stringify({ ...metadata, salt: encode(salt), iv: encode(iv), ciphertext: encode(new Uint8Array(ciphertext)) });
}

export async function decryptPreferences(text: string, passphrase: string) {
  if (text.length > MAX_PREFERENCES_FILE_SIZE) throw new PreferencesError("invalidFile");
  const raw = parseJSON(text, "invalidFile");
  const header = z.object({ format: z.literal(metadata.format), version: z.number().int() }).safeParse(raw);
  if (!header.success) throw new PreferencesError("invalidFile");
  if (header.data.version !== metadata.version) throw new PreferencesError("unsupportedVersion");

  const envelope = envelopeSchema.safeParse(raw);
  if (!envelope.success) throw new PreferencesError("invalidFile");
  const salt = decode(envelope.data.salt);
  const iv = decode(envelope.data.iv);
  const ciphertext = decode(envelope.data.ciphertext);
  if (salt.length !== 16 || iv.length !== 12 || ciphertext.length <= 16) {
    throw new PreferencesError("invalidFile");
  }

  const key = await deriveKey(passphrase, salt);
  let plaintext: ArrayBuffer;
  try {
    plaintext = await crypto.subtle.decrypt({ name: metadata.cipher, iv, additionalData }, key, ciphertext);
  } catch {
    throw new PreferencesError("decryptFailed");
  }
  const preferences = preferencesSchema.safeParse(
    parseJSON(new TextDecoder().decode(plaintext), "invalidSettings"),
  );
  if (!preferences.success) throw new PreferencesError("invalidSettings");
  return preferences.data;
}
