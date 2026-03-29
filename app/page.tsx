"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { IDKitWidget } from "@worldcoin/idkit";
import { ActionResponse, CallBookingResponse, DemoEvent, VerificationState } from "@/lib/types";
import {
  connectCoinbaseWallet,
  formatWalletAddress,
  getDefaultWalletState,
  isFakeCoinbaseWalletEnabled,
  type WalletState
} from "@/lib/walletAdapter";

type ErrorPayload = {
  error?: string;
};

type WorldClientConfig = {
  appId: string;
  action: string;
  fakeScanSuccess: boolean;
  isConfigured: boolean;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SpeechRecognition;
    webkitSpeechRecognition?: new () => SpeechRecognition;
  }

  interface SpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: SpeechRecognitionErrorEvent) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
  }

  interface SpeechRecognitionEvent {
    results: SpeechRecognitionResultList;
  }

  interface SpeechRecognitionErrorEvent {
    error: string;
  }
}

const samplePrompts = [
  "Book me a coworking desk for tomorrow under $25.",
  "Reserve one event ticket for me.",
  "Buy one coffee subscription."
];

const initialLog: DemoEvent[] = [
  {
    id: "boot",
    stage: "request",
    title: "Awaiting request",
    detail: "Connect Coinbase Wallet, then verify with World ID to unlock protected actions.",
    tone: "neutral",
    timestamp: new Date().toISOString()
  }
];

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit"
  });
}

function speak(text: string) {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) {
    return;
  }

  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 1;
  utterance.pitch = 0.95;
  window.speechSynthesis.speak(utterance);
}

type FlowStepState = "locked" | "active" | "complete";

export default function Page() {
  const [wallet, setWallet] = useState<WalletState>(getDefaultWalletState());
  const [verification, setVerification] = useState<VerificationState>({
    status: "unverified",
    isConfigured: Boolean(process.env.NEXT_PUBLIC_WORLD_APP_ID),
    walletConnected: false,
    walletAddress: "Not connected",
    message: "No World proof attached. Protected merchant requests will fail.",
    proof: null,
    verifiedAt: null
  });
  const [transcript, setTranscript] = useState("");
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPreparingVerification, setIsPreparingVerification] = useState(false);
  const [isBookingCallLoading, setIsBookingCallLoading] = useState(false);
  const [isCoinbasePayLoading, setIsCoinbasePayLoading] = useState(false);
  const [callBooking, setCallBooking] = useState<CallBookingResponse | null>(null);
  const [result, setResult] = useState<ActionResponse | null>(null);
  const [events, setEvents] = useState<DemoEvent[]>(initialLog);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const worldAppId = (process.env.NEXT_PUBLIC_WORLD_APP_ID ?? "") as `app_${string}` | "";
  const worldAction = process.env.NEXT_PUBLIC_WORLD_ACTION ?? "verify-humanvoice-agent";
  const [worldClientConfig, setWorldClientConfig] = useState<WorldClientConfig | null>(null);
  const fakeCoinbaseWallet = isFakeCoinbaseWalletEnabled();

  const refreshVerification = useCallback(async () => {
    const response = await fetch("/api/verify-agent");
    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as VerificationState;
    setVerification({
      ...payload,
      walletAddress: payload.walletConnected ? formatWalletAddress(payload.walletAddress) : "Not connected"
    });
  }, []);

  const submitRequest = useCallback(async (requestText: string) => {
    if (!requestText.trim()) {
      return;
    }

    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/voice-action", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transcript: requestText
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as ErrorPayload;
        throw new Error(errorPayload.error ?? "Voice action failed.");
      }

      const payload = (await response.json()) as ActionResponse;
      setResult(payload);
      setCallBooking(null);
      setEvents((current) => [...payload.events.reverse(), ...current].slice(0, 12));
      speak(payload.spokenReply);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Voice action failed.";
      setResult({
        ok: false,
        spokenReply: message,
        actionSummary: message,
        parsedIntent: "n/a",
        selectedItemId: null,
        events: [
          {
            id: crypto.randomUUID(),
            stage: "result",
            title: "Request failed",
            detail: message,
            tone: "error",
            timestamp: new Date().toISOString()
          }
        ]
      });
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "result",
          title: "Request failed",
          detail: message,
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshVerification();
  }, [refreshVerification]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    window.localStorage.setItem("humanvoice-debug-events", JSON.stringify(events));
  }, [events]);

  useEffect(() => {
    async function loadWorldConfig() {
      const response = await fetch("/api/verify-agent");
      if (!response.ok) {
        return;
      }

      const verificationPayload = (await response.json()) as VerificationState;
      setWorldClientConfig({
        appId: worldAppId,
        action: worldAction,
        fakeScanSuccess: verificationPayload.message.includes("Demo mode") || process.env.NODE_ENV !== "production",
        isConfigured: verificationPayload.isConfigured
      });
    }

    void loadWorldConfig();
  }, [worldAction, worldAppId]);

  useEffect(() => {
    setVerification((current) => ({
      ...current,
      walletConnected: wallet.isConnected,
      walletAddress: wallet.isConnected ? formatWalletAddress(wallet.address) : current.walletAddress
    }));
  }, [wallet.address, wallet.isConnected]);

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const Recognition = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Recognition) {
      return;
    }

    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-US";
    recognition.onresult = (event) => {
      const text = Array.from({ length: event.results.length }, (_, index) => event.results[index])
        .map((resultRow) => resultRow[0]?.transcript ?? "")
        .join(" ")
        .trim();
      setTranscript(text);
      void submitRequest(text);
    };
    recognition.onerror = () => {
      setIsListening(false);
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "request",
          title: "Voice capture error",
          detail: "Speech recognition failed. Try again or use a sample prompt.",
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    };
    recognition.onend = () => {
      setIsListening(false);
    };
    recognitionRef.current = recognition;
  }, [submitRequest]);

  async function connectUnverifiedAgent() {
    await fetch("/api/wallet-session", {
      method: "DELETE"
    });
    setWallet(getDefaultWalletState());
    const response = await fetch("/api/verify-agent", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ action: "clear" })
    });

    if (!response.ok) {
      return;
    }

    const payload = (await response.json()) as VerificationState;
    setVerification({
      ...payload,
      walletAddress: "Not connected"
    });
    setEvents((current) => [
      {
        id: crypto.randomUUID(),
        stage: "verification",
        title: "Session reset",
        detail: "Wallet and human proof were cleared. Protected inventory is locked again.",
        tone: "error",
        timestamp: new Date().toISOString()
      },
      ...current
    ]);
  }

  async function handleConnectWallet() {
    try {
      const connectedWallet = await connectCoinbaseWallet();
      await fetch("/api/wallet-session", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          address: connectedWallet.address,
          chainId: connectedWallet.chainId
        })
      });
      setWallet(connectedWallet);
      await refreshVerification();
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "verification",
          title: "Coinbase Wallet connected",
          detail: `${
            connectedWallet.source === "demo" ? "Demo mode attached " : ""
          }${connectedWallet.label} connected as ${formatWalletAddress(connectedWallet.address)} on ${connectedWallet.chainId ?? "unknown chain"}. Wallet trust layer is ready.`,
          tone: "success",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    } catch (error) {
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "verification",
          title: "Coinbase Wallet connection failed",
          detail: error instanceof Error ? error.message : "Unable to connect Coinbase Wallet.",
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    }
  }

  async function handleWorldVerify(resultPayload: unknown) {
    const response = await fetch("/api/world/verify-proof", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ idkitResponse: resultPayload })
    });

    if (!response.ok) {
      const errorPayload = (await response.json()) as ErrorPayload;
      throw new Error(errorPayload.error ?? "Backend verification failed.");
    }

    const payload = (await response.json()) as VerificationState;
    setVerification({
      ...payload,
      walletAddress: payload.walletConnected ? formatWalletAddress(payload.walletAddress) : "Not connected"
    });
  }

  async function handleDemoWorldAccept() {
    setIsPreparingVerification(true);
    setVerification((current) => ({
      ...current,
      status: "pending",
      message: "Demo mode: marking verification successful..."
    }));

    try {
      const response = await fetch("/api/world/verify-proof", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ demoAccept: true })
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as ErrorPayload;
        throw new Error(errorPayload.error ?? "Demo verification failed.");
      }

      const payload = (await response.json()) as VerificationState;
      setVerification({
        ...payload,
        walletAddress: formatWalletAddress(wallet.address)
      });
      await handleWorldSuccess();
    } catch (error) {
      setVerification((current) => ({
        ...current,
        status: "unverified",
        message: error instanceof Error ? error.message : "Demo verification failed."
      }));
    } finally {
      setIsPreparingVerification(false);
    }
  }

  async function handleBookByCall() {
    if (!transcript.trim()) {
      return;
    }

    setIsBookingCallLoading(true);
    setCallBooking(null);

    try {
      const response = await fetch("/api/call-book/start", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ transcript })
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as ErrorPayload;
        throw new Error(errorPayload.error ?? "Failed to start booking call.");
      }

      const payload = (await response.json()) as CallBookingResponse;
      setCallBooking(payload);
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "merchant",
          title: "Confirmation call live",
          detail: `Dialing ${payload.phoneNumber}. The booking will advance only after the callee says done.`,
          tone: "neutral",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start booking call.";
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "merchant",
          title: "Booking call failed",
          detail: message,
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    } finally {
      setIsBookingCallLoading(false);
    }
  }

  async function handleCoinbasePayComplete() {
    if (!transcript.trim() || !result?.paymentReady) {
      return;
    }

    setIsCoinbasePayLoading(true);
    try {
      const response = await fetch("/api/coinbase-pay/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          transcript,
          selectedItemId: result.selectedItemId
        })
      });

      if (!response.ok) {
        const errorPayload = (await response.json()) as ErrorPayload;
        throw new Error(errorPayload.error ?? "Failed to complete Coinbase Pay confirmation.");
      }

      const payload = (await response.json()) as ActionResponse;
      setResult(payload);
      setCallBooking((current) =>
        current
          ? {
              ...current,
              status: "confirmed",
              note: "Coinbase Pay confirmation complete. Booking finalized."
            }
          : current
      );
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "merchant",
          title: "Coinbase Pay approved",
          detail: payload.actionSummary,
          tone: "success",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
      speak(payload.spokenReply);
    } catch (error) {
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "merchant",
          title: "Coinbase Pay failed",
          detail: error instanceof Error ? error.message : "Failed to complete Coinbase Pay confirmation.",
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
    } finally {
      setIsCoinbasePayLoading(false);
    }
  }

  useEffect(() => {
    if (!callBooking?.callId || !transcript.trim()) {
      return;
    }

    if (!["calling", "awaiting_done"].includes(callBooking.status)) {
      return;
    }

    const interval = window.setInterval(async () => {
      const params = new URLSearchParams({
        callId: callBooking.callId,
        transcript
      });

      const response = await fetch(`/api/call-book/status?${params.toString()}`, {
        cache: "no-store"
      });

      if (!response.ok) {
        return;
      }

      const payload = (await response.json()) as CallBookingResponse;
      setCallBooking(payload);

      if (payload.actionResult) {
        setResult(payload.actionResult);
        setEvents((current) => [
          {
            id: crypto.randomUUID(),
            stage: "result",
            title: "Call completed, payment pending",
            detail: payload.note,
            tone: "success",
            timestamp: new Date().toISOString()
          },
          ...current
        ]);
        speak(payload.actionResult.spokenReply);
      } else if (payload.status === "failed") {
        setEvents((current) => [
          {
            id: crypto.randomUUID(),
            stage: "result",
            title: "Booking call ended without confirmation",
            detail: payload.note,
            tone: "error",
            timestamp: new Date().toISOString()
          },
          ...current
        ]);
      }
    }, 3000);

    return () => {
      window.clearInterval(interval);
    };
  }, [callBooking?.callId, callBooking?.status, transcript]);

  async function handleWorldSuccess() {
    await refreshVerification();
    setEvents((current) => [
      {
        id: crypto.randomUUID(),
        stage: "verification",
        title: "World proof accepted",
        detail:
          worldClientConfig?.fakeScanSuccess
            ? "Demo mode accepted the QR scan and marked the agent verified."
            : "The demo agent session is now verified as human-backed for protected actions.",
        tone: "success",
        timestamp: new Date().toISOString()
      },
      ...current
    ]);
  }

  function handleWorldError() {
    setVerification((current) => ({
      ...current,
      status: current.proof ? "verified" : "unverified",
      message: current.proof ? current.message : "World verification did not complete."
    }));
    setEvents((current) => [
      {
        id: crypto.randomUUID(),
        stage: "verification",
        title: "World verification failed",
        detail: "The user cancelled or the proof did not verify successfully.",
        tone: "error",
        timestamp: new Date().toISOString()
      },
      ...current
    ]);
  }

  function handleMicClick() {
    const recognition = recognitionRef.current;
    if (!recognition) {
      setEvents((current) => [
        {
          id: crypto.randomUUID(),
          stage: "request",
          title: "Voice API unavailable",
          detail: "This browser does not expose the Web Speech API. Use a Chromium browser or trigger a sample prompt.",
          tone: "error",
          timestamp: new Date().toISOString()
        },
        ...current
      ]);
      return;
    }

    setTranscript("");
    setIsListening(true);
    recognition.start();
  }

  const flowSteps = [
    {
      index: "01",
      title: "Connect Coinbase",
      detail: "Attach the wallet-backed agent identity."
    },
    {
      index: "02",
      title: "Verify Human",
      detail: "Unlock protected inventory with human proof."
    },
    {
      index: "03",
      title: "Speak Request",
      detail: "Capture the booking or checkout intent."
    },
    {
      index: "04",
      title: "Book by Call",
      detail: "Place the outbound confirmation call."
    },
    {
      index: "05",
      title: "Complete Pay",
      detail: "Finalize with Coinbase Pay confirmation."
    }
  ];

  function resolveFlowState(stepIndex: number): FlowStepState {
    const hasWallet = verification.walletConnected;
    const hasHuman = verification.status === "verified";
    const hasTranscript = Boolean(result?.parsedIntent && transcript.trim());
    const hasCallStarted = Boolean(callBooking?.callId);
    const hasCallDone = callBooking?.status === "awaiting_payment" || callBooking?.status === "confirmed";
    const hasPaymentPending = Boolean(result?.paymentReady || callBooking?.status === "awaiting_payment");
    const isConfirmed = Boolean(result?.ok);

    const states: FlowStepState[] = [
      hasWallet ? "complete" : "active",
      hasHuman ? "complete" : hasWallet ? "active" : "locked",
      hasTranscript ? "complete" : hasHuman ? "active" : "locked",
      hasCallDone ? "complete" : hasCallStarted ? "active" : hasTranscript ? "active" : "locked",
      isConfirmed ? "complete" : hasPaymentPending ? "active" : "locked"
    ];

    return states[stepIndex] ?? "locked";
  }

  const currentNarration =
    result?.ok
      ? "Booking locked in after wallet proof, human verification, phone confirmation, and Coinbase Pay."
      : result?.paymentReady
        ? "Phone confirmation is complete. One Coinbase Pay approval remains."
        : callBooking?.status === "awaiting_done"
          ? "The confirmation call is live. Waiting for the callee to say done."
          : result?.bookingReady
            ? "The protected action is staged. Start the confirmation call to continue."
            : "Connect wallet, verify human, and speak a request to move the flow forward.";
  const merchantGateLabel =
    verification.status === "verified" && verification.walletConnected ? "Open" : "Blocked";
  const currentStageLabel = result?.ok
    ? "Confirmed"
    : result?.paymentReady
      ? "Payment approval"
      : callBooking?.status === "awaiting_done"
        ? "Call in progress"
        : result?.bookingReady
          ? "Ready to call"
          : transcript
            ? "Request staged"
            : "Waiting";
  const nextActionLabel = result?.ok
    ? "Demo complete"
    : result?.paymentReady
      ? "Approve Coinbase Pay"
      : result?.bookingReady
        ? "Start call"
        : verification.status !== "verified"
          ? "Verify human"
          : verification.walletConnected
            ? "Speak request"
            : "Connect wallet";
  const latestEvent = events[0];

  return (
    <main className="page-shell">
      <section className="hero">
        <div className="hero-stage">
          <div className="hero-copy-block">
            <div className="hero-bar">
              <div className="hero-topline">Human-Backed Voice Commerce</div>
              <Link href="/debug" className="debug-link" aria-label="Open debug log">
                ◎
              </Link>
            </div>
            <div className="hero-brand">
              <h1>
                HumanVoice
                <span>Trust Before Automation</span>
              </h1>
              <p className="hero-copy">
                A verified agent flow for protected inventory. Connect the wallet, prove a real human, speak the request,
                confirm by phone, and release the final merchant action.
              </p>
              <div className="hero-note">Five-step demo. Under one minute. One protected merchant gate.</div>
              <div className="flow-strip">
                {flowSteps.map((step, index) => {
                  const state = resolveFlowState(index);
                  return (
                    <div key={step.index} className={`flow-step ${state}`} style={{ transitionDelay: `${index * 60}ms` }}>
                      <strong>{step.index}</strong>
                      {step.title}
                      <br />
                      {step.detail}
                    </div>
                  );
                })}
              </div>
              <div className="hero-note hero-note-live">{currentNarration}</div>
              <div className="hero-metrics">
                <div className="hero-metric">
                  <span>Session</span>
                  <strong>{verification.walletConnected ? "Wallet attached" : "Wallet missing"}</strong>
                </div>
                <div className="hero-metric">
                  <span>Merchant Gate</span>
                  <strong>{merchantGateLabel}</strong>
                </div>
                <div className="hero-metric">
                  <span>Next Action</span>
                  <strong>{nextActionLabel}</strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="workspace-shell">
        <div className="workspace-layout">
          <div className="workspace-main">
            <section className="surface-block">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Agent Session</p>
                  <h2>Connect identity and attach human verification</h2>
                </div>
                <div
                  className={`status-badge ${
                    verification.status === "verified"
                      ? "verified"
                      : verification.status === "pending"
                        ? "pending"
                        : "unverified"
                  }`}
                >
                  {verification.status === "verified"
                    ? "Verified Human-Backed Agent"
                    : verification.status === "pending"
                      ? "Checking Verification"
                      : "Unverified Agent"}
                </div>
              </div>
              <p className="section-note section-note-wide">{verification.message}</p>
              <div className="session-grid">
                <div className="session-stat">
                  <span>Wallet</span>
                  <strong>{verification.walletAddress}</strong>
                  <p>{verification.walletConnected ? "Attached to this session." : "No connected wallet yet."}</p>
                </div>
                <div className="session-stat">
                  <span>World</span>
                  <strong>{verification.status === "verified" ? "Verified" : "Pending"}</strong>
                  <p>{worldClientConfig?.fakeScanSuccess ? "Demo accept mode." : "Live verification mode."}</p>
                </div>
                <div className="session-stat">
                  <span>Merchant Gate</span>
                  <strong>{merchantGateLabel}</strong>
                  <p>Protected inventory requires both trust layers.</p>
                </div>
              </div>
              <div className="button-row section-actions">
                <button className="button-secondary" onClick={() => void handleConnectWallet()}>
                  {wallet.isConnected
                    ? fakeCoinbaseWallet
                      ? "Reconnect Demo Coinbase"
                      : "Reconnect Coinbase Wallet"
                    : fakeCoinbaseWallet
                      ? "Connect Demo Coinbase"
                      : "Connect Coinbase Wallet"}
                </button>
                {worldClientConfig?.fakeScanSuccess ? (
                  <button className="button" onClick={() => void handleDemoWorldAccept()} disabled={isPreparingVerification}>
                    {isPreparingVerification ? "Verifying..." : "Demo Accept World Scan"}
                  </button>
                ) : worldAppId ? (
                  <IDKitWidget
                    app_id={worldAppId}
                    action={worldAction}
                    signal="humanvoice-demo-user"
                    handleVerify={handleWorldVerify}
                    onSuccess={() => {
                      void handleWorldSuccess();
                    }}
                    onError={() => {
                      handleWorldError();
                    }}
                  >
                    {({ open }: { open: () => void }) => (
                      <button
                        className="button"
                        onClick={() => {
                          setIsPreparingVerification(true);
                          setVerification((current) => ({
                            ...current,
                            status: "pending",
                            message: "Waiting for World verification..."
                          }));
                          open();
                          setTimeout(() => setIsPreparingVerification(false), 300);
                        }}
                        disabled={isPreparingVerification}
                      >
                        {isPreparingVerification ? "Opening..." : "Verify with World ID"}
                      </button>
                    )}
                  </IDKitWidget>
                ) : (
                  <button className="button" disabled>
                    Verify with World ID
                  </button>
                )}
                <button className="button-secondary" onClick={() => void connectUnverifiedAgent()}>
                  Reset Session
                </button>
              </div>
              <div className="chip-row section-chips">
                <div className="chip">
                  Wallet source: {verification.walletConnected ? `${wallet.label}${wallet.source === "demo" ? " demo" : ""}` : "Disconnected"}
                </div>
                <div className="chip">Chain: {wallet.chainId ?? "n/a"}</div>
                <div className="chip">World config: {verification.isConfigured ? "Ready" : "Missing env"}</div>
                <div className="chip">Proof: {verification.proof ?? "none"}</div>
              </div>
              {!verification.isConfigured ? (
                <div className="notice-block">
                  Add `NEXT_PUBLIC_WORLD_APP_ID` and `NEXT_PUBLIC_WORLD_ACTION` in `.env.local` to enable the live World verification flow.
                </div>
              ) : null}
              {worldClientConfig?.fakeScanSuccess ? (
                <div className="notice-block">
                  Demo mode is enabled. As soon as the World QR flow returns, the backend marks the session verified.
                </div>
              ) : null}
              {!wallet.isConnected ? (
                <div className="notice-block">
                  {fakeCoinbaseWallet
                    ? "Demo Coinbase mode is enabled. Clicking the wallet button will attach a fake Coinbase identity instantly."
                    : "Coinbase Wallet uses the injected provider path. Install Coinbase Wallet or open this app inside Coinbase Wallet to connect a live address."}
                </div>
              ) : null}
            </section>

            <section className="surface-block">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Voice Request</p>
                  <h2>Capture the instruction</h2>
                </div>
              </div>
              <div className="voice-layout">
                <button className="mic-button" onClick={handleMicClick} disabled={isLoading}>
                  <strong>{isListening ? "Listening..." : "Tap to Speak"}</strong>
                  <span>Say a booking or checkout request in one sentence.</span>
                </button>
                <div className="prompt-column">
                  <div className="prompt-list">
                    {samplePrompts.map((prompt) => (
                      <button
                        key={prompt}
                        className="prompt-button"
                        onClick={() => {
                          setTranscript(prompt);
                          void submitRequest(prompt);
                        }}
                        disabled={isLoading}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                  <div className="transcript-panel">
                    <p className="eyebrow">Transcript</p>
                    <div className="transcript transcript-compact">
                      {transcript ? transcript : <span className="placeholder">Your transcript will appear here after speech capture.</span>}
                    </div>
                  </div>
                </div>
              </div>
            </section>
          </div>

          <aside className="workspace-rail">
            <section className="rail-block rail-block-emphasis">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Execution</p>
                  <h2>Action sequence</h2>
                </div>
              </div>
              <div className={`summary-card ${result?.ok ? "result-success" : "result-failure"}`}>
                <span className="label">Assistant Reply</span>
                <p>
                  {isLoading
                    ? "Processing request..."
                    : result?.spokenReply ??
                      "No action yet. Connect, verify, then submit a request to stage the protected action."}
                </p>
              </div>
              <div className="transcript rail-copy">
                {result?.actionSummary ?? "Merchant decision summary will appear here."}
              </div>
              {result?.bookingReady ? (
                <div className="rail-actions">
                  <button
                    className="button"
                    onClick={() => void handleBookByCall()}
                    disabled={isBookingCallLoading || !verification.walletConnected}
                  >
                    {isBookingCallLoading ? "Calling..." : "Book by Call"}
                  </button>
                </div>
              ) : null}
              {result?.paymentReady ? (
                <div className="payment-block">
                  <div className="payment-kicker">Coinbase Pay</div>
                  <div className="payment-grid">
                    <div>
                      <div className="payment-title">{result.paymentLabel ?? "Complete Coinbase Pay"}</div>
                      <div className="payment-copy">
                        Phone confirmation is complete. Approve the payment step to release the final merchant confirmation.
                      </div>
                    </div>
                    <button className="button payment-button" onClick={() => void handleCoinbasePayComplete()} disabled={isCoinbasePayLoading}>
                      {isCoinbasePayLoading ? "Confirming..." : "Approve Payment"}
                    </button>
                  </div>
                </div>
              ) : null}
              {callBooking ? <div className="transcript rail-copy">Call status: {callBooking.status}. {callBooking.note}</div> : null}
              {callBooking?.transcriptTurns?.length ? (
                <div className="transcript rail-copy">
                  {callBooking.transcriptTurns
                    .slice(-4)
                    .map((turn) => `${turn.speaker}: ${turn.text}`)
                    .join("\n")}
                </div>
              ) : null}
              <div className="rail-meta">
                <div>
                  <span>Intent</span>
                  <strong>{result?.parsedIntent ?? "n/a"}</strong>
                </div>
                <div>
                  <span>Selected item</span>
                  <strong>{result?.selectedItemId ?? "n/a"}</strong>
                </div>
                <div>
                  <span>Result</span>
                  <strong>{result ? (result.ok ? "Approved" : "Rejected") : "Pending"}</strong>
                </div>
              </div>
            </section>

            <section className="rail-block">
              <div className="section-head">
                <div>
                  <p className="eyebrow">Flow</p>
                  <h2>Current run</h2>
                </div>
              </div>
              <div className="run-grid">
                <div className="run-stat">
                  <span>Stage</span>
                  <strong>{currentStageLabel}</strong>
                </div>
                <div className="run-stat">
                  <span>Next</span>
                  <strong>{nextActionLabel}</strong>
                </div>
                <div className="run-stat run-stat-wide">
                  <span>Latest event</span>
                  <strong>{latestEvent?.title ?? "Awaiting request"}</strong>
                  <p>{latestEvent ? `${latestEvent.stage} • ${formatTime(latestEvent.timestamp)}` : "No events yet."}</p>
                </div>
              </div>
              <div className="timeline-legend timeline-tight">
                {flowSteps.map((step, index) => (
                  <div key={step.index} className={`flow-line ${resolveFlowState(index)}`}>
                    <div className="legend-index">{step.index}</div>
                    <div className="legend-copy">
                      <strong>{step.title}</strong>
                      <p>{step.detail}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </section>
    </main>
  );
}
