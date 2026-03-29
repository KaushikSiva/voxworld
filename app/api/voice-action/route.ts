import { NextRequest, NextResponse } from "next/server";
import { orchestrateVoiceAction } from "@/lib/demoOrchestrator";
import { getVerificationState } from "@/lib/worldAgentKitAdapter";

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    transcript?: string;
  };

  if (!body.transcript?.trim()) {
    return NextResponse.json({ error: "Transcript is required." }, { status: 400 });
  }

  const verification = await getVerificationState();
  const result = await orchestrateVoiceAction({
    transcript: body.transcript.trim(),
    verification
  });

  return NextResponse.json(result);
}
