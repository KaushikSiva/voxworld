import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";

const WALLET_COOKIE = "humanvoice_wallet_session";

type WalletTokenPayload = {
  address: string;
  chainId: string | null;
  connectedAt: string;
};

function getSecret() {
  return process.env.HUMANVOICE_SESSION_SECRET ?? "humanvoice-dev-secret";
}

function signToken(payload: WalletTokenPayload) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token: string): WalletTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }
  const expected = createHmac("sha256", getSecret()).update(encoded).digest("base64url");
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as WalletTokenPayload;
  } catch {
    return null;
  }
}

export async function setWalletSession(address: string, chainId: string | null) {
  const store = await cookies();
  store.set(
    WALLET_COOKIE,
    signToken({
      address,
      chainId,
      connectedAt: new Date().toISOString()
    }),
    {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: 60 * 60
    }
  );
}

export async function clearWalletSession() {
  const store = await cookies();
  store.set(WALLET_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getWalletSession() {
  const store = await cookies();
  const token = store.get(WALLET_COOKIE)?.value;
  if (!token) {
    return null;
  }
  return verifyToken(token);
}
