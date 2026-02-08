import { useState, useRef, useCallback } from 'react';

// Inline Goertzel + decode for browser use
const NIBBLE_FREQS = [1000,1200,1400,1600,1800,2000,2200,2400,2600,2800,3000,3200,3400,3600,3800,4000];
const TONE_DURATION = 0.100; // must match transmitter
const TONE_STEP = 0.120;    // must match transmitter
const RAMP_TIME = 0.005;
const PREAMBLE_LOW = 500;
const PREAMBLE_HIGH = 4500;
const PREAMBLE_TONE_DURATION = 0.120; // must match transmitter
const PREAMBLE_CYCLES = 4;            // must match transmitter

// Analysis window: skip ramp-up and ramp-down, sample the stable middle
const ANALYSIS_OFFSET = RAMP_TIME + 0.010; // skip 15ms into each tone
const ANALYSIS_DURATION = TONE_DURATION - ANALYSIS_OFFSET - RAMP_TIME; // ~80ms of clean signal

/** Apply Hann window in-place to reduce spectral leakage */
function applyHann(samples: Float32Array): Float32Array {
  const N = samples.length;
  const windowed = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    const w = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (N - 1)));
    windowed[i] = samples[i] * w;
  }
  return windowed;
}

function goertzel(samples: Float32Array, targetFreq: number, sampleRate: number): number {
  const windowed = applyHann(samples);
  const N = windowed.length;
  const k = Math.round((N * targetFreq) / sampleRate);
  const w = (2 * Math.PI * k) / N;
  const coeff = 2 * Math.cos(w);
  let s1 = 0, s2 = 0;
  for (let i = 0; i < N; i++) {
    const s0 = windowed[i] + coeff * s1 - s2;
    s2 = s1;
    s1 = s0;
  }
  return Math.sqrt(s1 * s1 + s2 * s2 - coeff * s1 * s2);
}

function detectPreamble(pcm: Float32Array, sampleRate: number): number {
  const windowSize = Math.floor(PREAMBLE_TONE_DURATION * sampleRate);
  const step = Math.floor(windowSize / 8); // finer stepping for more precise detection
  const totalTones = PREAMBLE_CYCLES * 2;
  let bestPos = 0;
  let bestScore = 0;

  for (let pos = 0; pos < pcm.length - windowSize * totalTones; pos += step) {
    let score = 0;
    for (let t = 0; t < totalTones; t++) {
      const start = pos + t * windowSize;
      const w = pcm.slice(start, start + windowSize);
      const expected = t % 2 === 0 ? PREAMBLE_LOW : PREAMBLE_HIGH;
      const other = t % 2 === 0 ? PREAMBLE_HIGH : PREAMBLE_LOW;
      const magExpected = goertzel(w, expected, sampleRate);
      const magOther = goertzel(w, other, sampleRate);
      if (magExpected > magOther * 1.3) {
        score += magExpected / (magExpected + magOther);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestPos = pos + totalTones * windowSize;
    }
  }

  return bestScore > totalTones * 0.5 ? bestPos : 0;
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
    const ctx = new AudioContext({ sampleRate: 44100 });
    ctxRef.current = ctx;
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
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
    const pcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of chunksRef.current) { pcm.set(chunk, offset); offset += chunk.length; }

    const sr = ctx.sampleRate;
    ctx.close();
    ctxRef.current = null;

    // Decode
    const dataStart = detectPreamble(pcm, sr);
    const offsetSamples = Math.floor(ANALYSIS_OFFSET * sr);
    const analysisSamples = Math.floor(ANALYSIS_DURATION * sr);
    const stepSamples = Math.floor(TONE_STEP * sr);
    const totalNibbles = expectedBytes * 2;
    const data = new Uint8Array(expectedBytes);
    const errorPositions: number[] = [];
    let totalConfidence = 0;

    for (let i = 0; i < totalNibbles; i++) {
      // Sample from the stable middle of each tone, skipping ramp
      const start = dataStart + i * stepSamples + offsetSamples;
      const end = start + analysisSamples;
      if (end > pcm.length) { errorPositions.push(Math.floor(i / 2)); continue; }
      const w = pcm.slice(start, end);

      let bestMag = -1, secondBest = -1, bestNibble = 0;
      for (let n = 0; n < 16; n++) {
        const mag = goertzel(w, NIBBLE_FREQS[n], sr);
        if (mag > bestMag) { secondBest = bestMag; bestMag = mag; bestNibble = n; }
        else if (mag > secondBest) secondBest = mag;
      }
      const conf = secondBest > 0 ? bestMag / (bestMag + secondBest) : 1;
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
