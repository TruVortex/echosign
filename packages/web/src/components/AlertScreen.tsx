import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Incident, Screen } from '../types';
import { updateIncidentStatus, decodeHex, createIncident, classifyIncident } from '../services/incidents';
import { useAcousticListen } from '../hooks/useAcousticListen';

interface AlertScreenProps {
    isDarkMode: boolean;
    onToggleTheme: () => void;
    incidents: Incident[];
    onIncidentUpdate: (updated: Incident) => void;
    setCurrentScreen: (screen: Screen) => void;
}

function toHexString(bytes: Uint8Array): string {
    return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

const AlertScreen: React.FC<AlertScreenProps> = ({ isDarkMode, onToggleTheme, incidents, onIncidentUpdate, setCurrentScreen }) => {
    const [isAcknowledging, setIsAcknowledging] = useState(false);
    const [isDecoding, setIsDecoding] = useState(false);
    const [isDecodingHex, setIsDecodingHex] = useState(false);
    const [decodeStatus, setDecodeStatus] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const { startListening, stopAndDecode, isListening, analyserRef } = useAcousticListen();
    const canvasRef = useRef<HTMLCanvasElement | null>(null);
    const animFrameRef = useRef<number>(0);
    const spectrogramDataRef = useRef<Uint8Array[]>([]);
    const [hexInput, setHexInput] = useState('');
    const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

    // Show the most recent non-dismissed incident
    const latestIncident = incidents.find(i => !dismissedIds.has(i.id)) || null;
    const pendingCount = incidents.filter(i => i.status === 'pending' && !dismissedIds.has(i.id)).length;

    // Real-time spectrogram renderer using AnalyserNode frequency data
    const drawSpectrogram = useCallback(() => {
        const canvas = canvasRef.current;
        const analyser = analyserRef.current;
        if (!canvas || !analyser) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        // Use CSS dimensions (ctx is already scaled by devicePixelRatio)
        const rect = canvas.getBoundingClientRect();
        const width = rect.width;
        const height = rect.height;

        // Get frequency data (0-255 per bin)
        const bufferLength = analyser.frequencyBinCount; // 1024 bins
        const dataArray = new Uint8Array(bufferLength);
        analyser.getByteFrequencyData(dataArray);

        // We only care about 0-8kHz range (FSK tones are 1-4.5kHz)
        // With 44100 sample rate and 1024 bins, each bin ≈ 21.5Hz
        // 8kHz / 21.5 ≈ 372 bins
        const maxBin = Math.min(372, bufferLength);

        // Store column for scrolling waterfall
        const column = dataArray.slice(0, maxBin);
        spectrogramDataRef.current.push(new Uint8Array(column));

        // Keep only enough columns to fill the canvas
        const maxColumns = Math.ceil(width / 2);
        if (spectrogramDataRef.current.length > maxColumns) {
            spectrogramDataRef.current = spectrogramDataRef.current.slice(-maxColumns);
        }

        // Clear canvas
        ctx.fillStyle = '#0a0a08';
        ctx.fillRect(0, 0, width, height);

        const columns = spectrogramDataRef.current;
        const colWidth = 2;
        const startX = width - columns.length * colWidth;

        // Draw waterfall: each column is a vertical slice of frequency data
        for (let col = 0; col < columns.length; col++) {
            const freqData = columns[col];
            const x = startX + col * colWidth;

            for (let bin = 0; bin < maxBin; bin++) {
                const value = freqData[bin];
                if (value < 8) continue; // Skip silence for performance

                // Map bin to Y (low freq at bottom, high at top)
                const y = height - (bin / maxBin) * height;
                const binHeight = Math.max(1, height / maxBin);

                // Color: dark blue → cyan → green → yellow → red (heat map)
                const norm = value / 255;
                const r = norm > 0.6 ? Math.floor(255 * ((norm - 0.6) / 0.4)) : 0;
                const g = norm > 0.3 ? Math.floor(255 * Math.min(1, (norm - 0.3) / 0.4)) : 0;
                const b = norm < 0.5 ? Math.floor(200 * (norm / 0.5)) : Math.floor(200 * (1 - (norm - 0.5) / 0.5));
                const a = Math.max(0.3, norm);

                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a})`;
                ctx.fillRect(x, y - binHeight, colWidth, binHeight);
            }
        }

        // Draw horizontal frequency guides
        ctx.strokeStyle = 'rgba(255,255,255,0.06)';
        ctx.lineWidth = 1;
        const freqLabels = [1000, 2000, 4000, 8000]; // Hz
        const binPerHz = maxBin / 8000;
        for (const freq of freqLabels) {
            const y = height - (freq * binPerHz / maxBin) * height;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }

        // Draw scanning line at right edge
        const gradient = ctx.createLinearGradient(width - 8, 0, width, 0);
        gradient.addColorStop(0, 'rgba(252, 186, 4, 0)');
        gradient.addColorStop(1, 'rgba(252, 186, 4, 0.4)');
        ctx.fillStyle = gradient;
        ctx.fillRect(width - 4, 0, 4, height);

        animFrameRef.current = requestAnimationFrame(drawSpectrogram);
    }, [analyserRef]);

    // Start/stop the spectrogram animation when listening state changes
    useEffect(() => {
        if (isListening) {
            spectrogramDataRef.current = [];
            animFrameRef.current = requestAnimationFrame(drawSpectrogram);
        } else {
            cancelAnimationFrame(animFrameRef.current);
        }
        return () => cancelAnimationFrame(animFrameRef.current);
    }, [isListening, drawSpectrogram]);

    // Resize canvas to match container
    const handleCanvasResize = useCallback((canvas: HTMLCanvasElement | null) => {
        if (!canvas) return;
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width * window.devicePixelRatio;
        canvas.height = rect.height * window.devicePixelRatio;
        const ctx = canvas.getContext('2d');
        if (ctx) ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        canvasRef.current = canvas;
    }, []);

    const handleIgnore = () => {
        if (!latestIncident) return;
        setDismissedIds(prev => new Set(prev).add(latestIncident.id));
    };

    const handleAcknowledge = async () => {
        if (!latestIncident) return;
        try {
            setIsAcknowledging(true);
            setError(null);
            const updated = await updateIncidentStatus(latestIncident.id, 'verified');
            onIncidentUpdate(updated);
        } catch (err) {
            console.error('Failed to acknowledge:', err);
            setError(err instanceof Error ? err.message : 'Failed to acknowledge');
        } finally {
            setIsAcknowledging(false);
        }
    };

    const handleDecodeHex = async () => {
        const cleanedHex = hexInput.replace(/\s/g, '').toLowerCase();
        if (cleanedHex.length !== 48 || !/^[0-9a-f]+$/.test(cleanedHex)) {
            setError('Invalid hex string. Must be 48 hexadecimal characters.');
            return;
        }

        setIsDecodingHex(true);
        setDecodeStatus('Decoding hex to text...');
        setError(null);

        try {
            const result = await decodeHex(cleanedHex, null, false); // Assume exact match for manual input
            setDecodeStatus('Creating incident from decoded data...');

            // Classify the decoded text
            const classification = await classifyIncident(result.text);

            const incident: Incident = {
                id: cleanedHex, // Use hex as ID
                type: classification.type,
                code: classification.code,
                priority: classification.priority,
                match: classification.confidence,
                timestamp: new Date().toLocaleTimeString() + ' UTC',
                signer: 'MANUAL', // Indicate manual input
                status: 'pending',
                description: result.text,
                hexCode: cleanedHex,
            };

            const created = await createIncident(incident);
            onIncidentUpdate(created);
            setDecodeStatus(`Decoded: "${result.text.slice(0, 60)}..."`);
        } catch (err) {
            console.error('Hex decode failed:', err);
            setError(err instanceof Error ? err.message : 'Hex decode failed');
            setDecodeStatus(null);
        } finally {
            setIsDecodingHex(false);
        }
    };

    const handleDecodeAudio = async () => {
        if (isListening) {
            // Stop listening and decode
            setIsDecoding(true);
            setDecodeStatus('Decoding FSK signal...');
            setError(null);
            try {
                const decoded = stopAndDecode();
                if (!decoded || decoded.data.length === 0) {
                    setError('No signal detected. Try again.');
                    setIsDecoding(false);
                    setDecodeStatus(null);
                    return;
                }

                const hexStr = toHexString(decoded.data);
                setDecodeStatus('Decoding hex to text...');

                // Decode the hex through the server
                const result = await decodeHex(hexStr, null, decoded.errorPositions.length > 0);
                setDecodeStatus('Creating incident from decoded data...');

                // Classify the decoded text
                const classification = await classifyIncident(result.text);

                // Create an incident from the decoded data
                const incident: Incident = {
                    id: hexStr,
                    type: classification.type,
                    code: classification.code,
                    priority: classification.priority,
                    match: classification.confidence,
                    timestamp: new Date().toLocaleTimeString() + ' UTC',
                    signer: 'ACOUSTIC',
                    status: 'pending',
                    description: result.text,
                    hexCode: hexStr,
                };

                const created = await createIncident(incident);
                onIncidentUpdate(created);
                setDecodeStatus(`Decoded: "${result.text.slice(0, 60)}..."`);
            } catch (err) {
                console.error('Decode failed:', err);
                setError(err instanceof Error ? err.message : 'Decode failed');
                setDecodeStatus(null);
            } finally {
                setIsDecoding(false);
            }
        } else {
            // Start listening
            try {
                setError(null);
                setDecodeStatus('Listening for FSK signal...');
                await startListening();
            } catch (err) {
                console.error('Failed to start listening:', err);
                setError(err instanceof Error ? err.message : 'Microphone access denied');
                setDecodeStatus(null);
            }
        }
    };

    return (
        <div className="flex flex-col min-h-full">
            <header className="flex items-center p-4 pt-12 pb-4 justify-between bg-white/95 dark:bg-brand-bg-dark/95 backdrop-blur-md border-b border-gray-200 dark:border-brand-border sticky top-0 z-50 transition-colors">
                <div className="w-10" />
                <div className="flex flex-col items-center">
                    <span className="text-[10px] font-mono text-primary uppercase tracking-[0.3em] font-bold">Inbound Comms</span>
                    <h2 className="text-brand-dark dark:text-white tactical-font text-lg font-bold leading-none tracking-wider uppercase">Alert Channel</h2>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={onToggleTheme}
                        className="w-10 h-10 flex items-center justify-center rounded-xl transition-all
                                bg-white dark:bg-slate-800 
                                border border-slate-200 dark:border-slate-700
                                shadow-sm dark:shadow-[inset_0_1px_2px_rgba(255,255,255,0.1)]
                                hover:bg-slate-100 dark:hover:bg-slate-700/80
                                z-10"
                    >
                        <span className="material-symbols-outlined text-xl text-brand-dark dark:text-white">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                    </button>
                    <div className="flex w-6 items-center justify-end mr-1">
                        <span className="relative flex h-3 w-3">
                            {pendingCount > 0 && (
                                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                            )}
                            <span className={`relative inline-flex rounded-full h-3 w-3 ${pendingCount > 0 ? 'bg-primary' : 'bg-gray-400'}`}></span>
                        </span>
                    </div>
                </div>
            </header>

            <main className="flex-1 px-4 py-6 space-y-6">
                {/* Alert Card */}
                <section className="rounded-functional bg-white dark:bg-[#0f172a] border border-slate-200 dark:border-white/5 shadow-sm overflow-hidden transition-colors">
                    {/* Image/Map Container */}
                    <div className="w-full aspect-[21/2.2] bg-center bg-cover relative">
                        
                        {/* Badges */}
                        <div className="absolute top-3 left-3 flex gap-1.5">
                            {latestIncident ? (
                                <>
                                    <div className={`text-brand-dark tactical-font text-[10px] font-bold px-2.5 py-1 rounded-tactical flex items-center gap-2 shadow-xl border border-white/20 ${latestIncident.priority === 'HIGH' || latestIncident.priority === 'CRITICAL' ? 'bg-red-500 text-white' : 'bg-emerald-500 text-white'}`}>
                                        <span className="material-symbols-outlined text-[14px] font-bold">
                                            {latestIncident.priority === 'HIGH' || latestIncident.priority === 'CRITICAL' ? 'warning' : 'info'}
                                        </span>
                                        <span className="tracking-widest uppercase">{latestIncident.priority}</span>
                                    </div>
                                    <div className={`text-white tactical-font text-[9px] font-bold px-2.5 py-1 rounded-tactical flex items-center gap-2 border border-white/10 backdrop-blur-md shadow-sm ${latestIncident.status === 'verified' ? 'bg-blue-600' : 'bg-slate-600/80'}`}>
                                        <span className="material-symbols-outlined text-[12px] font-bold">
                                            {latestIncident.status === 'verified' ? 'verified_user' : 'schedule'}
                                        </span>
                                        <span className="tracking-widest uppercase">{latestIncident.status}</span>
                                    </div>
                                </>
                            ) : (
                                <div className="bg-slate-500 text-white tactical-font text-[10px] font-bold px-3 py-1.5 rounded-tactical flex items-center gap-2">
                                    <span className="material-symbols-outlined text-[16px]">inbox</span>
                                    <span className="tracking-widest">IDLE</span>
                                </div>
                            )}
                        </div>
                    </div>

                    {/* Content Area - Tightened padding and spacing */}
                    <div className="px-5 pb-5 pt-1 space-y-3">
                        <header>
                            <div className="flex items-center gap-2 mb-1">
                                <div className="h-[1px] flex-1 bg-blue-500/20"></div>
                                <span className="font-mono text-blue-600 dark:text-blue-400 text-[9px] font-bold uppercase tracking-[0.3em]">
                                    {latestIncident ? `CODE: ${latestIncident.code}` : 'STANDBY'}
                                </span>
                                <div className="h-[1px] flex-1 bg-blue-500/20"></div>
                            </div>
                            <h1 className="text-slate-900 dark:text-white tactical-font text-xl font-black leading-tight uppercase text-center tracking-tight italic">
                                {latestIncident ? latestIncident.type : 'Signal Lost'}
                            </h1>
                        </header>

                        {latestIncident && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-0.5">
                                            <span className="material-symbols-outlined text-[16px]">schedule</span>
                                            <span className="text-[8px] font-bold uppercase tracking-wider">Time</span>
                                        </div>
                                        <p className="font-mono text-sm pt-1 font-bold text-slate-700 dark:text-slate-200">{latestIncident.timestamp}</p>
                                    </div>
                                    <div className="bg-slate-50 dark:bg-slate-800/40 p-2.5 rounded-xl border border-slate-200 dark:border-white/5 transition-colors">
                                        <div className="flex items-center gap-1.5 text-slate-400 dark:text-slate-500 mb-0.5">
                                            <span className="material-symbols-outlined text-[16px]">analytics</span>
                                            <span className="text-[8px] font-bold uppercase tracking-wider">Confidence</span>
                                        </div>
                                        <p className="font-mono text-lg font-black text-blue-600 dark:text-blue-400">
                                            {latestIncident.match}<span className="text-[10px] opacity-50">%</span>
                                        </p>
                                    </div>
                                </div>

                                <div className="bg-slate-50/50 dark:bg-white/5 p-3 rounded-xl border border-slate-200 dark:border-white/10">
                                    <p className="text-slate-700 dark:text-slate-300 tactical-font text-xs font-semibold leading-relaxed uppercase">
                                        {latestIncident.description}
                                    </p>
                                    <div className="mt-2 pt-2 border-t border-slate-200 dark:border-white/5 flex justify-between items-center">
                                        <p className="text-slate-400 dark:text-slate-500 font-mono text-[9px]">AUTH: {latestIncident.signer}</p>
                                        <span className="text-[9px] font-bold text-blue-500 animate-pulse">● LIVE</span>
                                    </div>
                                </div>
                            </>
                        )}

                        {!latestIncident && (
                            <div className="text-center py-6">
                                <span className="material-symbols-outlined text-3xl text-slate-300 dark:text-slate-700 mb-1">radar</span>
                                <p className="text-slate-400 dark:text-slate-600 text-[11px] font-bold uppercase tracking-widest">Scanning Frequencies...</p>
                            </div>
                        )}
                    </div>
                </section>

                {/* Manual Hex Input Section */}
                <section className="space-y-3">
                    <h3 className="text-primary tactical-font text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                        <span className="material-symbols-outlined text-[18px] font-bold">keyboard</span> Manual Hex Input
                    </h3>
                    <div className="rounded-functional bg-white dark:bg-brand-card-dark border border-gray-200 dark:border-brand-border overflow-hidden transition-colors">
                        <div className="p-5">
                            <textarea
                                value={hexInput}
                                onChange={(e) => setHexInput(e.target.value)}
                                placeholder="Enter 48-character hex code (e.g., 010203...)"
                                className="w-full h-24 bg-gray-50 dark:bg-brand-card-dark border border-gray-200 dark:border-brand-border rounded-tactical p-3 text-sm font-mono text-brand-dark dark:text-white placeholder-gray-400 dark:placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors mb-4"
                            />
                            <button
                                onClick={handleDecodeHex}
                                disabled={isDecodingHex || !hexInput.trim()}
                                className="w-full flex items-center justify-center rounded-functional h-14 gap-3 tactical-font font-bold text-lg tracking-widest shadow-lg hover:brightness-110 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed bg-primary text-brand-dark"
                            >
                                {isDecodingHex ? 'DECODING HEX...' : 'DECODE HEX'}
                            </button>
                        </div>
                    </div>
                </section>

                {/* Audio Decode Section */}
                <section className="space-y-3">
                    <div className="flex items-center justify-between">
                        <h3 className="text-primary tactical-font text-xs font-bold uppercase tracking-[0.2em] flex items-center gap-2">
                            <span className="material-symbols-outlined text-[18px] font-bold">analytics</span> Audio Analysis
                        </h3>
                        {isListening && (
                            <span className="font-mono text-[9px] text-brand-success font-bold animate-pulse">LIVE SIGNAL</span>
                        )}
                    </div>

                    <div className="rounded-functional bg-white dark:bg-brand-card-dark border border-gray-200 dark:border-brand-border overflow-hidden transition-colors">
                        <div className="h-40 w-full relative bg-[#0a0a08]" style={{ '--spec-bg': '#0a0a08' } as React.CSSProperties}>
                            {/* Real-time spectrogram canvas */}
                            <canvas
                                ref={handleCanvasResize}
                                className="absolute inset-0 w-full h-full"
                            />

                            {/* Frequency axis labels */}
                            <div className="absolute left-2 top-0 h-full py-2 flex flex-col justify-between font-mono text-[8px] text-white/40 z-10 pointer-events-none">
                                <span>8kHz</span>
                                <span>4kHz</span>
                                <span>2kHz</span>
                                <span>0Hz</span>
                            </div>

                            {/* Idle overlay when not listening */}
                            {!isListening && (
                                <div className="absolute inset-0 flex items-center justify-center bg-gray-100/90 dark:bg-black/60">
                                    <div className="flex flex-col items-center gap-2">
                                        <span className="material-symbols-outlined text-3xl text-gray-400 dark:text-gray-600">graphic_eq</span>
                                        <span className="font-mono text-[10px] text-gray-400 dark:text-gray-600 uppercase tracking-widest">Awaiting Signal</span>
                                    </div>
                                </div>
                            )}

                            {/* Status badge */}
                            <div className="absolute bottom-2 right-3 z-10">
                                <span className={`font-mono text-[8px] uppercase tracking-widest px-2 py-0.5 rounded border ${
                                    isListening
                                        ? 'text-brand-success bg-brand-success/10 border-brand-success/30 shadow-[0_0_8px_rgba(34,197,94,0.2)]'
                                        : 'text-gray-500 bg-gray-100 dark:bg-black/40 border-gray-200 dark:border-white/5'
                                }`}>
                                    {isListening ? 'RX: Live' : 'RX: Idle'}
                                </span>
                            </div>
                        </div>
                        <div className="p-5 border-t border-gray-100 dark:border-white/5">
                            {decodeStatus && (
                                <div className="mb-4 bg-gray-50 dark:bg-black/20 rounded-tactical p-3 border border-gray-200 dark:border-white/5">
                                    <p className="text-xs font-mono text-brand-dark dark:text-white/80">{decodeStatus}</p>
                                </div>
                            )}
                            {error && (
                                <div className="mb-4 bg-red-50 dark:bg-red-900/20 rounded-tactical p-3 border border-red-200 dark:border-red-800">
                                    <p className="text-xs font-mono text-red-600 dark:text-red-400">{error}</p>
                                </div>
                            )}
                            <button
                                onClick={handleDecodeAudio}
                                disabled={isDecoding}
                                className={`w-full flex items-center justify-center py-2 px-6 gap-2 rounded-tactical font-extrabold text-sm uppercase tracking-wider transition-all duration-150 active:scale-[0.98] shadow-lg disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100
                                    ${
                                        isListening
                                            ? 'bg-red-600 hover:bg-red-700 text-white'
                                            : 'bg-primary hover:bg-primary/90 text-brand-dark'
                                    }
                                `}
                            >
                                <span className="material-symbols-outlined text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>
                                    {isListening ? 'stop_circle' : isDecoding ? 'progress_activity' : 'play_circle'}
                                </span>
                                {isListening ? 'STOP & DECODE' : isDecoding ? 'DECODING...' : 'DECODE AUDIO'}
                            </button>
                        </div>
                    </div>
                </section>
            </main>

            <footer className="bg-white/95 dark:bg-brand-bg-dark px-4 pt-4 pb-10 border-t border-gray-200 dark:border-brand-border flex gap-3 shadow-xl transition-colors">
                <button
                    onClick={handleIgnore}
                    disabled={!latestIncident}
                    className="flex-1 flex items-center justify-center h-14 rounded-functional bg-gray-100 dark:bg-brand-dark/20 text-gray-500 dark:text-gray-400 tactical-font font-bold text-sm tracking-[0.2em] border border-gray-200 dark:border-brand-border active:brightness-90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    DISMISS
                </button>
                <button
                    onClick={handleAcknowledge}
                    disabled={!latestIncident || latestIncident.status !== 'pending' || isAcknowledging}
                    className="flex-[1.5] flex items-center justify-center py-3 px-4 gap-2 rounded-tactical font-extrabold text-sm uppercase tracking-wider shadow-lg transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed bg-slate-900 text-white hover:bg-slate-800 dark:bg-slate-50 dark:text-slate-900 dark:hover:bg-white"
                >
                    <span className="material-symbols-outlined text-[20px] text-primary">task_alt</span>
                    {isAcknowledging ? 'ACKNOWLEDGING...' : latestIncident?.status === 'verified' ? 'ACKNOWLEDGED' : 'ACKNOWLEDGE'}
                </button>
            </footer>
        </div>
    );
};

export default AlertScreen;
