const DEFAULT_VOICECALL_API_BASE_URL = "http://127.0.0.1:8000";
const DEFAULT_BOOKING_NUMBER = "+12149098059";

type VoiceCallCreateResponse = {
  call_id: string;
  status: string;
  room_name: string;
};

type VoiceCallDetail = {
  id: string;
  status: string;
  to_number: string;
  from_number: string;
  room_name: string;
};

type VoiceCallTranscriptTurn = {
  id: string;
  speaker: string;
  text: string;
  created_at?: string;
};

function getVoiceCallConfig() {
  return {
    apiBaseUrl: process.env.VOICECALL_API_BASE_URL ?? DEFAULT_VOICECALL_API_BASE_URL,
    apiAuthToken: process.env.VOICECALL_API_AUTH_TOKEN ?? "",
    bookingNumber: process.env.VOICECALL_TO_NUMBER ?? DEFAULT_BOOKING_NUMBER
  } as const;
}

function getHeaders() {
  const config = getVoiceCallConfig();
  if (!config.apiAuthToken) {
    throw new Error("VOICECALL_API_AUTH_TOKEN is not configured.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${config.apiAuthToken}`
  };
}

async function voiceCallFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const config = getVoiceCallConfig();
  const response = await fetch(`${config.apiBaseUrl}${path}`, {
    ...init,
    headers: {
      ...getHeaders(),
      ...(init?.headers ?? {})
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Voicecall API error (${response.status}): ${text || "request failed"}`);
  }

  return (await response.json()) as T;
}

export function getBookingPhoneNumber() {
  return getVoiceCallConfig().bookingNumber;
}

export async function startBookingCall(transcript: string) {
  const phoneNumber = getBookingPhoneNumber();
  const call = await voiceCallFetch<VoiceCallCreateResponse>("/v1/calls/outbound", {
    method: "POST",
    body: JSON.stringify({
      to: phoneNumber,
      context: {
        objective:
          "Read the HumanVoice booking request to the callee, confirm any necessary details, and instruct the callee to say done once the reservation or checkout should be committed.",
        talking_points: transcript,
        customer_name: "HumanVoice Merchant"
      },
      metadata: {
        source: "humanvoice",
        mode: "booking_confirmation"
      }
    })
  });

  await voiceCallFetch<{ ok: boolean }>(`/v1/calls/${call.call_id}/next-turn`, {
    method: "POST",
    body: JSON.stringify({
      text: `HumanVoice booking request: ${transcript}. When you are finished confirming this request, please say done so I can finalize the booking.`
    })
  });

  return {
    callId: call.call_id,
    phoneNumber,
    status: call.status
  };
}

export async function getBookingCall(callId: string) {
  const [call, transcript] = await Promise.all([
    voiceCallFetch<VoiceCallDetail>(`/v1/calls/${callId}`),
    voiceCallFetch<VoiceCallTranscriptTurn[]>(`/v1/calls/${callId}/transcript`)
  ]);

  return { call, transcript };
}
