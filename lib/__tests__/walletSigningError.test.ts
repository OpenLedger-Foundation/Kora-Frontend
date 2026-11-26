/**
 * Unit tests for lib/walletSigningError.ts (#1121).
 *
 * The classifier decides what a wallet rejection *means*, and that decision
 * drives whether the app offers a re-sign (interrupted) or stays quiet
 * (rejected). Both directions matter: misclassifying a refusal as an
 * interruption nags users who already said no, and misclassifying an
 * interruption as a refusal silently loses a transaction that was never
 * signed.
 */

import { describe, it, expect } from "vitest";
import {
  WalletSigningError,
  classifySigningError,
  isInterruptedSigningError,
  type SigningErrorKind,
} from "../walletSigningError";

describe("classifySigningError", () => {
  describe("rejected — the user said no", () => {
    const cases: Array<[string, unknown]> = [
      ["plain rejection wording", new Error("User rejected the request")],
      ["declined wording", new Error("Request was denied by the user")],
      ["cancel wording", new Error("The signing request was cancelled")],
      ["provider message", new Error("User declined to sign this transaction")],
      ["EIP-1193 code on a plain object", { code: 4001, message: "something" }],
      ["EIP-1193 code as a string", { code: "4001" }],
    ];

    it.each(cases)("%s", (_label, error) => {
      expect(classifySigningError(error)).toBe("rejected");
    });
  });

  describe("interrupted — no answer ever came back", () => {
    const cases: Array<[string, unknown]> = [
      ["popup closed by the user", new Error("User closed the popup")],
      ["window closed", new Error("The window was closed before signing")],
      ["dialog dismissed", new Error("Signing dialog dismissed")],
      ["request timeout", new Error("Request timed out waiting for the wallet")],
      ["generic timeout", new Error("timeout")],
      ["no response", new Error("The wallet did not respond")],
      ["aborted AbortController", Object.assign(new Error("aborted"), { name: "AbortError" })],
      ["provider object payload", { message: "Popup was closed by the user" }],
      ["nested provider error", { error: { message: "Request was interrupted" } }],
    ];

    it.each(cases)("%s", (_label, error) => {
      expect(classifySigningError(error)).toBe("interrupted");
    });
  });

  describe("disconnected — the wallet is present but not usable", () => {
    const cases: Array<[string, unknown]> = [
      ["not connected", new Error("Wallet not connected")],
      ["session expired", new Error("Session expired, please reconnect")],
      ["unauthorized", new Error("Unauthorized: no public key for this account")],
      ["wrong network", new Error("Wallet is on the wrong network")],
    ];

    it.each(cases)("%s", (_label, error) => {
      expect(classifySigningError(error)).toBe("disconnected");
    });
  });

  describe("missing-extension — the software is not there", () => {
    const cases: Array<[string, unknown]> = [
      ["not installed", new Error("Freighter is not installed")],
      ["install instruction", new Error("Please install the Freighter extension")],
      ["no wallet found", new Error("Could not find a Stellar wallet extension")],
      ["module missing", new Error("Freighter is not defined")],
    ];

    it.each(cases)("%s", (_label, error) => {
      expect(classifySigningError(error)).toBe("missing-extension");
    });
  });

  describe("unknown — never guess", () => {
    const cases: Array<[string, unknown]> = [
      ["unrecognised message", new Error("QuotaExceededError: storage is full")],
      ["empty string", ""],
      ["whitespace", "   "],
      ["null", null],
      ["undefined", undefined],
      ["number", 42],
      ["plain object without message", { foo: "bar" }],
    ];

    it.each(cases)("%s", (_label, error) => {
      expect(classifySigningError(error)).toBe("unknown");
    });

    it("survives a circular object instead of throwing", () => {
      const circular: Record<string, unknown> = { message: "hmm" };
      circular.self = circular;

      expect(() => classifySigningError(circular)).not.toThrow();
      expect(classifySigningError(circular)).toBe("unknown");
    });
  });

  describe("precedence", () => {
    it("keeps an explicit refusal classified as rejected even when the popup closed", () => {
      // "user closed the popup" would otherwise read as an interruption and
      // re-prompt someone who deliberately declined.
      expect(classifySigningError(new Error("User rejected and closed the popup"))).toBe(
        "rejected"
      );
    });

    it("prefers disconnected over missing-extension for 'not connected'", () => {
      // Both rules mention an unusable wallet; only one of them is fixable by
      // reconnecting rather than by installing software.
      expect(classifySigningError(new Error("Wallet is not connected"))).toBe("disconnected");
    });

    it("returns the kind of an already-classified error unchanged", () => {
      const error = new WalletSigningError("interrupted", "popup closed");

      expect(classifySigningError(error)).toBe("interrupted");
    });
  });

  it("covers every declared kind", () => {
    // Guards against adding a kind without teaching the rules about it.
    const kinds: SigningErrorKind[] = [
      "rejected",
      "interrupted",
      "missing-extension",
      "disconnected",
      "unknown",
    ];
    const produced = new Set<SigningErrorKind>([
      classifySigningError(new Error("rejected")),
      classifySigningError(new Error("closed the popup")),
      classifySigningError(new Error("not installed")),
      classifySigningError(new Error("not connected")),
      classifySigningError(new Error("???")),
    ]);

    expect([...produced].sort()).toEqual([...kinds].sort());
  });
});

describe("WalletSigningError", () => {
  it("carries its kind and keeps the provider message", () => {
    const error = new WalletSigningError("interrupted", "popup closed", {
      cause: new Error("original"),
    });

    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("WalletSigningError");
    expect(error.kind).toBe("interrupted");
    expect(error.message).toBe("popup closed");
  });

  it("defaults its message to the kind", () => {
    expect(new WalletSigningError("unknown").message).toBe("unknown");
  });
});

describe("isInterruptedSigningError", () => {
  it("is true only for interruptions", () => {
    expect(isInterruptedSigningError(new Error("The popup was closed"))).toBe(true);
    expect(isInterruptedSigningError(new Error("User rejected the request"))).toBe(false);
  });
});
