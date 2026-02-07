import { encodeToTones } from './encoder.js';
import { RAMP_TIME } from './fsk-config.js';

/**
 * Play FSK tones through Web Audio API with sample-accurate scheduling.
 */
export async function playTones(
  data: Uint8Array,
  ctx: AudioContext,
  onProgress?: (fraction: number) => void,
): Promise<void> {
  const tones = encodeToTones(data);
  const totalDuration = tones[tones.length - 1].startTime + tones[tones.length - 1].duration;
  const startTime = ctx.currentTime + 0.05; // small buffer

  for (let i = 0; i < tones.length; i++) {
    const tone = tones[i];
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.value = tone.frequency;
    osc.connect(gain);
    gain.connect(ctx.destination);

    const toneStart = startTime + tone.startTime;
    const toneEnd = toneStart + tone.duration;

    // Envelope: ramp up, hold, ramp down
    gain.gain.setValueAtTime(0, toneStart);
    gain.gain.linearRampToValueAtTime(0.8, toneStart + RAMP_TIME);
    gain.gain.setValueAtTime(0.8, toneEnd - RAMP_TIME);
    gain.gain.linearRampToValueAtTime(0, toneEnd);

    osc.start(toneStart);
    osc.stop(toneEnd);
  }

  // Wait for playback to complete
  return new Promise((resolve) => {
    const checkInterval = setInterval(() => {
      const elapsed = ctx.currentTime - startTime;
      const fraction = Math.min(1, elapsed / totalDuration);
      onProgress?.(fraction);
      if (elapsed >= totalDuration) {
        clearInterval(checkInterval);
        resolve();
      }
    }, 50);
  });
}
