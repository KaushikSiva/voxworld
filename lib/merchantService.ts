import { demoInventory } from "@/lib/demoInventory";
import { MerchantRequest } from "@/lib/types";

type MerchantDecision = {
  ok: boolean;
  summary: string;
  spokenReply: string;
  selectedItemId: string | null;
};

function parseIntent(transcript: string) {
  const value = transcript.toLowerCase();

  if (value.includes("cowork") || value.includes("desk") || value.includes("day pass")) {
    return {
      itemId: "coworking-pass",
      summary: "Reserve 1 coworking day pass for tomorrow at 10:00 AM.",
      intent: "coworking reservation"
    };
  }

  if (value.includes("ticket") || value.includes("event")) {
    return {
      itemId: "event-ticket",
      summary: "Reserve 1 event ticket.",
      intent: "event reservation"
    };
  }

  return {
    itemId: "coffee-subscription",
    summary: "Checkout 1 coffee subscription.",
    intent: "subscription purchase"
  };
}

export async function runProtectedMerchantAction(request: MerchantRequest) {
  const parsed = parseIntent(request.transcript);
  const verification = request.verification;
  const item = demoInventory.find((entry) => entry.id === parsed.itemId) ?? null;

  if (!item) {
    return {
      ok: false,
      selectedItemId: null,
      parsedIntent: parsed.intent,
      verification,
      merchant: {
        ok: false,
        summary: "Requested item not found in demo inventory.",
        spokenReply: "I couldn't map that request to the demo inventory.",
        selectedItemId: null
      } satisfies MerchantDecision
    };
  }

  if (verification.status !== "verified") {
    return {
      ok: false,
      selectedItemId: item.id,
      parsedIntent: parsed.intent,
      verification,
      merchant: {
        ok: false,
        summary: "Reservation denied. Protected inventory requires a verified human-backed agent.",
        spokenReply:
          "I couldn't complete that because this protected inventory only allows verified human-backed agents.",
        selectedItemId: item.id
      } satisfies MerchantDecision
    };
  }

  if (!verification.walletConnected) {
    return {
      ok: false,
      selectedItemId: item.id,
      parsedIntent: parsed.intent,
      verification,
      merchant: {
        ok: false,
        summary: "Reservation denied. Protected inventory requires a connected Coinbase wallet-backed agent.",
        spokenReply:
          "I couldn't complete that because this protected inventory requires a connected Coinbase wallet-backed agent.",
        selectedItemId: item.id
      } satisfies MerchantDecision
    };
  }

  return {
    ok: true,
    selectedItemId: item.id,
    parsedIntent: parsed.intent,
    verification,
    merchant: {
      ok: true,
      summary:
        item.id === "coworking-pass"
          ? "Reservation confirmed for 1 seat tomorrow at 10:00 AM."
          : item.id === "event-ticket"
            ? "Reservation confirmed for 1 event ticket."
            : "Checkout confirmed for 1 coffee subscription.",
      spokenReply:
        item.id === "coworking-pass"
          ? "Done. I reserved one coworking pass for tomorrow."
          : item.id === "event-ticket"
            ? "Done. I reserved one event ticket for you."
            : "Done. I checked out one coffee subscription for you.",
      selectedItemId: item.id
    } satisfies MerchantDecision
  };
}
