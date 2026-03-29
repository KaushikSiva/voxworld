export type VerificationStatus = "verified" | "unverified" | "pending";

export type VerificationState = {
  status: VerificationStatus;
  isConfigured: boolean;
  walletConnected: boolean;
  walletAddress: string;
  message: string;
  proof: string | null;
  verifiedAt: string | null;
};

export type MerchantItem = {
  id: string;
  title: string;
  category: "coworking" | "event" | "product";
  description: string;
  inventory: number;
  priceLabel: string;
  protected: boolean;
};

export type MerchantRequest = {
  transcript: string;
  userId: string;
  verification: VerificationState;
};

export type DemoEvent = {
  id: string;
  stage: "request" | "verification" | "merchant" | "result";
  title: string;
  detail: string;
  tone: "neutral" | "success" | "error";
  timestamp: string;
};

export type ActionResponse = {
  ok: boolean;
  spokenReply: string;
  actionSummary: string;
  parsedIntent: string;
  selectedItemId: string | null;
  bookingReady?: boolean;
  paymentReady?: boolean;
  paymentLabel?: string | null;
  events: DemoEvent[];
};

export type CallBookingStatus =
  | "idle"
  | "calling"
  | "awaiting_done"
  | "awaiting_payment"
  | "confirmed"
  | "failed";

export type CallBookingResponse = {
  status: CallBookingStatus;
  callId: string;
  phoneNumber: string;
  note: string;
  transcriptTurns: Array<{
    speaker: string;
    text: string;
    createdAt?: string;
  }>;
  actionResult?: ActionResponse;
};
