import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { verifyCloudProof } from "@worldcoin/idkit-core/backend";
import { getServerWalletAddress } from "@/lib/walletAdapter";
import { getWalletSession } from "@/lib/walletSession";
import { VerificationState } from "@/lib/types";

const SESSION_COOKIE = "humanvoice_world_session";

type VerificationTokenPayload = {
  nullifier: string;
  sessionId: string;
  verifiedAt: string;
};

function getWorldConfig() {
  return {
    appId: process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "",
    action: process.env.NEXT_PUBLIC_WORLD_ACTION ?? "verify-humanvoice-agent",
    fakeScanSuccess: process.env.HUMANVOICE_FAKE_WORLD_SCAN_SUCCESS === "true",
    sessionSecret:
      process.env.HUMANVOICE_SESSION_SECRET ?? process.env.WORLD_RP_SIGNING_KEY ?? "humanvoice-dev-secret"
  } as const;
}

function signToken(payload: VerificationTokenPayload, secret: string) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const signature = createHmac("sha256", secret).update(encoded).digest("base64url");
  return `${encoded}.${signature}`;
}

function verifyToken(token: string, secret: string): VerificationTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) {
    return null;
  }

  const expected = createHmac("sha256", secret).update(encoded).digest("base64url");
  const signatureBytes = Buffer.from(signature);
  const expectedBytes = Buffer.from(expected);

  if (signatureBytes.length !== expectedBytes.length || !timingSafeEqual(signatureBytes, expectedBytes)) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as VerificationTokenPayload;
    return payload;
  } catch {
    return null;
  }
}

export function getWorldClientConfig() {
  const config = getWorldConfig();
  return {
    appId: config.appId,
    action: config.action,
    fakeScanSuccess: config.fakeScanSuccess,
    isConfigured: Boolean(config.appId)
  };
}

async function persistVerifiedSession(nullifier: string, message: string): Promise<VerificationState> {
  const config = getWorldConfig();
  const wallet = await getWalletSession();
  const verifiedAt = new Date().toISOString();
  const verificationState: VerificationState = {
    status: "verified",
    isConfigured: true,
    walletConnected: Boolean(wallet?.address),
    walletAddress: wallet?.address ?? getServerWalletAddress(),
    message,
    proof: nullifier,
    verifiedAt
  };

  const tokenPayload: VerificationTokenPayload = {
    nullifier,
    sessionId: nullifier,
    verifiedAt
  };

  const store = await cookies();
  store.set(SESSION_COOKIE, signToken(tokenPayload, config.sessionSecret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60
  });

  return verificationState;
}

export async function verifyWorldProof(idkitResponse: unknown): Promise<VerificationState> {
  const config = getWorldConfig();
  const proof = idkitResponse as {
    nullifier_hash?: string;
  };

  if (!config.appId) {
    throw new Error("World ID app_id is missing.");
  }

  if (config.fakeScanSuccess) {
    return persistVerifiedSession(
      proof.nullifier_hash ?? `demo-scan-${Date.now()}`,
      "Demo mode: QR scan accepted and verification marked successful."
    );
  }

  const payload = await verifyCloudProof(
    idkitResponse as Parameters<typeof verifyCloudProof>[0],
    config.appId as `app_${string}`,
    config.action,
    "humanvoice-demo-user"
  );

  if (!payload.success) {
    throw new Error("World proof verification failed.");
  }

  return persistVerifiedSession(proof.nullifier_hash ?? "verified", "Verified with World ID.");
}

export async function clearVerificationSession() {
  const store = await cookies();
  store.set(SESSION_COOKIE, "", {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0
  });
}

export async function getVerificationState(): Promise<VerificationState> {
  const config = getWorldClientConfig();
  const wallet = await getWalletSession();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (!token) {
    return {
      status: "unverified",
      isConfigured: config.isConfigured,
      walletConnected: Boolean(wallet?.address),
      walletAddress: wallet?.address ?? getServerWalletAddress(),
      message: config.isConfigured
        ? "No World proof attached. Protected merchant requests will fail."
        : "World ID is not configured yet. Add the required env vars to enable verified mode.",
      proof: null,
      verifiedAt: null
    };
  }

  const payload = verifyToken(token, getWorldConfig().sessionSecret);
  if (!payload) {
    return {
      status: "unverified",
      isConfigured: config.isConfigured,
      walletConnected: Boolean(wallet?.address),
      walletAddress: wallet?.address ?? getServerWalletAddress(),
      message: "Stored verification session is invalid. Verify again.",
      proof: null,
      verifiedAt: null
    };
  }

  return {
    status: "verified",
    isConfigured: config.isConfigured,
    walletConnected: Boolean(wallet?.address),
    walletAddress: wallet?.address ?? getServerWalletAddress(),
    message: "World proof verified and linked to this demo agent session.",
    proof: payload.nullifier,
    verifiedAt: payload.verifiedAt
  };
}
