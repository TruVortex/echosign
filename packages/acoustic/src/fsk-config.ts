/** FSK frequency table: nibble value → frequency in Hz */
export const NIBBLE_FREQS: readonly number[] = [
  1000, // 0x0
  1200, // 0x1
  1400, // 0x2
  1600, // 0x3
  1800, // 0x4
  2000, // 0x5
  2200, // 0x6
  2400, // 0x7
  2600, // 0x8
  2800, // 0x9
  3000, // 0xA
  3200, // 0xB
  3400, // 0xC
  3600, // 0xD
  3800, // 0xE
  4000, // 0xF
];

/** Tone duration in seconds */
export const TONE_DURATION = 0.060; // 60ms

/** Silence gap between tones in seconds */
export const TONE_GAP = 0.010; // 10ms

/** Combined tone+gap duration */
export const TONE_STEP = TONE_DURATION + TONE_GAP; // 70ms

/** Preamble frequencies */
export const PREAMBLE_LOW = 500;
export const PREAMBLE_HIGH = 4500;
export const PREAMBLE_TONE_DURATION = 0.080; // 80ms
export const PREAMBLE_CYCLES = 3; // 3 cycles of low/high = 6 tones = 480ms

/** Postamble */
export const POSTAMBLE_FREQ = 4500;
export const POSTAMBLE_DURATION = 0.200; // 200ms

/** Tone amplitude */
export const AMPLITUDE = 0.8;

/** Ramp time for click avoidance in web audio */
export const RAMP_TIME = 0.005; // 5ms

export interface ToneEvent {
  frequency: number;
  startTime: number;
  duration: number;
}

export interface DecodeResult {
  data: Uint8Array;
  confidence: number;
  errorPositions: number[];
}
