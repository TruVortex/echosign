# EchoSign

Offline-capable emergency communication protocol for disaster relief. Compresses emergency messages into 24-byte semantic codes using AI, transmits them over audio (FSK), and reconstructs them on the receiving end.

Built for the **CXC 2026 AI Hackathon**.

## How It Works

1. **Encode** — Type or speak an emergency message. Gemini extracts structured fields (type, severity, location, population, short message) and packs them into a 24-byte binary code.
2. **Transmit** — The code is signed with Ed25519 and transmitted as FSK audio tones (16 frequencies, 1000–4000 Hz) that work over any speaker/mic pair.
3. **Decode** — A receiving device listens for the FSK signal, decodes the bytes via Goertzel algorithm, verifies the checksum, and uses Gemini to reconstruct a human-readable alert.

## Protocol

| Bytes | Field |
|-------|-------|
| 0 | Alert type (SOS, Medical, Fire, Flood, Earthquake, etc.) |
| 1 | Severity (1–9) |
| 2–4 | Latitude (uint24) |
| 5–7 | Longitude (uint24) |
| 8 | Population affected (log2 scale) |
| 9–16 | Message (8 ASCII chars) |
| 17–18 | CRC-16 checksum |
| 19–23 | Reserved |

Wire format: 120 bytes (24B code + 64B Ed25519 signature + 32B public key).

## Tech Stack

- **Monorepo:** pnpm workspaces — `core`, `acoustic`, `speech`, `solana`, `cli`, `server`, `web`
- **AI:** Google Gemini 2.5 Flash — semantic encoding/decoding, speech-to-text, text-to-speech
- **Audio Transport:** Custom 16-frequency FSK with Goertzel decoding (60ms tones, 10ms gaps, Hann windowing)
- **Crypto:** `@noble/ed25519` for offline message signing
- **Frontend:** React + Tailwind CSS in a mobile-frame UI

## Prerequisites

- Node.js 20+
- pnpm 9+
- A [Google AI Studio](https://aistudio.google.com/apikey) API key (Gemini)

## Setup

```bash
# Clone and install
git clone <repo-url>
cd echosign
pnpm install

# Configure environment
cp .env.example .env
# Edit .env and add your GEMINI_API_KEY
```

The only required env var is:

```
GEMINI_API_KEY=your-gemini-api-key
```

## Running

Start the API server and web frontend in two terminals:

```bash
# Terminal 1 — API server (port 3001)
pnpm dev:server

# Terminal 2 — Web frontend (port 5173)
pnpm dev:web
```

Open http://localhost:5173.

## Usage

### Encode tab
1. Type an emergency message (or click the mic to record one)
2. Click **Encode Message** — Gemini extracts structured fields and produces a 24-byte hex code
3. Click **Sign & Transmit** — plays FSK audio tones through your speakers

### Decode tab
1. Click **Start Listening** — opens the microphone and shows a live spectrogram
2. Play FSK tones from another device (or the same machine)
3. Click **Stop & Decode** — Goertzel-decodes the signal, verifies CRC, and Gemini reconstructs the alert

## Project Structure

```
packages/
  core/       — Semantic codec (pack/unpack 24-byte codes), Gemini encode/decode
  acoustic/   — FSK modulation & Goertzel demodulation
  speech/     — STT/TTS config and types
  server/     — Express API (encode, decode, stt, tts endpoints)
  web/        — React frontend (mobile-frame UI)
  cli/        — CLI tool
  solana/     — Solana devnet audit log (disabled)
```

## Tests

```bash
pnpm test
```
