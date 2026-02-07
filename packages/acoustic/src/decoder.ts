import {
  NIBBLE_FREQS,
  TONE_DURATION,
  TONE_STEP,
  PREAMBLE_LOW,
  PREAMBLE_HIGH,
  PREAMBLE_TONE_DURATION,
  PREAMBLE_CYCLES,
  type DecodeResult,
} from './fsk-config.js';

/**
 * Goertzel algorithm — returns magnitude at a target frequency.
 * O(N) per frequency, much faster than FFT for detecting specific known frequencies.
 */
export function goertzel(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const N = samples.length;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const cosW = Math.cos(w);
  const coeff = 2 * cosW;

  let s0 = 0;
  let s1 = 0;
  let s2 = 0;

  for (let i = 0; i < N; i++) {
    s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }

  // Power magnitude
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Detect the preamble and return its end position in samples */
function detectPreamble(pcm: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(PREAMBLE_TONE_DURATION * sampleRate);
  const step = Math.floor(windowSize / 4); // 25% overlap for better detection
  const totalPreambleTones = PREAMBLE_CYCLES * 2; // 6 tones
  const threshold = 0.1;

  // Scan for the alternating pattern
  for (let pos = 0; pos < pcm.length - windowSize * totalPreambleTones; pos += step) {
    let matches = 0;

    for (let t = 0; t < totalPreambleTones; t++) {
      const start = pos + t * windowSize;
      const window = pcm.slice(start, start + windowSize);
      const expectedFreq = t % 2 === 0 ? PREAMBLE_LOW : PREAMBLE_HIGH;
      const otherFreq = t % 2 === 0 ? PREAMBLE_HIGH : PREAMBLE_LOW;

      const magExpected = goertzel(window, expectedFreq, sampleRate);
      const magOther = goertzel(window, otherFreq, sampleRate);

      if (magExpected > threshold && magExpected > magOther * 1.5) {
        matches++;
      }
    }

    if (matches >= totalPreambleTones - 1) {
      // Return position after preamble
      return pos + totalPreambleTones * windowSize;
    }
  }

  // Fallback: assume data starts at the beginning
  return 0;
}

/** Detect which nibble value a window of samples represents */
function detectNibble(samples: Float32Array, sampleRate: number): { nibble: number; confidence: number } {
  let bestMag = -1;
  let secondBestMag = -1;
  let bestNibble = 0;

  for (let n = 0; n < 16; n++) {
    const mag = goertzel(samples, NIBBLE_FREQS[n], sampleRate);
    if (mag > bestMag) {
      secondBestMag = bestMag;
      bestMag = mag;
      bestNibble = n;
    } else if (mag > secondBestMag) {
      secondBestMag = mag;
    }
  }

  const confidence = secondBestMag > 0 ? bestMag / (bestMag + secondBestMag) : 1.0;
  return { nibble: bestNibble, confidence };
}

/**
 * Decode PCM audio data back into bytes using Goertzel detection.
 */
export function decodePCM(
  pcmData: Float32Array,
  sampleRate: number,
  expectedBytes: number = 24,
): DecodeResult {
  const dataStart = detectPreamble(pcmData, sampleRate);
  const toneSamples = Math.floor(TONE_DURATION * sampleRate);
  const stepSamples = Math.floor(TONE_STEP * sampleRate);
  const totalNibbles = expectedBytes * 2;

  const data = new Uint8Array(expectedBytes);
  const errorPositions: number[] = [];
  let totalConfidence = 0;

  for (let i = 0; i < totalNibbles; i++) {
    const start = dataStart + i * stepSamples;
    const end = start + toneSamples;

    if (end > pcmData.length) {
      errorPositions.push(Math.floor(i / 2));
      continue;
    }

    const window = pcmData.slice(start, end);
    const { nibble, confidence } = detectNibble(window, sampleRate);
    totalConfidence += confidence;

    const byteIdx = Math.floor(i / 2);
    if (i % 2 === 0) {
      data[byteIdx] = (nibble << 4);
    } else {
      data[byteIdx] |= nibble;
    }

    if (confidence < 0.6) {
      if (!errorPositions.includes(byteIdx)) {
        errorPositions.push(byteIdx);
      }
    }
  }

  return {
    data,
    confidence: totalConfidence / totalNibbles,
    errorPositions,
  };
}
