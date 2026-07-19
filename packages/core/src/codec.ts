/**
 * Cyren Semantic Codec
 *
 * Packs emergency messages into a 24-byte binary format:
 *   [type:1][severity:1][lat:3][lon:3][pop:1][msg:8][crc16:2][reserved:5]
 *
 * Encoding uses Gemini to extract structured fields from free-text input.
 * Decoding reverses the binary → fields, then Gemini reconstructs a
 * human-readable alert for first responders.
 *
 * CRC-16/CCITT-FALSE protects bytes 0–16 against corruption.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';
import type { SemanticFields, SemanticCode, DecodedAlert } from './types.js';
import { AlertType } from './types.js';

/** Map 2-char type codes to AlertType enum values */
const TYPE_MAP: Record<string, number> = {
  SO: AlertType.SOS,
  MD: AlertType.Medical,
  FI: AlertType.Fire,
  FL: AlertType.Flood,
  EQ: AlertType.Earthquake,
  IN: AlertType.Infra,
  EV: AlertType.Evacuation,
  AC: AlertType.AllClear,
  SC: AlertType.Supply,
  RC: AlertType.Rescue,
  TS: AlertType.Flood, // tsunami → flood category
};

/** Reverse map AlertType enum values to 2-char codes */
const REVERSE_TYPE_MAP: Record<number, string> = {};
for (const [code, val] of Object.entries(TYPE_MAP)) {
  if (!(val in REVERSE_TYPE_MAP)) {
    REVERSE_TYPE_MAP[val] = code;
  }
}

/** Alert type to human-readable name */
const ALERT_NAMES: Record<number, string> = {
  [AlertType.SOS]: 'SOS',
  [AlertType.Medical]: 'Medical Emergency',
  [AlertType.Fire]: 'Fire',
  [AlertType.Flood]: 'Flood',
  [AlertType.Earthquake]: 'Earthquake',
  [AlertType.Infra]: 'Infrastructure Collapse',
  [AlertType.Evacuation]: 'Evacuation',
  [AlertType.AllClear]: 'All Clear',
  [AlertType.Supply]: 'Supply Request',
  [AlertType.Rescue]: 'Rescue',
};

/** CRC-16/CCITT-FALSE */
export function crc16(data: Uint8Array): number {
  let crc = 0xFFFF;
  for (let i = 0; i < data.length; i++) {
    crc ^= data[i] << 8;
    for (let j = 0; j < 8; j++) {
      if (crc & 0x8000) {
        crc = ((crc << 1) ^ 0x1021) & 0xFFFF;
      } else {
        crc = (crc << 1) & 0xFFFF;
      }
    }
  }
  return crc;
}

/** Pack SemanticFields into a 24-byte binary code */
export function packFields(fields: SemanticFields): Uint8Array {
  const code = new Uint8Array(24);

  // Byte 0: type → AlertType enum lookup
  code[0] = TYPE_MAP[fields.type] ?? AlertType.SOS;

  // Byte 1: severity
  code[1] = Math.min(9, Math.max(1, fields.severity));

  // Bytes 2-4: latitude as uint24 BE (real_lat * 10000 + 900000)
  const latInt = Math.round(fields.lat * 10000) + 900000;
  code[2] = (latInt >> 16) & 0xFF;
  code[3] = (latInt >> 8) & 0xFF;
  code[4] = latInt & 0xFF;

  // Bytes 5-7: longitude as uint24 BE (real_lon * 10000 + 1800000)
  const lonInt = Math.round(fields.lon * 10000) + 1800000;
  code[5] = (lonInt >> 16) & 0xFF;
  code[6] = (lonInt >> 8) & 0xFF;
  code[7] = lonInt & 0xFF;

  // Byte 8: population (log2 scale upper nibble)
  const popLog = fields.pop > 0 ? Math.min(15, Math.ceil(Math.log2(fields.pop))) : 0;
  code[8] = (popLog & 0x0F) << 4;

  // Bytes 9-16: msg (8 ASCII chars)
  for (let i = 0; i < 8; i++) {
    code[9 + i] = i < fields.msg.length ? fields.msg.charCodeAt(i) : 0;
  }

  // Bytes 17-18: CRC-16 of bytes 0-16
  const crc = crc16(code.slice(0, 17));
  code[17] = (crc >> 8) & 0xFF;
  code[18] = crc & 0xFF;

  // Bytes 19-23: reserved (zeroed)
  return code;
}

/** Unpack a 24-byte code into SemanticFields */
export function unpackFields(code: Uint8Array): SemanticFields {
  const typeVal = code[0];
  const type = REVERSE_TYPE_MAP[typeVal] ?? 'SO';
  const severity = Math.min(9, Math.max(1, code[1]));

  const latInt = (code[2] << 16) | (code[3] << 8) | code[4];
  const lat = (latInt - 900000) / 10000;

  const lonInt = (code[5] << 16) | (code[6] << 8) | code[7];
  const lon = (lonInt - 1800000) / 10000;

  const popLog = (code[8] >> 4) & 0x0F;
  const pop = popLog > 0 ? Math.pow(2, popLog) : 0;

  let msg = '';
  for (let i = 9; i < 17; i++) {
    if (code[i] !== 0) msg += String.fromCharCode(code[i]);
  }

  return { type, severity, lat, lon, pop, msg };
}

/** Verify CRC-16 checksum in bytes 17-18 */
export function verifyChecksum(code: Uint8Array): boolean {
  const expected = crc16(code.slice(0, 17));
  const actual = (code[17] << 8) | code[18];
  return expected === actual;
}

/** Convert bytes to hex string */
export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

/** Convert hex string to bytes */
export function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return bytes;
}

/** Get human-readable alert type name */
export function getAlertName(code: Uint8Array): string {
  return ALERT_NAMES[code[0]] ?? 'Unknown';
}

/* eslint-disable no-console */
declare const console: { warn(...args: unknown[]): void };
declare function setTimeout(fn: () => void, ms: number): unknown;

/** Retry wrapper for Gemini API calls that handles 429 rate limits */
async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : String(error);
      if (msg.includes('429') && i < retries - 1) {
        const wait = 4000 * (i + 1); // 4s, 8s, 12s backoff
        console.warn(`Rate limited, retrying in ${wait / 1000}s... (${i + 1}/${retries})`);
        await new Promise(r => setTimeout(r as () => void, wait));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Max retries exceeded');
}

const ENCODE_SYSTEM_PROMPT = `You are an emergency message encoder for disaster-response communications.

Given an emergency message (up to 200 words), extract structured data and output
ONLY a JSON object with these exact fields:
- type: 2-letter code (EQ=earthquake, FL=flood, FI=fire, TS=tsunami,
  EV=evacuation, MD=medical, SO=SOS, RC=rescue, IN=infrastructure, SC=supply,
  AC=all-clear)
- severity: integer 1-9 (1=minor, 5=serious, 9=catastrophic)
- lat: latitude as decimal (e.g., 45.5231)
- lon: longitude as decimal (e.g., -122.6765)
- pop: estimated people affected as integer
- msg: most critical remaining info in max 8 ASCII characters

Rules:
- Do NOT guess missing data. Use 0 for unknown numbers, "??" for unknown type.
- lat/lon: If only a city/region name is given, use its approximate coordinates.
- pop: Best estimate. 0 if unknown.
- msg: Abbreviate aggressively. Examples: "TRAPPED", "RISINGWT", "COLLAPSE",
  "NEEDH2O", "ROADBLK"

Output ONLY valid JSON. No explanation, no markdown fences.`;

const DECODE_SYSTEM_PROMPT = `You are an emergency alert decoder for disaster-response command centers.

Given a JSON object with fields {type, severity, lat, lon, pop, msg},
reconstruct a clear, actionable emergency alert.

Format your response exactly as:
[ALERT TYPE] — Severity: [X]/9
Location: [decoded lat/lon as place name or coordinates]
Situation: [1-2 sentence description based on type + msg]
Affected: [pop] people (estimated)
Action Required: [inferred from type and severity]

Rules:
- Be authoritative and calm. This is for first responders.
- Do NOT fabricate details not present in the data.
- If msg contains abbreviations, expand them sensibly.
- If pop is 0, say "Unknown number of people affected."`;

/**
 * Encode an emergency message into a 24-byte semantic code using Gemini.
 */
export async function encodeMessage(text: string, apiKey: string): Promise<SemanticCode> {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    generationConfig: { responseMimeType: 'application/json' },
  });

  const result = await withRetry(() => model.generateContent({
    contents: [{ role: 'user', parts: [{ text }] }],
    systemInstruction: { role: 'model', parts: [{ text: ENCODE_SYSTEM_PROMPT }] },
  }));

  let responseText = result.response.text().trim();
  // Strip markdown fences if present
  const jsonMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (jsonMatch) responseText = jsonMatch[1].trim();
  const fields: SemanticFields = JSON.parse(responseText);

  // Clamp severity to 1-9 (Gemini sometimes returns values > 9)
  fields.severity = Math.min(9, Math.max(1, Math.round(fields.severity)));
  // Clamp msg to 8 chars
  fields.msg = fields.msg.slice(0, 8);

  const bytes = packFields(fields);
  const hex = bytesToHex(bytes);

  return { bytes, hex, fields };
}

/**
 * Decode a 24-byte semantic code back into a human-readable alert using Gemini.
 */
export async function decodeMessage(
  codeInput: Uint8Array | string,
  apiKey: string,
  verified: boolean | null = null,
  skipCrc = false,
): Promise<DecodedAlert & { crcValid: boolean }> {
  const code = typeof codeInput === 'string' ? hexToBytes(codeInput) : codeInput;

  const crcValid = verifyChecksum(code);
  if (!crcValid && !skipCrc) {
    throw new Error('CRC-16 checksum mismatch — data may be corrupted');
  }

  const fields = unpackFields(code);

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const result = await withRetry(() => model.generateContent({
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(fields) }] }],
    systemInstruction: { role: 'model', parts: [{ text: DECODE_SYSTEM_PROMPT }] },
  }));

  const text = result.response.text().trim();
  return { text, fields, verified, crcValid };
}
