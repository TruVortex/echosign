import { describe, it, expect } from 'vitest';
import { pack, unpack, WIRE_LENGTH } from '../packages/core/src/protocol.js';
import type { SignedPayload } from '../packages/core/src/types.js';

describe('Wire Protocol', () => {
  it('should pack and unpack a SignedPayload round-trip', () => {
    const payload: SignedPayload = {
      code: new Uint8Array(24).map((_, i) => i),
      signature: new Uint8Array(64).map((_, i) => i + 100),
      publicKey: new Uint8Array(32).map((_, i) => i + 200),
    };

    const wire = pack(payload);
    expect(wire.length).toBe(WIRE_LENGTH);

    const unpacked = unpack(wire);
    expect(unpacked.code).toEqual(payload.code);
    expect(unpacked.signature).toEqual(payload.signature);
    expect(unpacked.publicKey).toEqual(payload.publicKey);
  });

  it('should reject wire data that is too short', () => {
    expect(() => unpack(new Uint8Array(50))).toThrow('too short');
  });

  it('should produce exactly 120 bytes', () => {
    const payload: SignedPayload = {
      code: new Uint8Array(24),
      signature: new Uint8Array(64),
      publicKey: new Uint8Array(32),
    };
    expect(pack(payload).length).toBe(120);
  });
});
