import { NextRequest, NextResponse } from "next/server";
import { clearVerificationSession, getVerificationState } from "@/lib/worldAgentKitAdapter";

export async function GET() {
  const state = await getVerificationState();
  return NextResponse.json(state);
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    action?: "clear";
  };

  if (body.action === "clear") {
    await clearVerificationSession();
  }

  const state = await getVerificationState();
  return NextResponse.json(state);
}
