import { useState, useRef, useCallback } from 'react';

export function useAudioPlayer() {
  const [isPlaying, setIsPlaying] = useState(false);
  const ctxRef = useRef<AudioContext | null>(null);

  const play = useCallback(async (audioData: ArrayBuffer) => {
    const ctx = new AudioContext();
    ctxRef.current = ctx;
    setIsPlaying(true);

    const buffer = await ctx.decodeAudioData(audioData);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.connect(ctx.destination);
    source.onended = () => {
      setIsPlaying(false);
      ctx.close();
    };
    source.start();
  }, []);

  return { play, isPlaying };
}
