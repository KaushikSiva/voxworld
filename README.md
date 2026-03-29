# HumanVoice

HumanVoice is a hackathon MVP that demonstrates a simple difference:

- a normal AI voice agent gets rejected by protected inventory
- a human-backed AI agent succeeds because it presents a verified World ID proof and a connected Coinbase Wallet

The app uses a one-page Next.js UI, browser speech APIs for voice, a fake merchant backend, a Coinbase Wallet connection path, and a separate World verification adapter that stores a signed local verification session for protected actions.

## What the demo shows

1. Start in the default unverified state.
2. Connect Coinbase Wallet.
3. Ask for a protected reservation and watch the merchant reject it while unverified.
4. Verify the agent with World ID.
5. Repeat the same request.
6. The merchant accepts it and the assistant speaks the success result back.

## Architecture

- `app/page.tsx`
  Single-page demo UI with verification controls, microphone button, transcript, result card, inventory, and event log.
- `app/api/voice-action/route.ts`
  Orchestration endpoint for the voice request.
- `app/api/merchant/protected-action/route.ts`
  Protected merchant endpoint that enforces verification.
- `app/api/verify-agent/route.ts`
  Reads or clears the local signed verification session.
- `app/api/world/verify-proof/route.ts`
  Backend proof verification route.
- `lib/walletAdapter.ts`
  Coinbase Wallet injected-provider integration and wallet formatting helpers.
- `lib/worldAgentKitAdapter.ts`
  World verification adapter. This is where the World SDK proof is verified and normalized into the app’s verification state.
- `lib/merchantService.ts`
  Fake merchant logic plus protected inventory enforcement.
- `lib/demoOrchestrator.ts`
  Request -> verification -> merchant -> spoken result pipeline.
## Setup

1. Install dependencies:

```bash
npm install
```

2. Create `.env.local` from `.env.example` and set:

```bash
NEXT_PUBLIC_WORLD_APP_ID=app_staging_xxxxx
NEXT_PUBLIC_WORLD_ACTION=verify-humanvoice-agent
HUMANVOICE_SESSION_SECRET=replace-with-random-secret
```

3. Start the app:

```bash
npm run dev
```

4. Open `http://localhost:3000`.

## Coinbase Wallet integration

This implementation uses Coinbase Wallet's injected EIP-1193 provider path.

Flow:

1. The user clicks `Connect Coinbase Wallet`.
2. The app looks for a Coinbase Wallet injected provider.
3. The wallet returns the connected account and current chain ID.
4. The UI shows the live Coinbase address instead of a fake demo wallet.

If Coinbase Wallet is not installed, the app stays usable, but the wallet chip remains disconnected and the UI explains what is missing.

## World ID integration

This implementation uses the official World ID React widget and backend proof verification helper:

- Frontend widget: `@worldcoin/idkit`
- Backend verification: `verifyCloudProof` from `@worldcoin/idkit-core/backend`

Flow:

1. The user opens the World verification widget from the app.
2. The widget returns a proof payload to the frontend.
3. The frontend posts that proof to `/api/world/verify-proof`.
4. The backend verifies the proof against the configured `app_id` and `action`.
5. On success, the server stores a signed verification cookie.
6. Protected merchant actions read that server-side session instead of trusting the client.

## Demo flow

1. Click `Connect Coinbase Wallet`.
2. Leave the session unverified or click `Use Unverified Agent`.
3. Press the microphone button and say: `Book one coworking pass for tomorrow.`
4. The app shows the transcript, logs the verification check, and returns a rejection.
5. Click `Verify with World ID`.
6. Complete the World flow.
7. Repeat the same request.
8. The app now returns a successful reservation and speaks it aloud.

If microphone permissions are unavailable, use one of the sample prompt buttons.

## Voice implementation

- Speech-to-text: browser Web Speech API (`SpeechRecognition` / `webkitSpeechRecognition`)
- Text-to-speech: browser `speechSynthesis`

This keeps the MVP fast to run locally and avoids external realtime infrastructure.

## Notes

- All three inventory items are protected on purpose so the trust gate is obvious.
- The merchant backend is intentionally narrow and demo-friendly.
- The browser voice APIs work best in Chromium-based browsers.
- If `NEXT_PUBLIC_WORLD_APP_ID` is missing, the app still demonstrates the unverified path and explains that live World verification is not configured.
- Coinbase Wallet integration currently uses the injected provider path, so desktop extension or in-wallet browser is the best demo setup.
# voxworld
