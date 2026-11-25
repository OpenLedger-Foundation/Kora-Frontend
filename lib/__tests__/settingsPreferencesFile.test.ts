import { webcrypto } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { decryptPreferences, encryptPreferences } from "../settingsPreferencesFile";
import { DEFAULT_NOTIFICATION_PREFS, useSettingsStore } from "@/store/settingsStore";

const passphrase = "test preferences passphrase";
const state = {
  notifications: { ...DEFAULT_NOTIFICATION_PREFS, txConfirmed: false, apr: true, token: "excluded-secret" },
  concentration: { thresholds: { debtor: 11, jurisdiction: 22, riskTier: 33 }, dismissedKeys: ["private-note"], snoozes: [] },
  activeWallet: "private-wallet",
};

beforeAll(() => { vi.stubGlobal("crypto", webcrypto); });
afterAll(() => { vi.unstubAllGlobals(); });

describe("encrypted preferences", () => {
  it("uses fresh salts and IVs and projects only portable fields", async () => {
    const first = await encryptPreferences(state, passphrase);
    const second = await encryptPreferences(state, passphrase);
    expect(JSON.parse(first).salt).not.toBe(JSON.parse(second).salt);
    expect(JSON.parse(first).iv).not.toBe(JSON.parse(second).iv);
    expect(first).not.toMatch(/private-wallet|private-note|excluded-secret|txConfirmed/);
    const { token: _, ...notifications } = state.notifications;
    expect(await decryptPreferences(first, passphrase)).toEqual({
      notifications, thresholds: state.concentration.thresholds,
    });
  }, 30_000);

  it("rejects the wrong passphrase and changed ciphertext", async () => {
    const encrypted = await encryptPreferences(state, passphrase);
    await expect(decryptPreferences(encrypted, "wrong")).rejects.toMatchObject({ code: "decryptFailed" });
    const file = JSON.parse(encrypted);
    file.ciphertext = (file.ciphertext.startsWith("A") ? "B" : "A") + file.ciphertext.slice(1);
    await expect(decryptPreferences(JSON.stringify(file), passphrase)).rejects.toMatchObject({ code: "decryptFailed" });
  }, 30_000);

  it("rejects malformed files and unknown versions", async () => {
    await expect(decryptPreferences("{", passphrase)).rejects.toMatchObject({ code: "invalidFile" });
    await expect(decryptPreferences('{"format":"kora-preferences","version":99}', passphrase))
      .rejects.toMatchObject({ code: "unsupportedVersion" });
  }, 30_000);

  it("authenticates, then rejects an unexpected payload without applying it", async () => {
    const file = JSON.parse(await encryptPreferences(state, passphrase));
    const { salt, iv, ciphertext: _, ...metadata } = file;
    const enc = new TextEncoder();
    const material = await crypto.subtle.importKey("raw", enc.encode(passphrase), "PBKDF2", false, ["deriveKey"]);
    const key = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt: Uint8Array.from(Buffer.from(salt, "base64")), iterations: 600_000, hash: "SHA-256" },
      material, { name: "AES-GCM", length: 256 }, false, ["encrypt"],
    );
    const ciphertext = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv: Uint8Array.from(Buffer.from(iv, "base64")), additionalData: enc.encode(JSON.stringify(metadata)) },
      key, enc.encode('{"notifications":{"token":"secret"}}'),
    );
    const previous = useSettingsStore.getState();
    const input = JSON.stringify({ ...file, ciphertext: Buffer.from(ciphertext).toString("base64") });
    await expect(decryptPreferences(input, passphrase).then(previous.importPreferences))
      .rejects.toMatchObject({ code: "invalidSettings" });
    expect(useSettingsStore.getState()).toBe(previous);
  }, 30_000);

  it("applies validated preferences together and preserves transient settings", async () => {
    const previous = useSettingsStore.getState();
    const preferences = await decryptPreferences(await encryptPreferences(state, passphrase), passphrase);
    previous.importPreferences(preferences);
    const updated = useSettingsStore.getState();
    expect(updated.notifications).toEqual(preferences.notifications);
    expect(updated.concentration.thresholds).toEqual(preferences.thresholds);
    expect(updated.concentration.dismissedKeys).toBe(previous.concentration.dismissedKeys);
    expect(updated.tour).toBe(previous.tour);
  }, 30_000);
});
