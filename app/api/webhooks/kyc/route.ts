import { NextResponse } from "next/server";

/**
 * Synaps KYC Webhook Handler Stub
 * 
 * Endpoint: POST /api/webhooks/kyc
 * 
 * This stub receives webhook event callbacks from the Synaps KYC verification service.
 * In a production backend, this handler validates the signature of the payload using
 * a webhook secret, maps the Synaps event payload to a local user ID, and updates the
 * user's database record (setting `kycStatus` to `"pending"`, `"verified"`, or `"rejected"`).
 * 
 * Reference API: https://docs.synaps.io/webhooks
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    console.log("[Synaps Webhook] Received KYC event:", body);

    // 1. Verify webhook signature (using Synaps header signature and secret)
    const signature = request.headers.get("x-synaps-signature");
    if (!signature) {
      return NextResponse.json(
        { success: false, message: "Missing webhook signature" },
        { status: 401 }
      );
    }

    // 2. Extract verification details
    // Payload scheme details: https://docs.synaps.io/webhooks/payloads
    const { event, user_id, status } = body;

    // 3. Map status and perform database/state persistence
    let mappedStatus: "none" | "pending" | "verified" | "rejected" = "none";
    if (status === "APPROVED") {
      mappedStatus = "verified";
    } else if (status === "REJECTED") {
      mappedStatus = "rejected";
    } else if (status === "SUBMITTED" || status === "PENDING") {
      mappedStatus = "pending";
    }

    console.log(
      `[Synaps Webhook] Updating user ${user_id} KYC status to: ${mappedStatus}`
    );

    // Mock response
    return NextResponse.json({
      success: true,
      message: "Webhook processed successfully",
      data: {
        userId: user_id,
        event,
        kycStatus: mappedStatus,
      },
    });
  } catch (error) {
    console.error("[Synaps Webhook] Error processing event:", error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
