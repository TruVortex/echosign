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
  const [decoded, setDecoded] = useState<{ text: string; severity: number; crcValid?: boolean; hex?: string; type?: string } | null>(null);
  const [verifyStatus, setVerifyStatus] = useState<'verified' | 'unverified' | 'failed' | null>(null);
  const [loading, setLoading] = useState('');
  const [error, setError] = useState('');
  const [hexInput, setHexInput] = useState('');
  const [mode, setMode] = useState<'acoustic' | 'hex'>('acoustic');
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUrl, setAuditUrl] = useState('');
  const [auditError, setAuditError] = useState('');

  const decodeHex = async (hex: string, skipCrc = false) => {
    setLoading('Decoding...');
    setError('');
    setDecoded(null);
    setAuditUrl('');
    setAuditError('');
    try {
      const decResult = await api.decode(hex, undefined, skipCrc);
      setDecoded({
        text: decResult.text,
        severity: decResult.fields.severity,
        crcValid: decResult.crcValid,
        hex,
        type: decResult.fields.type,
      });
      setVerifyStatus(decResult.crcValid ? 'verified' : 'unverified');
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

    setVerifyStatus(null);

    const codeHex = Array.from(result.data.slice(0, 24))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Acoustic decode: skip CRC since a few nibble errors are expected
    await decodeHex(codeHex, true);
  };

  const handleHexDecode = () => {
    const cleaned = hexInput.replace(/\s/g, '').toLowerCase();
    if (cleaned.length < 2 || !/^[0-9a-f]+$/.test(cleaned)) {
      setError('Invalid hex string');
      return;
    }
    // Hex paste: enforce CRC (data should be exact)
    decodeHex(cleaned, false);
  };

  const handleAuditSync = async () => {
    if (!decoded?.hex) return;
    setAuditLoading(true);
    setAuditError('');
    setAuditUrl('');
    try {
      const result = await api.auditSubmit([{
        code: decoded.hex,
        signature: '',
        pubkey: '',
        timestamp: Date.now(),
        alertType: decoded.type || 'unknown',
        confidence: listener.result?.confidence ?? 1.0,
      }]);
      if (result.results.length > 0) {
        setAuditUrl(result.results[0].explorerUrl);
      }
    } catch (err) {
      setAuditError(String(err));
    }
    setAuditLoading(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Decode Incoming Signal</h2>

      {/* Mode toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setMode('acoustic')}
          className={`px-4 py-1.5 rounded-button text-sm font-medium transition-colors duration-200 active:animate-button-press ${
            mode === 'acoustic' ? 'bg-primary text-white' : 'bg-brand-card-dark text-gray-400 hover:text-white'
          }`}
        >
          Acoustic
        </button>
        <button
          onClick={() => setMode('hex')}
          className={`px-4 py-1.5 rounded-button text-sm font-medium transition-colors duration-200 active:animate-button-press ${
            mode === 'hex' ? 'bg-primary text-white' : 'bg-brand-card-dark text-gray-400 hover:text-white'
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
                className="px-6 py-2 bg-success text-white font-bold rounded-button hover:bg-success-dark active:animate-button-press"
              >
                Start Listening
              </button>
            ) : (
              <button
                onClick={handleStop}
                className="px-6 py-2 bg-transmit text-white font-bold rounded-button hover:bg-transmit-dark active:animate-button-press"
              >
                Stop & Decode
              </button>
            )}
            {listener.isListening && (
              <span className="text-sm text-success animate-pulse">Listening for FSK signal...</span>
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
              {decoded && decoded.crcValid === false && (
                <div className="text-xs text-warning">
                  CRC mismatch — some fields may be approximate due to acoustic noise
                </div>
              )}
              {decoded && decoded.crcValid === true && (
                <div className="text-xs text-success">
                  CRC verified — perfect acoustic decode
                </div>
              )}
              {listener.result.errorPositions.length > 0 && (
                <div className="text-xs text-gray-500">
                  Low-confidence bytes: {listener.result.errorPositions.join(', ')}
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
            className="w-full h-16 bg-brand-card-dark border border-brand-border rounded-input p-3 text-sm font-mono resize-none focus:outline-none focus:border-primary"
          />
          <button
            onClick={handleHexDecode}
            disabled={!!loading || !hexInput.trim()}
            className="px-6 py-2 bg-primary text-white font-bold rounded-button hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed active:animate-button-press"
          >
            {loading || 'Decode Hex'}
          </button>
        </div>
      )}

      {loading && <div className="text-warning text-sm">{loading}</div>}
      {error && <div className="text-error text-sm">{error}</div>}

      {decoded && (
        <>
          <AlertDisplay text={decoded.text} severity={decoded.severity} />

          {/* Sync to Blockchain */}
          <button
            onClick={handleAuditSync}
            disabled={auditLoading}
            className="px-6 py-2 bg-primary text-white font-bold rounded-button hover:bg-primary-dark disabled:opacity-50 active:animate-button-press"
          >
            {auditLoading ? 'Syncing to Solana...' : 'Sync to Blockchain'}
          </button>

          {auditError && <div className="text-error text-sm">{auditError}</div>}

          {auditUrl && (
            <div className="text-sm">
              <span className="text-gray-400">On-chain: </span>
              <a
                href={auditUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary underline break-all"
              >
                {auditUrl}
              </a>
            </div>
          )}
        </>
      )}

      {player.isPlaying && (
        <div className="text-sm text-gray-400 animate-pulse">Playing alert audio...</div>
      )}
    </div>
  );
}
