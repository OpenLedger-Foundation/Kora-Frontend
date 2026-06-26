import { NextRequest, NextResponse } from "next/server";
import * as StellarSdk from "@stellar/stellar-sdk";

interface VerifyRequest {
  challenge: string;
  signature: string;
  publicKey: string;
}

interface VerifyResponse {
  verified: boolean;
  expiresAt: number;
  message?: string;
}

/**
 * POST /api/auth/verify
 * Verifies that a signature is valid for the given challenge and public key.
 * Uses Stellar SDK to verify the signature.
 */
export async function POST(request: NextRequest): Promise<NextResponse<VerifyResponse>> {
  try {
    const body = await request.json() as VerifyRequest;
    const { challenge, signature, publicKey } = body;

    // Validate inputs
    if (!challenge || !signature || !publicKey) {
      return NextResponse.json(
        {
          verified: false,
          expiresAt: 0,
          message: "Missing required fields: challenge, signature, publicKey",
        },
        { status: 400 }
      );
    }

    // Verify the signature using Stellar SDK's Keypair
    try {
      const keypair = StellarSdk.Keypair.fromPublicKey(publicKey);
      const valid = keypair.verify(
        Buffer.from(challenge, "utf-8"),
        Buffer.from(signature, "base64")
      );

      if (!valid) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Signature verification failed",
        });
      }

      // Extract timestamp from challenge to validate freshness
      const timestampMatch = challenge.match(/Timestamp: (\d+)/);
      if (!timestampMatch) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Invalid challenge format",
        });
      }

      const challengeTimestamp = parseInt(timestampMatch[1], 10);
      const now = Date.now();
      const CHALLENGE_MAX_AGE = 5 * 60 * 1000; // 5 minutes

      // Verify challenge freshness
      if (now - challengeTimestamp > CHALLENGE_MAX_AGE) {
        return NextResponse.json({
          verified: false,
          expiresAt: 0,
          message: "Challenge expired",
        });
      }

      // Verification successful - session valid for 1 hour
      const SESSION_DURATION = 60 * 60 * 1000; // 1 hour
      const expiresAt = now + SESSION_DURATION;

      return NextResponse.json({
        verified: true,
        expiresAt,
      });
    } catch (verifyError) {
      console.error("Verification error:", verifyError);
      return NextResponse.json({
        verified: false,
        expiresAt: 0,
        message: "Failed to verify signature",
      });
    }
  } catch (error) {
    console.error("Error processing verify request:", error);
    return NextResponse.json(
      { verified: false, expiresAt: 0, message: "Internal server error" },
      { status: 500 }
    );
  }
}
