/**
 * Passphrase-based encryption for exported local preferences (#1241).
 *
 * Exports can contain wallet addresses and private notes, so they are never
 * written as plain JSON. Uses Web Crypto: PBKDF2-SHA256 → AES-GCM-256.
 */

export const PREFERENCES_EXPORT_FORMAT = "kora-prefs-v1";
const PBKDF2_ITERATIONS = 210_000;

export interface EncryptedPreferences {
  format: typeof PREFERENCES_EXPORT_FORMAT;
  salt: string;
  iv: string;
  data: string;
}

function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  return Uint8Array.from(atob(value), (c) => c.charCodeAt(0));
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
    material,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptPreferences(
  payload: unknown,
  passphrase: string,
): Promise<EncryptedPreferences> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    new TextEncoder().encode(JSON.stringify(payload)),
  );
  return {
    format: PREFERENCES_EXPORT_FORMAT,
    salt: toBase64(salt),
    iv: toBase64(iv),
    data: toBase64(new Uint8Array(cipher)),
  };
}

/**
 * Decrypts an exported file. Throws on a malformed file or wrong passphrase.
 */
export async function decryptPreferences(
  raw: string,
  passphrase: string,
): Promise<unknown> {
  const envelope = JSON.parse(raw) as Partial<EncryptedPreferences>;
  if (
    envelope?.format !== PREFERENCES_EXPORT_FORMAT ||
    typeof envelope.salt !== "string" ||
    typeof envelope.iv !== "string" ||
    typeof envelope.data !== "string"
  ) {
    throw new Error("invalid-format");
  }
  const key = await deriveKey(passphrase, fromBase64(envelope.salt));
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: fromBase64(envelope.iv) as BufferSource },
    key,
    fromBase64(envelope.data) as BufferSource,
  );
  return JSON.parse(new TextDecoder().decode(plain));
}
