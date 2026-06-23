import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";

interface ChallengeResponse {
  challenge: string;
  timestamp: number;
}

/**
 * POST /api/auth/challenge
 * Generates a server-side nonce challenge for wallet ownership verification.
 * The client will sign this challenge with their private key.
 */
export async function POST(_request: NextRequest): Promise<NextResponse> {
  try {
    const nonce = randomBytes(32).toString("hex");
    const timestamp = Date.now();
    const challenge = `Verify wallet ownership\nNonce: ${nonce}\nTimestamp: ${timestamp}`;

    return NextResponse.json<ChallengeResponse>({ challenge, timestamp });
  } catch (error) {
    console.error("Error generating challenge:", error);
    return NextResponse.json({ error: "Failed to generate challenge" }, { status: 500 });
  }
}
