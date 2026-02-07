import { describe, it, expect } from 'vitest';
import {
  packFields,
  unpackFields,
  verifyChecksum,
  crc16,
  bytesToHex,
  hexToBytes,
} from '../packages/core/src/codec.js';
import type { SemanticFields } from '../packages/core/src/types.js';

describe('Codec', () => {
  const testFields: SemanticFields = {
    type: 'EQ',
    severity: 7,
    lat: 34.0522,
    lon: -118.2437,
    pop: 5000,
    msg: 'COLLAPSE',
  };

  it('should pack fields into exactly 24 bytes', () => {
    const code = packFields(testFields);
    expect(code.length).toBe(24);
  });

  it('should produce valid CRC-16 checksum', () => {
    const code = packFields(testFields);
    expect(verifyChecksum(code)).toBe(true);
  });

  it('should round-trip pack/unpack fields', () => {
    const code = packFields(testFields);
    const unpacked = unpackFields(code);

    expect(unpacked.type).toBe('EQ');
    expect(unpacked.severity).toBe(7);
    expect(Math.abs(unpacked.lat - 34.0522)).toBeLessThan(0.001);
    expect(Math.abs(unpacked.lon - (-118.2437))).toBeLessThan(0.001);
    expect(unpacked.msg).toBe('COLLAPSE');
  });

  it('should detect checksum corruption', () => {
    const code = packFields(testFields);
    code[17] ^= 0xFF; // corrupt checksum byte
    expect(verifyChecksum(code)).toBe(false);
  });

  it('should round-trip hex conversion', () => {
    const original = new Uint8Array([0xDE, 0xAD, 0xBE, 0xEF]);
    const hex = bytesToHex(original);
    expect(hex).toBe('deadbeef');
    const back = hexToBytes(hex);
    expect(back).toEqual(original);
  });

  it('should clamp severity to 1-9', () => {
    const fields = { ...testFields, severity: 99 };
    const code = packFields(fields);
    expect(code[1]).toBe(9);
  });

  it('should handle zero population', () => {
    const fields = { ...testFields, pop: 0 };
    const code = packFields(fields);
    const unpacked = unpackFields(code);
    expect(unpacked.pop).toBe(0);
  });

  it('should truncate msg to 8 chars', () => {
    const fields = { ...testFields, msg: 'VERYLONGMESSAGE' };
    const code = packFields(fields);
    const unpacked = unpackFields(code);
    expect(unpacked.msg.length).toBeLessThanOrEqual(8);
  });

  it('should handle CRC-16 for known data', () => {
    const data = new Uint8Array([0x01, 0x02, 0x03]);
    const c = crc16(data);
    expect(typeof c).toBe('number');
    expect(c).toBeGreaterThan(0);
    expect(c).toBeLessThan(0x10000);
  });
});
