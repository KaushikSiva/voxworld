import { NextRequest, NextResponse } from "next/server";
import { verifyWorldProof } from "@/lib/worldAgentKitAdapter";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as {
      demoAccept?: boolean;
      idkitResponse?: unknown;
    };

    if (!body.idkitResponse && !body.demoAccept) {
      return NextResponse.json({ error: "idkitResponse is required." }, { status: 400 });
    }

    const result = await verifyWorldProof(body.demoAccept ? { nullifier_hash: `demo-scan-${Date.now()}` } : body.idkitResponse);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "World proof verification failed." },
      { status: 500 }
    );
  }
}
