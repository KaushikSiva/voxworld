import { NextRequest, NextResponse } from "next/server";
import { clearWalletSession, getWalletSession, setWalletSession } from "@/lib/walletSession";

export async function GET() {
  return NextResponse.json({ wallet: await getWalletSession() });
}

export async function POST(request: NextRequest) {
  const body = (await request.json()) as {
    address?: string;
    chainId?: string | null;
  };

  if (!body.address) {
    return NextResponse.json({ error: "address is required." }, { status: 400 });
  }

  await setWalletSession(body.address, body.chainId ?? null);
  return NextResponse.json({ ok: true, wallet: await getWalletSession() });
}

export async function DELETE() {
  await clearWalletSession();
  return NextResponse.json({ ok: true });
}
