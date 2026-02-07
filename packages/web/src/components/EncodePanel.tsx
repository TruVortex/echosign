import React, { useState, useEffect } from 'react';
import { MicButton } from './MicButton.js';
import { Spectrogram } from './Spectrogram.js';
import { useRecorder } from '../hooks/useRecorder.js';
import { useAcousticTransmit } from '../hooks/useAcousticTransmit.js';
import { api, type EncodeResult } from '../api/client.js';

export function EncodePanel() {
  const recorder = useRecorder();
  const acoustic = useAcousticTransmit();
  const [transcript, setTranscript] = useState('');
  const [encoded, setEncoded] = useState<EncodeResult | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [textInput, setTextInput] = useState('');

  // When recording stops, send audio to STT
  useEffect(() => {
    if (recorder.audioBlob && !recorder.isRecording) {
      setLoading('Transcribing...');
      setError('');
      api.stt(recorder.audioBlob)
        .then(res => {
          setTranscript(res.transcript);
          setLoading('');
        })
        .catch(err => {
          setError(String(err));
          setLoading('');
        });
    }
  }, [recorder.audioBlob, recorder.isRecording]);

  const handleEncode = async () => {
    const text = transcript || textInput;
    if (!text) return;
    setLoading('Encoding...');
    setError('');
    try {
      const result = await api.encode(text);
      setEncoded(result);
    } catch (err) {
      setError(String(err));
    }
    setLoading('');
  };

  const handleTransmit = async () => {
    if (!encoded) return;
    const bytes = new Uint8Array(encoded.hex.match(/.{2}/g)!.map(h => parseInt(h, 16)));
    await acoustic.transmit(bytes);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Encode Emergency Message</h2>

      {/* Voice input */}
      <div className="flex items-center gap-4">
        <MicButton
          isRecording={recorder.isRecording}
          onClick={recorder.isRecording ? recorder.stop : recorder.start}
        />
        <div className="text-sm text-gray-400">
          {recorder.isRecording ? 'Recording... click to stop' : 'Click to record voice message'}
        </div>
      </div>

      {/* Text input fallback */}
      <div>
        <textarea
          value={transcript || textInput}
          onChange={(e) => { setTextInput(e.target.value); setTranscript(''); }}
          placeholder="Or type your emergency message here..."
          className="w-full h-24 bg-dark-800 border border-dark-700 rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-emergency-amber"
        />
      </div>

      {/* Encode button */}
      <button
        onClick={handleEncode}
        disabled={!!loading || (!transcript && !textInput)}
        className="px-6 py-2 bg-emergency-amber text-black font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading || 'Encode Message'}
      </button>

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* Encoded result */}
      {encoded && (
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Semantic Code (24 bytes):</div>
            <div className="font-mono text-cyan-400 bg-dark-800 p-3 rounded-lg break-all">
              {encoded.hex}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Fields:</div>
            <pre className="text-xs text-gray-300 bg-dark-800 p-3 rounded-lg overflow-auto">
              {JSON.stringify(encoded.fields, null, 2)}
            </pre>
          </div>

          {/* Transmit */}
          <button
            onClick={handleTransmit}
            disabled={acoustic.isPlaying}
            className="px-6 py-2 bg-emergency-red text-white font-bold rounded-lg hover:bg-red-500 disabled:opacity-50"
          >
            {acoustic.isPlaying ? `Transmitting... ${Math.round(acoustic.progress * 100)}%` : 'Sign & Transmit'}
          </button>

          {acoustic.isPlaying && (
            <div className="w-full bg-dark-700 rounded-full h-2">
              <div
                className="bg-emergency-red h-2 rounded-full transition-all"
                style={{ width: `${acoustic.progress * 100}%` }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
