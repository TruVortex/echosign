import type { SignedPayload } from './types.js';

/**
 * 120-byte wire format:
 * [0-23]:   semantic code (24 bytes)
 * [24-87]:  Ed25519 signature (64 bytes)
 * [88-119]: public key (32 bytes)
 */
export const WIRE_LENGTH = 120;

export function pack(payload: SignedPayload): Uint8Array {
  const wire = new Uint8Array(WIRE_LENGTH);
  wire.set(payload.code, 0);
  wire.set(payload.signature, 24);
  wire.set(payload.publicKey, 88);
  return wire;
}

export function unpack(wire: Uint8Array): SignedPayload {
  if (wire.length < WIRE_LENGTH) {
    throw new Error(`Wire data too short: expected ${WIRE_LENGTH} bytes, got ${wire.length}`);
  }
  return {
    code: wire.slice(0, 24),
    signature: wire.slice(24, 88),
    publicKey: wire.slice(88, 120),
  };
}
