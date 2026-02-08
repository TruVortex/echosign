import React, { useState } from 'react';
import { Spectrogram } from './Spectrogram.js';
import { AlertDisplay } from './AlertDisplay.js';
import { StatusBadge } from './StatusBadge.js';
import { useAcousticListen } from '../hooks/useAcousticListen.js';
import { useAudioPlayer } from '../hooks/useAudioPlayer.js';
import { api } from '../api/client.js';

export function DecodePanel() {
  const listener = useAcousticListen();
  const player = useAudioPlayer();
  const [decoded, setDecoded] = useState<{ text: string; severity: number } | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'unverified' | 'failed' | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [mode, setMode] = useState<'acoustic' | 'hex'>('acoustic');

  const decodeHex = async (hex: string) => {
    setLoading('Decoding...');
    setError('');
    setDecoded(null);
    try {
      const decResult = await api.decode(hex);
      setDecoded({ text: decResult.text, severity: decResult.fields.severity });
      setVerifyStatus('verified');
      try {
        const audio = await api.tts(decResult.text);
        await player.play(audio);
      } catch {
        // TTS is optional
      }
    } catch (err) {
      setError(String(err));
      setVerifyStatus('failed');
    }
    setLoading('');
  };

  const handleStop = async () => {
    const result = listener.stopAndDecode(24);
    if (!result) return;

    setLoading('Decoding...');
    setError('');
    setVerifyStatus(result.confidence > 0.8 ? 'unverified' : 'failed');

    try {
      const codeHex = Array.from(result.data.slice(0, 24))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

      const decResult = await api.decode(codeHex);
      setDecoded({ text: decResult.text, severity: decResult.fields.severity });

      try {
        const audio = await api.tts(decResult.text);
        await player.play(audio);
      } catch {
        // TTS is optional
      }
    } catch (err) {
      setError(String(err));
    }
    setLoading('');
  };

  const handleHexDecode = () => {
    const cleaned = hexInput.replace(/\s/g, '').toLowerCase();
    if (cleaned.length < 2 || !/^[0-9a-f]+$/.test(cleaned)) {
      setError('Invalid hex string');
      return;
    }
    decodeHex(cleaned);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Decode Incoming Signal</h2>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('acoustic')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'acoustic' ? 'bg-neutral-700 text-white' : 'bg-neutral-800 text-gray-500'
          }`}
        >
          Acoustic
        </button>
        <button
          onClick={() => setMode('hex')}
          className={`px-4 py-1.5 rounded text-sm font-medium transition-colors ${
            mode === 'hex' ? 'bg-neutral-700 text-white' : 'bg-neutral-800 text-gray-500'
          }`}
        >
          Paste Hex
        </button>
      </div>

      {mode === 'acoustic' ? (
        <>
          <div className="flex items-center gap-4">
            {!listener.isListening ? (
              <button
                onClick={listener.startListening}
                className="px-6 py-2 bg-green-600 text-white font-bold rounded-lg hover:bg-green-500"
              >
                Start Listening
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-6 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-500"
              >
                Stop & Decode
              </button>
            )}
            {listener.isListening && (
              <span className="text-sm text-green-400 animate-pulse">Listening for FSK signal...</span>
            )}
          </div>

          {/* Live spectrogram */}
          <Spectrogram
            analyser={listener.analyserRef.current}
            isActive={listener.isListening}
          />

          {/* Acoustic decode results */}
          {listener.result && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <span className="text-sm text-gray-400">
                  Confidence: {(listener.result.confidence * 100).toFixed(1)}%
                </span>
                <StatusBadge status={verifyStatus} />
              </div>
              {listener.result.errorPositions.length > 0 && (
                <div className="text-xs text-red-400">
                  Errors at byte positions: {listener.result.errorPositions.join(', ')}
                </div>
              )}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          <p className="text-sm text-gray-400">
            Paste the hex code from the Encode tab to decode directly:
          </p>
          <textarea
            value={hexInput}
            onChange={(e) => setHexInput(e.target.value)}
            placeholder="Paste 48-character hex string..."
            className="w-full h-16 bg-neutral-800 border border-neutral-700 rounded-lg p-3 text-sm font-mono resize-none focus:outline-none focus:border-amber-500"
          />
          <button
            onClick={handleHexDecode}
            disabled={!!loading || !hexInput.trim()}
            className="px-6 py-2 bg-amber-500 text-black font-bold rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading || 'Decode Hex'}
          </button>
        </div>
      )}

      {loading && <div className="text-yellow-400 text-sm">{loading}</div>}
      {error && <div className="text-red-400 text-sm">{error}</div>}

      {decoded && (
        <AlertDisplay text={decoded.text} severity={decoded.severity} />
      )}

      {player.isPlaying && (
        <div className="text-sm text-gray-400 animate-pulse">Playing alert audio...</div>
      )}
    </div>
  );
}
