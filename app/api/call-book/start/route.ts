import { NextRequest, NextResponse } from "next/server";
import { getVerificationState } from "@/lib/worldAgentKitAdapter";
import { orchestrateVoiceAction } from "@/lib/demoOrchestrator";
import { startBookingCall } from "@/lib/voiceCallAdapter";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      transcript?: string;
    };

    if (!body.transcript?.trim()) {
      return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
    }

    const verification = await getVerificationState();
    if (verification.status !== "verified") {
      return NextResponse.json({ error: "Agent must be verified before starting a booking call." }, { status: 403 });
    }

    const staged = await orchestrateVoiceAction({
      transcript: body.transcript.trim(),
      verification
    });

    if (!staged.bookingReady) {
      return NextResponse.json({ error: "Booking is not ready for call confirmation." }, { status: 409 });
    }

    const call = await startBookingCall(body.transcript.trim());
    return NextResponse.json({
      status: "calling",
      callId: call.callId,
      phoneNumber: call.phoneNumber,
      note: "Outbound confirmation call started. Waiting for the callee to say done.",
      transcriptTurns: []
    });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to start booking call." },
      { status: 500 }
    );
  }
}
