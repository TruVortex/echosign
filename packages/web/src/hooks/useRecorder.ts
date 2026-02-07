import { useState, useRef, useCallback } from 'react';

export function useRecorder() {
  const [isRecording, setIsRecording] = useState(false);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const mediaRecorder = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);

  const start = useCallback(async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    const recorder = new MediaRecorder(stream, { mimeType: 'audio/webm;codecs=opus' });
    chunks.current = [];

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) chunks.current.push(e.data);
    };

    recorder.onstop = () => {
      const blob = new Blob(chunks.current, { type: 'audio/webm;codecs=opus' });
      setAudioBlob(blob);
      stream.getTracks().forEach(t => t.stop());
    };

    mediaRecorder.current = recorder;
    recorder.start();
    setIsRecording(true);
    setAudioBlob(null);
  }, []);

  const stop = useCallback(() => {
    mediaRecorder.current?.stop();
    setIsRecording(false);
  }, []);

  return { start, stop, audioBlob, isRecording };
}
