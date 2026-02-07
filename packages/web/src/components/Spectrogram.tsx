import React, { useEffect, useRef } from 'react';

interface Props {
  analyser: AnalyserNode | null;
  isActive: boolean;
}

const FSK_FREQS = [1000,1200,1400,1600,1800,2000,2200,2400,2600,2800,3000,3200,3400,3600,3800,4000];

export function Spectrogram({ analyser, isActive }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const columnRef = useRef(0);

  useEffect(() => {
    if (!isActive || !analyser || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d')!;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Float32Array(bufferLength);
    const sampleRate = analyser.context.sampleRate;
    columnRef.current = 0;

    ctx.fillStyle = '#0A0A0A';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw FSK frequency guide lines
    const nyquist = sampleRate / 2;
    ctx.strokeStyle = 'rgba(100, 100, 100, 0.3)';
    ctx.lineWidth = 1;
    for (const freq of FSK_FREQS) {
      const y = canvas.height - (freq / nyquist) * canvas.height;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    function draw() {
      if (!analyser || !canvasRef.current) return;
      animRef.current = requestAnimationFrame(draw);

      analyser.getFloatFrequencyData(dataArray);

      const x = columnRef.current % canvas.width;
      const colWidth = 2;

      // Clear column
      ctx.fillStyle = '#0A0A0A';
      ctx.fillRect(x, 0, colWidth, canvas.height);

      // Draw frequency data as waterfall
      for (let i = 0; i < bufferLength; i++) {
        const y = canvas.height - (i / bufferLength) * canvas.height;
        const val = (dataArray[i] + 100) / 100; // normalize -100..0 to 0..1
        const intensity = Math.max(0, Math.min(1, val));
        const r = Math.floor(intensity * 255);
        const g = Math.floor(intensity * 100);
        const b = Math.floor((1 - intensity) * 50);
        ctx.fillStyle = `rgb(${r},${g},${b})`;
        ctx.fillRect(x, y, colWidth, Math.max(1, canvas.height / bufferLength));
      }

      // Draw cursor line
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(x + colWidth, 0);
      ctx.lineTo(x + colWidth, canvas.height);
      ctx.stroke();

      columnRef.current += colWidth;
    }

    draw();

    return () => {
      cancelAnimationFrame(animRef.current);
    };
  }, [isActive, analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={600}
      height={200}
      className="w-full rounded-lg border border-dark-700 bg-dark-900"
    />
  );
}
