import * as StellarSdk from "@stellar/stellar-sdk";

const CHALLENGE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

export function generateChallenge(): string {
  const timestamp = Date.now();
  return `Kora Protocol authentication: ${timestamp}`;
}

export function verifySignature(
  challenge: string,
  signature: string,
  publicKey: string
): { valid: boolean; message?: string } {
  try {
    const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
    const valid = keypair.verify(
      Buffer.from(challenge, "utf-8"),
      Buffer.from(signature, "base64")
    );

    if (!valid) {
      return { valid: false, message: "Signature verification failed" };
    }

    // Extract and validate timestamp from challenge
    const timestampMatch = challenge.match(/Kora Protocol authentication: (\d+)/);
    if (!timestampMatch) {
      return { valid: false, message: "Invalid challenge format" };
    }

    const challengeTimestamp = parseInt(timestampMatch[1], 10);
    const now = Date.now();

    if (now - challengeTimestamp > CHALLENGE_MAX_AGE) {
      return { valid: false, message: "Challenge expired" };
    }

    return { valid: true };
  } catch (error) {
    return { valid: false, message: error instanceof Error ? error.message : "Verification failed" };
  }
}
