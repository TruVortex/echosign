/**
 * Acoustic FSK Transmitter (Web Audio API)
 *
 * Encodes a byte array as a sequence of sine tones using 16-frequency FSK
 * (1000–4000 Hz, 200 Hz spacing). Each nibble maps to one frequency.
 * Tones are 100ms with 5ms cosine ramps to eliminate click artifacts.
 *
 * A 4-cycle low/high preamble (500/4500 Hz) synchronizes the receiver,
 * and a 300ms postamble marks end-of-transmission.
 */
import { useState, useRef, useCallback } from 'react';

// Inline the FSK logic to avoid bundling Node-only code
const NIBBLE_FREQS = [1000,1200,1400,1600,1800,2000,2200,2400,2600,2800,3000,3200,3400,3600,3800,4000];
const TONE_DURATION = 0.100; // 100ms — longer tones for reliable speaker-to-mic detection
const TONE_STEP = 0.120;    // 120ms step (100ms tone + 20ms gap)
const PREAMBLE_LOW = 500;
const PREAMBLE_HIGH = 4500;
const PREAMBLE_TONE_DURATION = 0.120;
const PREAMBLE_CYCLES = 4;  // extra preamble cycle for robust sync
const POSTAMBLE_FREQ = 4500;
const POSTAMBLE_DURATION = 0.300;
const RAMP_TIME = 0.005;

function buildTones(data: Uint8Array) {
  const tones: { frequency: number; startTime: number; duration: number }[] = [];
  let time = 0;
  for (let i = 0; i < PREAMBLE_CYCLES; i++) {
    tones.push({ frequency: PREAMBLE_LOW, startTime: time, duration: PREAMBLE_TONE_DURATION });
    time += PREAMBLE_TONE_DURATION;
    tones.push({ frequency: PREAMBLE_HIGH, startTime: time, duration: PREAMBLE_TONE_DURATION });
    time += PREAMBLE_TONE_DURATION;
  }
  for (let i = 0; i < data.length; i++) {
    tones.push({ frequency: NIBBLE_FREQS[(data[i] >> 4) & 0x0F], startTime: time, duration: TONE_DURATION });
    time += TONE_STEP;
    tones.push({ frequency: NIBBLE_FREQS[data[i] & 0x0F], startTime: time, duration: TONE_DURATION });
    time += TONE_STEP;
  }
  tones.push({ frequency: POSTAMBLE_FREQ, startTime: time, duration: POSTAMBLE_DURATION });
  return tones;
}

export function useAcousticTransmit() {
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const ctxRef = useRef<AudioContext | null>(null);

  const transmit = useCallback(async (data: Uint8Array) => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    setIsPlaying(true);
    setProgress(0);

    const tones = buildTones(data);
    const totalDuration = tones[tones.length - 1].startTime + tones[tones.length - 1].duration;
    const startTime = ctx.currentTime + 0.05;

    for (const tone of tones) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.value = tone.frequency;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const toneStart = startTime + tone.startTime;
      const toneEnd = toneStart + tone.duration;
      gain.gain.setValueAtTime(0, toneStart);
      gain.gain.linearRampToValueAtTime(0.8, toneStart + RAMP_TIME);
      gain.gain.setValueAtTime(0.8, toneEnd - RAMP_TIME);
      gain.gain.linearRampToValueAtTime(0, toneEnd);
      osc.start(toneStart);
      osc.stop(toneEnd);
    }

    return new Promise<void>((resolve) => {
      const interval = setInterval(() => {
        const elapsed = ctx.currentTime - startTime;
        const frac = Math.min(1, elapsed / totalDuration);
        setProgress(frac);
        if (elapsed >= totalDuration) {
          clearInterval(interval);
          setIsPlaying(false);
          ctx.close();
          resolve();
        }
      }, 50);
    });
  }, []);

  return { transmit, isPlaying, progress };
}
