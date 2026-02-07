import { decodePCM } from './decoder.js';
import type { DecodeResult } from './fsk-config.js';

/**
 * AcousticListener — captures microphone audio and decodes FSK tones.
 * Uses ScriptProcessorNode to accumulate audio chunks for offline Goertzel analysis.
 */
export class AcousticListener {
  private ctx: AudioContext | null = null;
  private stream: MediaStream | null = null;
  private processor: ScriptProcessorNode | null = null;
  private chunks: Float32Array[] = [];
  private _isListening = false;

  get isListening(): boolean {
    return this._isListening;
  }

  async startListening(): Promise<void> {
    this.chunks = [];
    this.ctx = new AudioContext({ sampleRate: 44100 });

    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
    });

    const source = this.ctx.createMediaStreamSource(this.stream);
    this.processor = this.ctx.createScriptProcessor(4096, 1, 1);

    this.processor.onaudioprocess = (event) => {
      const inputData = event.inputBuffer.getChannelData(0);
      this.chunks.push(new Float32Array(inputData));
    };

    source.connect(this.processor);
    this.processor.connect(this.ctx.destination);
    this._isListening = true;
  }

  stopAndDecode(expectedBytes: number = 120): DecodeResult {
    if (!this.ctx) {
      throw new Error('Not listening');
    }

    // Stop capture
    this._isListening = false;
    this.processor?.disconnect();
    this.stream?.getTracks().forEach(t => t.stop());

    // Concatenate all chunks
    const totalLength = this.chunks.reduce((sum, c) => sum + c.length, 0);
    const pcm = new Float32Array(totalLength);
    let offset = 0;
    for (const chunk of this.chunks) {
      pcm.set(chunk, offset);
      offset += chunk.length;
    }

    const sampleRate = this.ctx.sampleRate;
    this.ctx.close();
    this.ctx = null;
    this.chunks = [];

    return decodePCM(pcm, sampleRate, expectedBytes);
  }
}
