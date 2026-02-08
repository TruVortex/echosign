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
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditUrl, setAuditUrl] = useState('');
  const [auditError, setAuditError] = useState('');

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
    setAuditUrl('');
    setAuditError('');
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

  const handleAuditSync = async () => {
    if (!encoded) return;
    setAuditLoading(true);
    setAuditError('');
    setAuditUrl('');
    try {
      const result = await api.auditSubmit([{
        code: encoded.hex,
        signature: encoded.signature,
        pubkey: encoded.pubkey,
        timestamp: Date.now(),
        alertType: encoded.fields.type,
        confidence: 1.0,
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
          className="w-full h-24 bg-brand-card-dark border border-brand-border rounded-input p-3 text-sm resize-none focus:outline-none focus:border-primary"
        />
      </div>

      {/* Encode button */}
      <button
        onClick={handleEncode}
        disabled={!!loading || (!transcript && !textInput)}
        className="px-6 py-2 bg-primary text-white font-bold rounded-button hover:bg-primary-dark disabled:opacity-50 disabled:cursor-not-allowed active:animate-button-press"
      >
        {loading || 'Encode Message'}
      </button>

      {error && <div className="text-error text-sm">{error}</div>}

      {/* Encoded result */}
      {encoded && (
        <div className="space-y-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Semantic Code (24 bytes):</div>
            <div className="font-mono text-secondary bg-brand-card-dark p-3 rounded-input break-all">
              {encoded.hex}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Fields:</div>
            <pre className="text-xs text-gray-300 bg-brand-card-dark p-3 rounded-input overflow-auto">
              {JSON.stringify(encoded.fields, null, 2)}
            </pre>
          </div>

          {/* Transmit */}
          <button
            onClick={handleTransmit}
            disabled={acoustic.isPlaying}
            className="px-6 py-2 bg-transmit text-white font-bold rounded-button hover:bg-transmit-dark disabled:opacity-50 active:animate-button-press"
          >
            {acoustic.isPlaying ? `Transmitting... ${Math.round(acoustic.progress * 100)}%` : 'Sign & Transmit'}
          </button>

          {acoustic.isPlaying && (
            <div className="w-full bg-brand-border rounded-full h-2">
              <div
                className="bg-transmit h-2 rounded-full transition-all"
                style={{ width: `${acoustic.progress * 100}%` }}
              />
            </div>
          )}

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
        </div>
      )}
    </div>
  );
}
