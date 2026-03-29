import { ActionResponse, DemoEvent, VerificationState } from "@/lib/types";
import { runProtectedMerchantAction } from "@/lib/merchantService";
import { getBookingPhoneNumber } from "@/lib/voiceCallAdapter";

function event(
  stage: DemoEvent["stage"],
  title: string,
  detail: string,
  tone: DemoEvent["tone"]
): DemoEvent {
  return {
    id: crypto.randomUUID(),
    stage,
    title,
    detail,
    tone,
    timestamp: new Date().toISOString()
  };
}

export async function orchestrateVoiceAction({
  transcript,
  verification
}: {
  transcript: string;
  verification: VerificationState;
}): Promise<ActionResponse> {
  if (verification.status !== "verified" || !verification.walletConnected) {
    const merchantResult = await runProtectedMerchantAction({
      transcript,
      userId: "demo-user",
      verification
    });

    const events: DemoEvent[] = [
      event("request", "Voice request captured", transcript, "neutral"),
      event(
        "verification",
        "Verification check started",
        "Checking availability. This action requires a verified human-backed agent with a connected Coinbase wallet.",
        "neutral"
      ),
      event(
        "verification",
        verification.status === "verified" ? "Wallet missing" : "World proof missing",
        verification.status === "verified"
          ? "World proof is present, but no Coinbase wallet session is attached."
          : verification.message,
        "error"
      ),
      event("merchant", "Protected merchant rejected", merchantResult.merchant.summary, "error"),
      event("result", "Assistant returned denial", merchantResult.merchant.spokenReply, "error")
    ];

    return {
      ok: merchantResult.ok,
      spokenReply: merchantResult.merchant.spokenReply,
      actionSummary: merchantResult.merchant.summary,
      parsedIntent: merchantResult.parsedIntent,
      selectedItemId: merchantResult.selectedItemId,
      bookingReady: false,
      events
    };
  }

  const parsedMerchantResult = await runProtectedMerchantAction({
    transcript,
    userId: "demo-user",
    verification: {
      ...verification,
      status: "verified"
    }
  });

  const callNumber = getBookingPhoneNumber();
  const events: DemoEvent[] = [
    event("request", "Voice request captured", transcript, "neutral"),
    event("verification", "World proof accepted", verification.message, "success"),
    event("verification", "Coinbase wallet accepted", `Server wallet session attached: ${verification.walletAddress}`, "success"),
    event("merchant", "Protected action staged", `Verified. Click Book to place a confirmation call to ${callNumber}.`, "neutral"),
    event(
      "result",
      "Awaiting phone confirmation",
      "The booking will only finalize after the callee says done on the outbound confirmation call.",
      "neutral"
    )
  ];

  return {
    ok: false,
    spokenReply: `Verified. Click book to call ${callNumber}. I will only complete the action after the callee says done.`,
    actionSummary: parsedMerchantResult.merchant.summary,
    parsedIntent: parsedMerchantResult.parsedIntent,
    selectedItemId: parsedMerchantResult.selectedItemId,
    bookingReady: true,
    events
  };
}
