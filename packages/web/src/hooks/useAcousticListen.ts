/**
 * Acoustic FSK Decoder (Web Audio API)
 *
 * Listens via the microphone, captures raw PCM, then decodes Cyren's
 * 16-frequency FSK signal using the Goertzel algorithm — an O(N)
 * single-bin DFT that's more efficient than FFT when only 16 frequency
 * bins are needed.
 *
 * Pipeline: mic capture → normalize → preamble detection → per-nibble
 * Goertzel with Hann windowing → byte assembly → confidence scoring.
 */
import { useState, useRef, useCallback } from 'react';

// Must match transmitter exactly
const NIBBLE_FREQS = [1000,1200,1400,1600,1800,2000,2200,2400,2600,2800,3000,3200,3400,3600,3800,4000];
const TONE_DURATION = 0.100;
const TONE_STEP = 0.120;
const PREAMBLE_LOW = 500;
const PREAMBLE_HIGH = 4500;
const PREAMBLE_TONE_DURATION = 0.120;
const PREAMBLE_CYCLES = 4;

/** Goertzel with Hann window — used for data tone detection */
function goertzelHann(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const N = samples.length;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const hann = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    const s0 = samples[i] * hann + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Raw Goertzel without windowing — used for preamble detection where we need max sensitivity */
function goertzelRaw(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const N = samples.length;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = samples[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

/** Normalize PCM to [-1, 1] range */
function normalize(pcm: Float32Array): Float32Array {
  let max = 0;
  for (let i = 0; i < pcm.length; i++) {
    const abs = Math.abs(pcm[i]);
    if (abs > max) max = abs;
  }
  if (max < 0.001) return pcm; // silence, don't amplify noise
  const out = new Float32Array(pcm.length);
  const scale = 1.0 / max;
  for (let i = 0; i < pcm.length; i++) {
    out[i] = pcm[i] * scale;
  }
  return out;
}

/** Find where audio energy first exceeds a threshold — rough signal start */
function findEnergyOnset(pcm: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(0.020 * sampleRate); // 20ms windows
  const step = Math.floor(0.005 * sampleRate); // 5ms steps
  // Compute noise floor from first 100ms
  const noiseEnd = Math.min(Math.floor(0.100 * sampleRate), pcm.length);
  let noiseEnergy = 0;
  for (let i = 0; i < noiseEnd; i++) {
    noiseEnergy += pcm[i] * pcm[i];
  }
  noiseEnergy /= noiseEnd;
  const threshold = Math.max(noiseEnergy * 10, 0.001); // 10x noise floor or min threshold

  for (let pos = 0; pos + windowSize < pcm.length; pos += step) {
    let energy = 0;
    for (let i = pos; i < pos + windowSize; i++) {
      energy += pcm[i] * pcm[i];
    }
    energy /= windowSize;
    if (energy > threshold) {
      return Math.max(0, pos - step); // back up slightly
    }
  }
  return 0;
}

/** Detect preamble using raw Goertzel (no windowing) for maximum sensitivity */
function detectPreamble(pcm: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(PREAMBLE_TONE_DURATION * sampleRate);
  const totalTones = PREAMBLE_CYCLES * 2;
  const preambleLength = totalTones * windowSize;

  // Start searching from energy onset to reduce search space
  const energyStart = findEnergyOnset(pcm, sampleRate);
  const searchStart = Math.max(0, energyStart - windowSize);
  const searchEnd = Math.min(pcm.length - preambleLength, searchStart + Math.floor(2.0 * sampleRate)); // search 2s max

  const step = Math.floor(windowSize / 8);
  let bestPos = -1;
  let bestScore = 0;

  for (let pos = searchStart; pos < searchEnd; pos += step) {
    let score = 0;
    for (let t = 0; t < totalTones; t++) {
      const start = pos + t * windowSize;
      const w = pcm.slice(start, start + windowSize);
      const expected = t % 2 === 0 ? PREAMBLE_LOW : PREAMBLE_HIGH;
      const other = t % 2 === 0 ? PREAMBLE_HIGH : PREAMBLE_LOW;
      const magExpected = goertzelRaw(w, expected, sampleRate);
      const magOther = goertzelRaw(w, other, sampleRate);
      if (magExpected > magOther) {
        score += magExpected / (magExpected + magOther + 0.0001);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos + preambleLength;
    }
  }

  // If preamble detection found something reasonable, use it
  // Otherwise fall back to energy onset + estimated preamble duration
  if (bestScore > totalTones * 0.4) {
    return bestPos;
  }

  // Fallback: skip estimated preamble from energy onset
  console.warn('Preamble not detected, using energy onset fallback');
  return energyStart + preambleLength;
}

export interface AcousticDecodeResult {
  data: Uint8Array;
  confidence: number;
  errorPositions: number[];
}

export function useAcousticListen() {
  const [isListening, setIsListening] = useState(false);
  const [result, setResult] = useState<AcousticDecodeResult | null>(null);
  const ctxRef = useRef<AudioContext | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const chunksRef = useRef<Float32Array[]>([]);
  const analyserRef = useRef<AnalyserNode | null>(null);

  const startListening = useCallback(async () => {
    chunksRef.current = [];
    setResult(null);
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
    });
    streamRef.current = stream;
    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 2048;
    analyserRef.current = analyser;
    source.connect(analyser);
    const processor = ctx.createScriptProcessor(4096, 1, 1);
    processorRef.current = processor;
    processor.onaudioprocess = (e) => {
      chunksRef.current.push(new Float32Array(e.inputBuffer.getChannelData(0)));
    };
    analyser.connect(processor);
    processor.connect(ctx.destination);
    setIsListening(true);
  }, []);

  const stopAndDecode = useCallback((expectedBytes = 24) => {
    setIsListening(false);
    processorRef.current?.disconnect();
    streamRef.current?.getTracks().forEach(t => t.stop());
    const ctx = ctxRef.current;
    if (!ctx) return;

    const totalLength = chunksRef.current.reduce((s, c) => s + c.length, 0);
    const rawPcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) { rawPcm.set(chunk, offset); offset += chunk.length; }

    const sr = ctx.sampleRate;
    ctx.close();
    ctxRef.current = null;

    // Normalize audio for consistent detection regardless of mic gain
    const pcm = normalize(rawPcm);

    // Decode
    const dataStart = detectPreamble(pcm, sr);
    const toneSamples = Math.floor(TONE_DURATION * sr);
    const stepSamples = Math.floor(TONE_STEP * sr);
    // Offset into each tone: skip ramp + gap settling
    const skipSamples = Math.floor(0.015 * sr); // skip 15ms
    const analysisLen = toneSamples - Math.floor(0.020 * sr); // trim 20ms total (15ms start + 5ms end)
    const totalNibbles = expectedBytes * 2;
    const data = new Uint8Array(expectedBytes);
    const errorPositions: number[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < totalNibbles; i++) {
      const start = dataStart + i * stepSamples + skipSamples;
      const end = start + analysisLen;
      if (end > pcm.length) { errorPositions.push(Math.floor(i / 2)); continue; }
      const w = pcm.slice(start, end);

      let bestMag = 0, secondBest = 0, bestNibble = 0;
      for (let n = 0; n < 16; n++) {
        const mag = goertzelHann(w, NIBBLE_FREQS[n], sr);
        if (mag > bestMag) { secondBest = bestMag; bestMag = mag; bestNibble = n; }
        else if (mag > secondBest) secondBest = mag;
      }
      const sum = bestMag + secondBest;
      const conf = sum > 0 ? bestMag / sum : 0;
      totalConfidence += conf;
      const byteIdx = Math.floor(i / 2);
      if (i % 2 === 0) data[byteIdx] = bestNibble << 4;
      else data[byteIdx] |= bestNibble;
      if (conf < 0.55 && !errorPositions.includes(byteIdx)) errorPositions.push(byteIdx);
    }

    const decoded: AcousticDecodeResult = {
      data,
      confidence: totalConfidence / totalNibbles,
      errorPositions,
    };
    setResult(decoded);
    return decoded;
  }, []);

  return { startListening, stopAndDecode, isListening, result, analyserRef };
}
