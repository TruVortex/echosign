/** Alert type codes - byte 0 of semantic code */
export enum AlertType {
  SOS        = 0x01,
  Medical    = 0x02,
  Fire       = 0x03,
  Flood      = 0x04,
  Earthquake = 0x05,
  Infra      = 0x06,
  Evacuation = 0x07,
  AllClear   = 0x08,
  Supply     = 0x09,
  Rescue     = 0x0A,
}

/** Severity levels - byte 1 */
export enum Severity {
  Low      = 0x01,
  Medium   = 0x02,
  High     = 0x03,
  Critical = 0x04,
}

/** Structured output from Gemini encoder */
export interface SemanticFields {
  type: string;       // 2-char code: "EQ", "FL", "FI", "MD", etc.
  severity: number;   // 1-9
  lat: number;        // integer: real_lat * 10000 + 900000
  lon: number;        // integer: real_lon * 10000 + 1800000
  pop: number;        // log2 scale 0-15 (0=1, 15=32768+)
  msg: string;        // up to 8 ASCII chars of key info
}

/** The 24-byte packed binary code */
export interface SemanticCode {
  bytes: Uint8Array;  // exactly 24 bytes
  hex: string;        // 48 hex chars
  fields: SemanticFields;
}

/** Ed25519 signed payload */
export interface SignedPayload {
  code: Uint8Array;       // 24 bytes
  signature: Uint8Array;  // 64 bytes
  publicKey: Uint8Array;  // 32 bytes
}

/** Audit entry for Solana logging */
export interface AuditEntry {
  code: string;           // hex
  signature: string;      // base58
  pubkey: string;         // base58
  timestamp: number;      // unix seconds
  alertType: string;      // human-readable
  confidence?: number;    // acoustic decode confidence 0-1
}

/** Decoded alert result */
export interface DecodedAlert {
  text: string;
  fields: SemanticFields;
  verified: boolean | null;  // null = unchecked
}
