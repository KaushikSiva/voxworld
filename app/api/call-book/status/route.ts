import { NextRequest, NextResponse } from "next/server";
import { getVerificationState } from "@/lib/worldAgentKitAdapter";
import { getBookingCall } from "@/lib/voiceCallAdapter";
import { CallBookingResponse } from "@/lib/types";
import { getCoinbasePaymentLabel } from "@/lib/coinbasePayAdapter";
import { demoInventory } from "@/lib/demoInventory";

function hasDoneConfirmation(
  turns: Array<{
    speaker: string;
    text: string;
    created_at?: string;
  }>
) {
  return turns.some((turn) => turn.speaker === "user" && /\bdone\b/i.test(turn.text));
}

function inferSelectedItemId(transcript: string) {
  const value = transcript.toLowerCase();
  if (value.includes("cowork") || value.includes("desk") || value.includes("day pass")) {
    return "coworking-pass";
  }
  if (value.includes("ticket") || value.includes("event")) {
    return "event-ticket";
  }
  return "coffee-subscription";
}

export async function GET(request: NextRequest) {
  try {
    const callId = request.nextUrl.searchParams.get("callId");
    const transcript = request.nextUrl.searchParams.get("transcript");

    if (!callId || !transcript?.trim()) {
      return NextResponse.json({ error: "callId and transcript are required." }, { status: 400 });
    }

    const { call, transcript: transcriptTurns } = await getBookingCall(callId);
    const normalizedTurns = transcriptTurns.map((turn) => ({
      speaker: turn.speaker,
      text: turn.text,
      createdAt: turn.created_at
    }));

    if (hasDoneConfirmation(transcriptTurns)) {
      const verification = await getVerificationState();
      const selectedItemId = inferSelectedItemId(transcript.trim());
      const selectedItem = demoInventory.find((item) => item.id === selectedItemId);

      return NextResponse.json({
        status: "awaiting_payment",
        callId,
        phoneNumber: call.to_number,
        note: "The callee said done. Complete the Coinbase Pay confirmation to finalize the booking.",
        transcriptTurns: normalizedTurns,
        actionResult: {
          ok: false,
          spokenReply: "Phone confirmation received. Complete the Coinbase Pay step to finalize the booking.",
          actionSummary: selectedItem
            ? `Phone confirmation complete for ${selectedItem.title}. Coinbase Pay confirmation is still required.`
            : "Phone confirmation complete. Coinbase Pay confirmation is still required.",
          parsedIntent: selectedItem?.category ?? "n/a",
          selectedItemId,
          bookingReady: false,
          paymentReady: verification.status === "verified",
          paymentLabel: getCoinbasePaymentLabel(selectedItemId),
          events: []
        }
      } satisfies CallBookingResponse);
    }

    if (["failed", "busy", "no_answer", "canceled"].includes(call.status)) {
      return NextResponse.json({
        status: "failed",
        callId,
        phoneNumber: call.to_number,
        note: `Call ended with status ${call.status} before the callee said done.`,
        transcriptTurns: normalizedTurns
      } satisfies CallBookingResponse);
    }

    return NextResponse.json({
      status: call.status === "completed" ? "failed" : "awaiting_done",
      callId,
      phoneNumber: call.to_number,
      note:
        call.status === "completed"
          ? "Call completed but no done confirmation was detected."
          : "Call is active. Waiting for the callee to say done.",
      transcriptTurns: normalizedTurns
    } satisfies CallBookingResponse);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to read booking call status." },
      { status: 500 }
    );
  }
}
