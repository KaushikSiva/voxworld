import { NextRequest, NextResponse } from "next/server";
import { getVerificationState } from "@/lib/worldAgentKitAdapter";
import { runProtectedMerchantAction } from "@/lib/merchantService";
import { getCoinbasePaymentLabel } from "@/lib/coinbasePayAdapter";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      transcript?: string;
      selectedItemId?: string | null;
    };

    if (!body.transcript?.trim()) {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    const verification = await getVerificationState();
    if (verification.status !== "verified") {
      return NextResponse.json({ error: "Agent must be verified before payment confirmation." }, { status: 403 });
    }

    const actionResult = await runProtectedMerchantAction({
      transcript: body.transcript.trim(),
      userId: "demo-user",
      verification
    });

    return NextResponse.json({
      ok: actionResult.ok,
      spokenReply: `${getCoinbasePaymentLabel(body.selectedItemId ?? actionResult.selectedItemId)} complete. ${actionResult.merchant.spokenReply}`,
      actionSummary: `${actionResult.merchant.summary} Coinbase Pay confirmation completed.`,
      parsedIntent: actionResult.parsedIntent,
      selectedItemId: actionResult.selectedItemId,
      bookingReady: false,
      paymentReady: false,
      paymentLabel: null,
      events: []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to complete Coinbase Pay confirmation." },
      { status: 500 }
    );
  }
}
