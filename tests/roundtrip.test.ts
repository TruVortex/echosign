import { describe, it, expect } from 'vitest';
import {
  packFields,
  unpackFields,
  verifyChecksum,
  bytesToHex,
  hexToBytes,
} from '../packages/core/src/codec.js';
import { generateKeypair, signCode, verifySignature } from '../packages/core/src/crypto.js';
import { pack, unpack } from '../packages/core/src/protocol.js';
import { encodeToTones, tonesToPCM } from '../packages/acoustic/src/encoder.js';
import { decodePCM } from '../packages/acoustic/src/decoder.js';
import type { SemanticFields } from '../packages/core/src/types.js';

describe('Full Round-Trip (offline)', () => {
  it('should encode→sign→pack→acoustic→unpack→verify→decode', async () => {
    // 1. Pack fields
    const fields: SemanticFields = {
      type: 'FL',
      severity: 6,
      lat: 29.7604,
      lon: -95.3698,
      pop: 10000,
      msg: 'RISINGWT',
    };

    const code = packFields(fields);
    expect(code.length).toBe(24);
    expect(verifyChecksum(code)).toBe(true);

    // 2. Sign
    const { privateKey, publicKey } = await generateKeypair();
    const signature = await signCode(code, privateKey);

    // 3. Pack into wire format
    const wire = pack({ code, signature, publicKey });
    expect(wire.length).toBe(120);

    // 4. Acoustic encode→decode (wire format is 120 bytes)
    const tones = encodeToTones(wire);
    const pcm = tonesToPCM(tones, 44100);
    const decoded = decodePCM(pcm, 44100, 120);

    // 5. Unpack wire
    const unpacked = unpack(decoded.data);

    // 6. Verify checksum on decoded code
    const checksumValid = verifyChecksum(unpacked.code);

    // 7. Verify signature
    const sigValid = await verifySignature(unpacked.code, unpacked.signature, unpacked.publicKey);

    // 8. Unpack fields
    const decodedFields = unpackFields(unpacked.code);

    // With clean PCM (no noise), we expect perfect results
    expect(checksumValid).toBe(true);
    expect(sigValid).toBe(true);
    expect(decodedFields.type).toBe('FL');
    expect(decodedFields.severity).toBe(6);
    expect(decodedFields.msg).toBe('RISINGWT');
    expect(Math.abs(decodedFields.lat - 29.7604)).toBeLessThan(0.001);
  });

  it('should handle hex conversion round-trip', () => {
    const fields: SemanticFields = {
      type: 'MD',
      severity: 8,
      lat: 40.7128,
      lon: -74.0060,
      pop: 200,
      msg: 'TRAPPED',
    };

    const code = packFields(fields);
    const hex = bytesToHex(code);
    expect(hex.length).toBe(48);

    const recovered = hexToBytes(hex);
    expect(recovered).toEqual(code);
    expect(verifyChecksum(recovered)).toBe(true);

    const recoveredFields = unpackFields(recovered);
    expect(recoveredFields.type).toBe('MD');
    expect(recoveredFields.severity).toBe(8);
  });
});
