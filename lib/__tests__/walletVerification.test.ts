import * as StellarSdk from "@stellar/stellar-sdk";
import { generateChallenge, verifySignature } from "@/lib/walletVerification";

describe("walletVerification", () => {
  describe("generateChallenge", () => {
    it("generates a challenge with correct format", () => {
      const challenge = generateChallenge();
      expect(challenge).toMatch(/^Kora Protocol authentication: \d+$/);
    });
  });

  describe("verifySignature", () => {
    it("validates a correct signature", () => {
      const keypair = StellarSdk.Keypair.random();
      const challenge = generateChallenge();
      const signature = keypair.sign(Buffer.from(challenge, "utf-8")).toString("base64");

      const result = verifySignature(challenge, signature, keypair.publicKey());
      expect(result.valid).toBe(true);
    });

    it("rejects an incorrect signature", () => {
      const keypair = StellarSdk.Keypair.random();
      const wrongKeypair = StellarSdk.Keypair.random();
      const challenge = generateChallenge();
      const signature = wrongKeypair.sign(Buffer.from(challenge, "utf-8")).toString("base64");

      const result = verifySignature(challenge, signature, keypair.publicKey());
      expect(result.valid).toBe(false);
    });

    it("rejects an expired challenge", () => {
      const keypair = StellarSdk.Keypair.random();
      const oldTimestamp = Date.now() - 6 * 60 * 1000; // 6 minutes ago
      const challenge = `Kora Protocol authentication: ${oldTimestamp}`;
      const signature = keypair.sign(Buffer.from(challenge, "utf-8")).toString("base64");

      const result = verifySignature(challenge, signature, keypair.publicKey());
      expect(result.valid).toBe(false);
      expect(result.message).toBe("Challenge expired");
    });

    it("rejects an invalid challenge format", () => {
      const keypair = StellarSdk.Keypair.random();
      const challenge = "Invalid challenge format";
      const signature = keypair.sign(Buffer.from(challenge, "utf-8")).toString("base64");

      const result = verifySignature(challenge, signature, keypair.publicKey());
      expect(result.valid).toBe(false);
    });
  });
});
