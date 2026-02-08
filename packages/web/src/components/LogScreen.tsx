import React, { useState } from 'react';
import { Incident } from '../types';
import { updateIncidentStatus, updateIncident, auditSubmit } from '../services/incidents';

interface LogScreenProps {
    logs: Incident[];
    setLogs: (logs: Incident[]) => void;
    isDarkMode: boolean;
    onToggleTheme: () => void;
}

const LogScreen: React.FC<LogScreenProps> = ({ logs, setLogs, isDarkMode, onToggleTheme }) => {
    const [filter, setFilter] = useState('All');
    const [syncingId, setSyncingId] = useState<string | null>(null);
    const [syncError, setSyncError] = useState<string | null>(null);

    const filteredLogs = filter === 'All'
        ? logs
        : logs.filter(log => log.type.toLowerCase().includes(filter.toLowerCase()));

    const handleSync = async (logId: string) => {
        const log = logs.find(l => l.id === logId);
        if (!log) return;

        try {
            setSyncingId(logId);
            setSyncError(null);

            // Submit to Solana via audit endpoint
            const { results } = await auditSubmit([{
                code: log.hexCode || log.id,
                signature: log.signature || '',
                pubkey: log.pubkey || '',
                timestamp: Math.floor(Date.now() / 1000),
                alertType: log.type,
            }]);

            const explorerUrl = results[0]?.explorerUrl || '';

            // Update incident with explorerUrl and synced status
            await updateIncident(logId, { status: 'synced', explorerUrl });
            const updated = { ...log, status: 'synced' as const, explorerUrl };

            // Update local state
            const newLogs = logs.map(l => l.id === logId ? updated : l);
            setLogs(newLogs);
        } catch (err) {
            console.error('Failed to sync incident:', err);
            setSyncError(err instanceof Error ? err.message : 'Sync to chain failed');
        } finally {
            setSyncingId(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-primary text-brand-dark';
            case 'verified': return 'bg-brand-success text-white';
            case 'synced': return 'bg-brand-dark dark:bg-gray-800 text-white';
            default: return 'bg-gray-200 text-gray-500';
        }
    };

    const getAccentColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-primary';
            case 'verified': return 'bg-brand-success';
            case 'synced': return 'bg-gray-400';
            default: return 'bg-gray-200';
        }
    };

    return (
        <div className="flex flex-col min-h-full">
            <header className="sticky top-0 z-50 bg-white dark:bg-brand-bg-dark border-b border-gray-200 dark:border-white/5 shadow-sm transition-colors">
                <div className="flex items-center p-4 justify-between h-16 pt-12 pb-8">
                    <div className="flex items-center gap-4">
                        <div className="flex items-center justify-center w-8 h-8 rounded-full hover:bg-gray-100 dark:hover:bg-white/10 cursor-pointer text-brand-dark dark:text-white">
                            <span className="material-symbols-outlined text-xl">arrow_back_ios_new</span>
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-widest uppercase text-brand-dark dark:text-white">Activity Log</h1>
                            <p className="text-[10px] font-mono text-gray-400 dark:text-white/40 leading-none">NODE_S_ID: 9912-DELTA</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button
                            onClick={onToggleTheme}
                            className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10 hover:bg-gray-200 dark:hover:bg-white/10 transition-colors"
                        >
                            <span className="material-symbols-outlined text-xl text-brand-dark dark:text-white">{isDarkMode ? 'light_mode' : 'dark_mode'}</span>
                        </button>
                        <button className="w-10 h-10 flex items-center justify-center rounded-lg bg-gray-100 dark:bg-black/20 border border-gray-200 dark:border-white/10">
                            <span className="material-symbols-outlined text-xl text-brand-dark dark:text-white">filter_list</span>
                        </button>
                    </div>
                </div>
                <div className="bg-gray-50 dark:bg-black/40 px-4 py-2 flex items-center justify-between border-t border-gray-100 dark:border-white/5">
                    <div className="flex items-center gap-2">
                        <span className="material-symbols-outlined text-sm text-primary">sensors</span>
                        <span className="text-[10px] font-mono font-bold tracking-tight text-brand-dark dark:text-primary">NETWORK: SECURE</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono font-medium tracking-tighter text-gray-400 dark:text-white/40 uppercase">Buffer: 128kb</span>
                        <div className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_#FCBA04]"></div>
                    </div>
                </div>
            </header>

            <main className="flex-1 pb-12">
                <div className="p-4 space-y-4">
                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                            <span className="material-symbols-outlined text-gray-400 text-sm">search</span>
                        </div>
                        <input
                            className="block w-full pl-10 pr-3 py-3.5 border border-gray-200 dark:border-white/5 bg-white dark:bg-brand-card-dark rounded-xl shadow-sm focus:ring-1 focus:ring-primary text-sm placeholder:text-gray-400 dark:placeholder:text-zinc-600 font-medium text-brand-dark dark:text-white"
                            placeholder="Query hash or log ID..."
                            type="text"
                        />
                    </div>

                    <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
                        {['All', 'Medical', 'Evacuation', 'Supply'].map(cat => (
                            <button
                                key={cat}
                                onClick={() => setFilter(cat)}
                                className={`flex-shrink-0 px-5 py-2 text-[11px] font-bold rounded-lg uppercase tracking-wider transition-all ${filter === cat ? 'bg-brand-dark text-white shadow-md' : 'bg-white dark:bg-brand-card-dark text-gray-500 dark:text-gray-400 border border-gray-200 dark:border-white/5 shadow-sm'}`}
                            >
                                {cat}
                            </button>
                        ))}
                    </div>
                </div>

                {syncError && (
                    <div className="px-4">
                        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl p-4 flex items-center gap-3">
                            <span className="material-symbols-outlined text-red-500">error</span>
                            <p className="text-sm text-red-700 dark:text-red-300 font-medium flex-1">{syncError}</p>
                            <button onClick={() => setSyncError(null)} className="text-red-400 hover:text-red-600">
                                <span className="material-symbols-outlined text-sm">close</span>
                            </button>
                        </div>
                    </div>
                )}

                <div className="px-4 space-y-5">
                    {filteredLogs.map(log => (
                        <div key={log.id} className="bg-white dark:bg-brand-card-dark rounded-2xl shadow-sm overflow-hidden border border-gray-100 dark:border-white/5 relative transition-colors">
                            <div className={`absolute top-0 left-0 w-1.5 h-full ${getAccentColor(log.status)}`}></div>
                            <div className="p-5">
                                <div className="flex justify-between items-start mb-4">
                                    <div className="flex items-center gap-3">
                                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${log.status === 'pending' ? 'bg-primary/10' : log.status === 'verified' ? 'bg-brand-success/10' : 'bg-gray-100 dark:bg-gray-800'}`}>
                                            <span className={`material-symbols-outlined font-bold ${log.status === 'pending' ? 'text-primary' : log.status === 'verified' ? 'text-brand-success' : 'text-gray-500'}`}>
                                                {log.type.includes('MEDICAL') ? 'emergency' : log.type.includes('EVAC') ? 'navigation' : 'inventory_2'}
                                            </span>
                                        </div>
                                        <div>
                                            <h3 className="text-[13px] font-bold text-brand-dark dark:text-white leading-tight uppercase tracking-tight">{log.type}</h3>
                                            <p className="font-mono text-[9px] text-gray-400 tracking-wider">TRK_ID: {log.id}</p>
                                        </div>
                                    </div>
                                    <div className={`px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest shadow-sm ${getStatusColor(log.status)}`}>
                                        {log.status}
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <p className="text-[13px] text-gray-600 dark:text-gray-400 leading-relaxed font-medium">
                                        {log.description}
                                    </p>

                                    <div className="flex items-center justify-between pt-4 border-t border-gray-50 dark:border-white/5">
                                        <div className="flex items-center gap-4">
                                            <div className="flex flex-col">
                                                <span className="text-[8px] uppercase text-gray-400 font-bold tracking-wider">Timestamp</span>
                                                <span className="font-mono text-[10px] text-brand-dark dark:text-white/80">{log.timestamp}</span>
                                            </div>
                                            <div className="flex flex-col">
                                                <span className="text-[8px] uppercase text-gray-400 font-bold tracking-wider">Validation</span>
                                                <span className={`font-mono text-[10px] truncate max-w-[80px] ${log.status === 'verified' ? 'text-brand-success font-bold' : 'text-brand-dark dark:text-white/80'}`}>{log.signer}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {log.status === 'pending' && (
                                        <button
                                            onClick={() => handleSync(log.id)}
                                            disabled={syncingId === log.id}
                                            className="w-full mt-2 py-3.5 bg-brand-dark dark:bg-white dark:text-brand-dark hover:brightness-110 text-white rounded-xl shadow-lg flex items-center justify-between px-5 group active:scale-[0.98] transition-transform disabled:opacity-50 disabled:cursor-not-allowed"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-lg text-primary">
                                                    {syncingId === log.id ? 'progress_activity' : 'database_upload'}
                                                </span>
                                                <span className="font-mono text-[11px] font-bold tracking-widest uppercase">
                                                    {syncingId === log.id ? 'Syncing...' : 'Sync to Chain'}
                                                </span>
                                            </div>
                                            <span className="font-mono text-[10px] opacity-60">0.02kb</span>
                                        </button>
                                    )}
                                    {log.status === 'verified' && (
                                        <button className="w-full mt-2 py-3 bg-gray-50 dark:bg-black/20 border border-gray-200 dark:border-white/5 text-gray-400 rounded-xl flex items-center justify-between px-5 cursor-not-allowed">
                                            <div className="flex items-center gap-3 opacity-60">
                                                <span className="material-symbols-outlined text-lg">database_upload</span>
                                                <span className="font-mono text-[11px] font-bold tracking-widest uppercase">Queue for Sync</span>
                                            </div>
                                            <span className="material-symbols-outlined text-gray-300 dark:text-zinc-700">lock</span>
                                        </button>
                                    )}
                                    {log.status === 'synced' && log.explorerUrl && (
                                        <a
                                            href={log.explorerUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="w-full mt-2 py-3 bg-brand-success/10 border border-brand-success/30 text-brand-success rounded-xl flex items-center justify-between px-5 hover:bg-brand-success/20 transition-colors"
                                        >
                                            <div className="flex items-center gap-3">
                                                <span className="material-symbols-outlined text-lg">open_in_new</span>
                                                <span className="font-mono text-[11px] font-bold tracking-widest uppercase">View on Solana</span>
                                            </div>
                                            <span className="font-mono text-[9px] opacity-60">Explorer</span>
                                        </a>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </main>
        </div>
    );
};

export default LogScreen;
