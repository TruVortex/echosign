import React, { useState, useEffect } from 'react';
import { Incident } from '../types';
import { transcribeAudio, classifyIncident, createIncident, encodeText, auditSubmit, updateIncident } from '../services/incidents';
import { useRecording } from '../hooks/useRecording';
import { useAcousticTransmit } from '../hooks/useAcousticTransmit';

interface ReportScreenProps {
    onIncidentCapture: (incident: Incident) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

const ReportScreen: React.FC<ReportScreenProps> = ({ onIncidentCapture, isDarkMode, onToggleTheme }) => {
    const { isRecording, audioBlob, startRecording, stopRecording, error: recordingError } = useRecording();
    const { transmit, isPlaying, progress } = useAcousticTransmit();
    const [transcription, setTranscription] = useState<string>('');
    const [classification, setClassification] = useState<any>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [textInput, setTextInput] = useState<string>('');
    const [currentIncident, setCurrentIncident] = useState<Incident | null>(null);
    const [isSyncing, setIsSyncing] = useState(false);

    // Process audio when recording stops
    useEffect(() => {
        if (audioBlob && !isRecording) {
            processAudio(audioBlob);
        }
    }, [audioBlob, isRecording]);

    const processAudio = async (blob: Blob) => {
        try {
            setIsAnalyzing(true);
            setError(null);
            setTranscription('Processing audio...');

            // Step 1: Transcribe audio
            const { transcript } = await transcribeAudio(blob);
            setTranscription(transcript);

            if (!transcript || transcript.trim().length === 0) {
                setError('No speech detected. Please try again.');
                setIsAnalyzing(false);
                return;
            }

            // Step 2: Classify incident
            const result = await classifyIncident(transcript);
            setClassification(result);

            // Step 3: Encode text to get hex, signature, pubkey
            let hexCode = '', signature = '', pubkey = '';
            try {
                const encoded = await encodeText(transcript);
                hexCode = encoded.hex;
                signature = encoded.signature;
                pubkey = encoded.pubkey;
            } catch (encodeErr) {
                console.warn('Encode failed, using fallback ID:', encodeErr);
            }

            // Step 4: Create incident with real encode data
            const incident: Incident = {
                id: hexCode || `INC-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                type: result.type,
                code: result.code,
                priority: result.priority,
                match: result.confidence,
                timestamp: new Date().toLocaleTimeString() + ' UTC',
                signer: pubkey ? `0x${pubkey.slice(0, 8).toUpperCase()}` : '0x' + Math.random().toString(16).substr(2, 8).toUpperCase(),
                status: 'pending',
                description: transcript,
                hexCode,
                signature,
                pubkey,
            };

            // Save to backend
            await createIncident(incident);

            // Update parent component
            onIncidentCapture(incident);
            setCurrentIncident(incident);
            setIsAnalyzing(false);
        } catch (err) {
            console.error('Processing error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process audio');
            setIsAnalyzing(false);
        }
    };

    const processText = async () => {
        if (!textInput.trim()) {
            setError('Please enter a message.');
            return;
        }

        try {
            setIsAnalyzing(true);
            setError(null);
            setTranscription(textInput);

            // Step 1: Classify incident (skip transcription for text)
            const result = await classifyIncident(textInput);
            setClassification(result);

            // Step 2: Encode text to get hex, signature, pubkey
            let hexCode = '', signature = '', pubkey = '';
            try {
                const encoded = await encodeText(textInput);
                hexCode = encoded.hex;
                signature = encoded.signature;
                pubkey = encoded.pubkey;
            } catch (encodeErr) {
                console.warn('Encode failed, using fallback ID:', encodeErr);
            }

            // Step 3: Create incident with real encode data
            const incident: Incident = {
                id: hexCode || `INC-${Math.random().toString(36).substr(2, 6).toUpperCase()}`,
                type: result.type,
                code: result.code,
                priority: result.priority,
                match: result.confidence,
                timestamp: new Date().toLocaleTimeString() + ' UTC',
                signer: pubkey ? `0x${pubkey.slice(0, 8).toUpperCase()}` : '0x' + Math.random().toString(16).substr(2, 8).toUpperCase(),
                status: 'pending',
                description: textInput,
                hexCode,
                signature,
                pubkey,
            };

            // Save to backend
            await createIncident(incident);

            // Update parent component
            onIncidentCapture(incident);
            setCurrentIncident(incident);

            // Clear text input
            setTextInput('');
            setIsAnalyzing(false);
        } catch (err) {
            console.error('Processing error:', err);
            setError(err instanceof Error ? err.message : 'Failed to process text');
            setIsAnalyzing(false);
        }
    };

    const handleTransmit = async () => {
        if (!currentIncident?.hexCode) return;
        const bytes = new Uint8Array(
            currentIncident.hexCode.match(/.{2}/g)!.map(h => parseInt(h, 16))
        );
        await transmit(bytes);
    };

    const handleSyncToChain = async () => {
        if (!currentIncident) return;
        try {
            setIsSyncing(true);
            setError(null);
            const { results } = await auditSubmit([{
                code: currentIncident.hexCode || currentIncident.id,
                signature: currentIncident.signature || '',
                pubkey: currentIncident.pubkey || '',
                timestamp: Math.floor(Date.now() / 1000),
                alertType: currentIncident.type,
            }]);
            const explorerUrl = results[0]?.explorerUrl || '';
            await updateIncident(currentIncident.id, { status: 'synced', explorerUrl });
            const updated = { ...currentIncident, status: 'synced' as const, explorerUrl };
            setCurrentIncident(updated);
            onIncidentCapture(updated);
        } catch (err) {
            console.error('Sync failed:', err);
            setError(err instanceof Error ? err.message : 'Failed to sync to Solana');
        } finally {
            setIsSyncing(false);
        }
    };

    const handleMouseDown = async () => {
        setTranscription('');
        setClassification(null);
        setCurrentIncident(null);
        setError(null);
        await startRecording();
    };

    return (
        <div className="flex flex-col min-h-full">
            <header className="bg-brand-dark dark:bg-brand-dark/95 text-white pt-12 pb-6 px-6 rounded-b-[2rem] shadow-2xl transition-colors relative">
                <button
                    onClick={onToggleTheme}
                    className="absolute top-10 right-6 w-10 h-10 flex items-center justify-center rounded-lg bg-white/10 border border-white/20 hover:bg-white/20 transition-colors z-10"
                >
                    <span className="material-symbols-outlined text-xl">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                </button>

                <div className="flex items-center justify-between mb-4 pr-12">
                    <div className="flex flex-col">
                        <div className="flex items-center gap-2 opacity-80 mb-1">
                            <span className="material-symbols-outlined text-xs">location_searching</span>
                            <span className="text-[10px] font-mono tracking-[0.2em] font-bold">GPS SIGNAL: ACTIVE</span>
                        </div>
                        <h1 className="text-2xl font-extrabold tracking-tight tactical-font uppercase">Report Incident</h1>
                    </div>
                </div>
                <div className="grid grid-cols-2 gap-4 py-3 px-4 bg-black/20 rounded-tactical border border-white/10">
                    <div className="flex flex-col">
                        <span className="text-[9px] text-white/50 uppercase font-bold tracking-tighter">Coordinate</span>
                        <span className="text-[11px] font-mono font-medium">34.0522 N, 118.2437 W</span>
                    </div>
                    <div className="flex flex-col text-right">
                        <span className="text-[9px] text-white/50 uppercase font-bold tracking-tighter">Sector</span>
                        <span className="text-[11px] font-mono font-medium">4-ALPHA [COMM-OK]</span>
                    </div>
                </div>
            </header>

            <main className="flex-1 flex flex-col items-center justify-center px-6 py-8">
                <div className="relative group mb-12">
                    {isRecording && (
                        <>
                            <div className="absolute -inset-12 border border-primary/20 rounded-full animate-[ping_2s_linear_infinite]"></div>
                            <div className="absolute -inset-8 border border-primary/40 rounded-full animate-[ping_3s_linear_infinite]"></div>
                        </>
                    )}

                    <button
                        onMouseDown={handleMouseDown}
                        onMouseUp={stopRecording}
                        onTouchStart={handleMouseDown}
                        onTouchEnd={stopRecording}
                        className={`ptt-outer relative w-64 h-64 rounded-full p-3 transition-all duration-150 active:scale-[0.97] ${isRecording ? 'ptt-outer-active' : ''}`}
                    >
                        <div className="ptt-inner w-full h-full rounded-full flex flex-col items-center justify-center relative overflow-hidden bg-brand-card-light dark:bg-brand-card-dark transition-colors">
                            <div className={`absolute inset-0 bg-primary/10 transition-opacity duration-300 ${isRecording ? 'opacity-100' : 'opacity-0'}`}></div>
                            <span className={`material-symbols-outlined text-6xl mb-1 ${isRecording ? 'text-primary' : 'text-gray-700 dark:text-gray-300'}`} style={{ fontVariationSettings: "'FILL' 1, 'wght' 600" }}>mic</span>
                            <div className="flex flex-col items-center">
                                <span className="text-gray-700 dark:text-gray-500 font-extrabold text-xs tracking-[0.15em]">{isRecording ? 'RECORDING' : 'PUSH TO'}</span>
                                <span className="text-gray-700 dark:text-white font-extrabold text-xl tracking-tighter uppercase">{isRecording ? 'RELEASE' : 'REPORT'}</span>
                            </div>
                            <div className="absolute bottom-6 w-12 h-1 bg-gray-300 dark:bg-gray-700 rounded-full"></div>
                        </div>
                    </button>
                </div>

                {/* Text Input Option */}
                <div className="w-full space-y-3 mb-6">
                    <div className="flex items-center gap-3 my-4">
                        <div className="flex-1 h-px bg-gray-300 dark:bg-white/10"></div>
                        <span className="text-xs font-bold text-gray-400 dark:text-white/40 uppercase tracking-widest">Or Type Message</span>
                        <div className="flex-1 h-px bg-gray-300 dark:bg-white/10"></div>
                    </div>

                    <textarea
                        value={textInput}
                        onChange={(e) => setTextInput(e.target.value)}
                        placeholder="Type incident details here (e.g., 'Structure fire at 123 Main Street')..."
                        disabled={isRecording || isAnalyzing}
                        className="w-full h-24 bg-white dark:bg-brand-card-dark border border-gray-300 dark:border-white/10 rounded-tactical p-4 text-brand-dark dark:text-white placeholder-gray-400 dark:placeholder-white/30 resize-none focus:outline-none focus:ring-2 focus:ring-primary/50 focus:border-primary transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    />

                    <button
                        onClick={processText}
                        disabled={!textInput.trim() || isRecording || isAnalyzing}
                        className="w-full py-3 px-6 bg-primary hover:bg-primary/90 text-brand-dark font-extrabold rounded-tactical uppercase tracking-wider text-sm transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed disabled:active:scale-100 shadow-lg"
                    >
                        {isAnalyzing ? 'Processing...' : 'Submit Report'}
                    </button>
                </div>

                {
                    (error || recordingError) && (
                        <div className="w-full bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-tactical p-4 mb-6">
                            <div className="flex items-center gap-2">
                                <span className="material-symbols-outlined text-red-600 dark:text-red-400">error</span>
                                <p className="text-sm text-red-800 dark:text-red-300 font-medium">{error || recordingError}</p>
                            </div>
                        </div>
                    )
                }

                <div className="w-full bg-white dark:bg-brand-card-dark rounded-tactical shadow-sm border border-gray-200 dark:border-white/5 p-5 relative overflow-hidden transition-colors">
                    <div className="scan-line absolute top-0 left-0 opacity-20 bg-primary/40 h-px w-full"></div>
                    <div className="flex items-center justify-between mb-4 border-b border-gray-100 dark:border-white/5 pb-2">
                        <div className="flex items-center gap-2">
                            <span className="material-symbols-outlined text-primary text-sm" style={{ fontVariationSettings: "'FILL' 1" }}>analytics</span>
                            <span className="text-[10px] font-extrabold text-gray-400 dark:text-white/40 uppercase tracking-widest">Signal Stream</span>
                        </div>
                        <span className="text-[10px] font-mono text-gray-400 dark:text-white/40 font-bold uppercase">{isAnalyzing ? 'Analyzing...' : 'Standby'}</span>
                    </div>
                    <div className="min-h-[100px] flex items-center justify-center">
                        <p className="text-lg leading-relaxed text-brand-dark dark:text-white/90 font-medium italic text-center px-4">
                            {isRecording ? (
                                <span className="text-primary animate-pulse italic">Capturing live audio feed...</span>
                            ) : transcription ? (
                                <span>"{transcription}"</span>
                            ) : (
                                <span className="text-gray-300 dark:text-white/10">Press and hold button or type below to report...</span>
                            )}
                        </p>
                    </div>
                </div>

                {
                    currentIncident && (
                        <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-gradient-to-r from-primary/20 to-primary/10 dark:from-primary/10 dark:to-primary/5 border-2 border-primary rounded-tactical p-4 mb-4">
                                <div className="flex items-center gap-2 mb-2">
                                    <span className="material-symbols-outlined text-primary text-lg" style={{ fontVariationSettings: "'FILL' 1" }}>key</span>
                                    <span className="text-[10px] font-extrabold text-brand-dark dark:text-white/60 uppercase tracking-widest">Incident Hexcode</span>
                                </div>
                                <div className="font-mono text-2xl font-bold text-brand-dark dark:text-primary break-all tracking-wider">
                                    {currentIncident.id}
                                </div>
                                <div className="mt-2 text-xs text-brand-dark dark:text-white/50 font-medium">
                                    Signer: <span className="font-mono">{currentIncident.signer}</span>
                                </div>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex gap-3 mb-4">
                                {/* Transmit Acoustic Signal */}
                                {currentIncident.hexCode && (
                                    <button
                                        onClick={handleTransmit}
                                        disabled={isPlaying}
                                        className="flex-1 py-3.5 bg-brand-dark dark:bg-brand-card-dark border border-primary/30 text-white rounded-tactical shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed relative overflow-hidden"
                                    >
                                        {isPlaying && (
                                            <div
                                                className="absolute inset-0 bg-primary/20 transition-all duration-100"
                                                style={{ width: `${progress * 100}%` }}
                                            />
                                        )}
                                        <span className="material-symbols-outlined text-primary text-lg relative z-10" style={{ fontVariationSettings: "'FILL' 1" }}>
                                            {isPlaying ? 'graphic_eq' : 'volume_up'}
                                        </span>
                                        <span className="font-mono text-[11px] font-bold tracking-widest uppercase relative z-10">
                                            {isPlaying ? 'Transmitting...' : 'Transmit Audio'}
                                        </span>
                                    </button>
                                )}

                                {/* Sync to Solana */}
                                {currentIncident.status !== 'synced' && (
                                    <button
                                        onClick={handleSyncToChain}
                                        disabled={isSyncing}
                                        className="flex-1 py-3.5 bg-brand-dark dark:bg-brand-card-dark border border-brand-success/30 text-white rounded-tactical shadow-lg flex items-center justify-center gap-3 active:scale-[0.98] transition-all disabled:opacity-60 disabled:cursor-not-allowed"
                                    >
                                        <span className="material-symbols-outlined text-brand-success text-lg">
                                            {isSyncing ? 'progress_activity' : 'database_upload'}
                                        </span>
                                        <span className="font-mono text-[11px] font-bold tracking-widest uppercase">
                                            {isSyncing ? 'Syncing...' : 'Sync to Chain'}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Explorer Link */}
                            {currentIncident.explorerUrl && (
                                <a
                                    href={currentIncident.explorerUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-3 bg-brand-success/10 border border-brand-success/30 text-brand-success rounded-tactical flex items-center justify-center gap-3 hover:bg-brand-success/20 transition-colors"
                                >
                                    <span className="material-symbols-outlined text-lg">open_in_new</span>
                                    <span className="font-mono text-[11px] font-bold tracking-widest uppercase">View on Solana Explorer</span>
                                </a>
                            )}
                        </div>
                    )
                }

                {
                    classification && (
                        <div className="mt-6 w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
                            <div className="bg-brand-dark dark:bg-brand-card-dark rounded-tactical p-0.5 shadow-xl relative transition-colors">
                                <div className="absolute -top-3 left-6 px-2 bg-primary rounded text-[9px] font-black text-brand-dark uppercase tracking-widest z-10">
                                    Auto-Classification
                                </div>
                                <div className="bg-brand-dark dark:bg-[#1A1512] border border-white/10 rounded-[calc(0.75rem-2px)] p-4 flex items-center justify-between transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="bg-primary/10 border border-primary/30 p-2.5 rounded-lg flex items-center justify-center">
                                            <span className="material-symbols-outlined text-primary text-2xl" style={{ fontVariationSettings: "'FILL' 0, 'wght' 300" }}>emergency_home</span>
                                        </div>
                                        <div>
                                            <div className="flex items-center gap-2 mb-0.5">
                                                <span className="w-1.5 h-1.5 rounded-full bg-brand-success"></span>
                                                <p className="text-[10px] font-mono font-bold text-white/50 uppercase tracking-widest leading-none">Match {classification.confidence}%</p>
                                            </div>
                                            <p className="text-base font-extrabold text-white tracking-tight uppercase">{classification.type}</p>
                                            <p className="text-[11px] font-mono text-primary/80 font-bold mt-1">CODE: {classification.code} // PRIORITY: {classification.priority}</p>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => {
                                            console.log('Editing functionality is not yet implemented.');
                                            alert('Editing classification is not yet implemented.');
                                        }}
                                        className="w-10 h-10 flex items-center justify-center rounded-button bg-white/5 border border-white/10 active:bg-white/20 transition-colors"
                                    >
                                        <span className="material-symbols-outlined text-white/70">edit</span>
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }
            </main >
        </div >
    );
};

export default ReportScreen;
