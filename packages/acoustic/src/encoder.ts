import {
  NIBBLE_FREQS,
  TONE_DURATION,
  TONE_GAP,
  TONE_STEP,
  PREAMBLE_LOW,
  PREAMBLE_HIGH,
  PREAMBLE_TONE_DURATION,
  PREAMBLE_CYCLES,
  POSTAMBLE_FREQ,
  POSTAMBLE_DURATION,
  AMPLITUDE,
  type ToneEvent,
} from './fsk-config.js';

/** Convert byte array to a sequence of ToneEvents (preamble + data + postamble) */
export function encodeToTones(data: Uint8Array): ToneEvent[] {
  const tones: ToneEvent[] = [];
  let time = 0;

  // Preamble: 3 cycles of alternating 500Hz/4500Hz
  for (let i = 0; i < PREAMBLE_CYCLES; i++) {
    tones.push({ frequency: PREAMBLE_LOW, startTime: time, duration: PREAMBLE_TONE_DURATION });
    time += PREAMBLE_TONE_DURATION;
    tones.push({ frequency: PREAMBLE_HIGH, startTime: time, duration: PREAMBLE_TONE_DURATION });
    time += PREAMBLE_TONE_DURATION;
  }

  // Data: each byte → 2 nibbles (high first)
  for (let i = 0; i < data.length; i++) {
    const highNibble = (data[i] >> 4) & 0x0F;
    const lowNibble = data[i] & 0x0F;

    tones.push({ frequency: NIBBLE_FREQS[highNibble], startTime: time, duration: TONE_DURATION });
    time += TONE_STEP;

    tones.push({ frequency: NIBBLE_FREQS[lowNibble], startTime: time, duration: TONE_DURATION });
    time += TONE_STEP;
  }

  // Postamble
  tones.push({ frequency: POSTAMBLE_FREQ, startTime: time, duration: POSTAMBLE_DURATION });

  return tones;
}

/** Generate a Hann window of given length */
function hannWindow(length: number): Float32Array {
  const window = new Float32Array(length);
  for (let i = 0; i < length; i++) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (length - 1)));
  }
  return window;
}

/** Convert ToneEvents to PCM audio samples */
export function tonesToPCM(tones: ToneEvent[], sampleRate: number = 44100): Float32Array {
  // Calculate total duration
  const lastTone = tones[tones.length - 1];
  const totalDuration = lastTone.startTime + lastTone.duration + 0.05; // 50ms tail silence
  const totalSamples = Math.ceil(totalDuration * sampleRate);
  const pcm = new Float32Array(totalSamples);

  for (const tone of tones) {
    const startSample = Math.floor(tone.startTime * sampleRate);
    const toneSamples = Math.floor(tone.duration * sampleRate);
    const window = hannWindow(toneSamples);

    for (let i = 0; i < toneSamples; i++) {
      const sample = startSample + i;
      if (sample < totalSamples) {
        pcm[sample] += AMPLITUDE * window[i] * Math.sin(2 * Math.PI * tone.frequency * i / sampleRate);
      }
    }
  }

  return pcm;
}
