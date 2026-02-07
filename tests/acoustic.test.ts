import { describe, it, expect } from 'vitest';
import { encodeToTones, tonesToPCM } from '../packages/acoustic/src/encoder.js';
import { decodePCM, goertzel } from '../packages/acoustic/src/decoder.js';
import { NIBBLE_FREQS } from '../packages/acoustic/src/fsk-config.js';

describe('Acoustic FSK', () => {
  it('should generate correct number of tones for 24 bytes', () => {
    const data = new Uint8Array(24).fill(0xAB);
    const tones = encodeToTones(data);
    // 6 preamble + 48 data nibbles + 1 postamble = 55
    expect(tones.length).toBe(55);
  });

  it('should round-trip encode→PCM→decode for 24 bytes', () => {
    const data = new Uint8Array(24);
    for (let i = 0; i < 24; i++) data[i] = i * 10;

    const tones = encodeToTones(data);
    const pcm = tonesToPCM(tones, 44100);
    const result = decodePCM(pcm, 44100, 24);

    // Should decode with high confidence
    expect(result.confidence).toBeGreaterThan(0.7);

    // Check data match
    let matches = 0;
    for (let i = 0; i < 24; i++) {
      if (result.data[i] === data[i]) matches++;
    }
    expect(matches).toBeGreaterThanOrEqual(20); // allow minor errors
  });

  it('should detect Goertzel magnitudes at correct frequencies', () => {
    const sampleRate = 44100;
    const freq = 2000;
    const N = 2646; // ~60ms at 44100
    const samples = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      samples[i] = Math.sin(2 * Math.PI * freq * i / sampleRate);
    }

    // Should have high magnitude at 2000Hz
    const magTarget = goertzel(samples, freq, sampleRate);
    // Should have low magnitude at other frequencies
    const magOther = goertzel(samples, 3000, sampleRate);

    expect(magTarget).toBeGreaterThan(magOther * 2);
  });

  it('should encode each nibble to correct frequency', () => {
    // Test single byte 0xAB → nibbles A (3000Hz) and B (3200Hz)
    const data = new Uint8Array([0xAB]);
    const tones = encodeToTones(data);

    // Skip preamble (6 tones), check data tones
    const dataTones = tones.slice(6, 8);
    expect(dataTones[0].frequency).toBe(NIBBLE_FREQS[0xA]); // 3000
    expect(dataTones[1].frequency).toBe(NIBBLE_FREQS[0xB]); // 3200
  });

  it('should round-trip a known pattern', () => {
    const data = new Uint8Array([0x00, 0xFF, 0xA5, 0x5A]);
    const tones = encodeToTones(data);
    const pcm = tonesToPCM(tones, 44100);
    const result = decodePCM(pcm, 44100, 4);

    expect(result.data[0]).toBe(0x00);
    expect(result.data[1]).toBe(0xFF);
    expect(result.data[2]).toBe(0xA5);
    expect(result.data[3]).toBe(0x5A);
  });
});
