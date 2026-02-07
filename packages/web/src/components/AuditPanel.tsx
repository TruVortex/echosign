import React, { useState, useEffect } from 'react';
import { api } from '../api/client.js';

interface AuditEntry {
  code: string;
  signature: string;
  pubkey: string;
  timestamp: number;
  alertType: string;
  confidence?: number;
}

export function AuditPanel() {
  const [pendingEntries, setPendingEntries] = useState<AuditEntry[]>([]);
  const [history, setHistory] = useState<{ entries: AuditEntry[]; txSignatures: string[] }>({ entries: [], txSignatures: [] });
  const [syncing, setSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState(0);
  const [error, setError] = useState('');

  // Load pending from localStorage
  useEffect(() => {
    try {
      const data = localStorage.getItem('echosign_audit_queue');
      if (data) setPendingEntries(JSON.parse(data));
    } catch { /* ignore */ }
  }, []);

  const handleSync = async () => {
    if (pendingEntries.length === 0) return;
    setSyncing(true);
    setSyncProgress(0);
    setError('');
    try {
      const result = await api.auditSubmit(pendingEntries);
      localStorage.removeItem('echosign_audit_queue');
      setPendingEntries([]);
      setSyncProgress(1);
      // Refresh history
      handleQuery();
    } catch (err) {
      setError(String(err));
    }
    setSyncing(false);
  };

  const handleQuery = async () => {
    try {
      const result = await api.auditQuery();
      setHistory(result as { entries: AuditEntry[]; txSignatures: string[] });
    } catch (err) {
      setError(String(err));
    }
  };

  useEffect(() => { handleQuery(); }, []);

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold">Solana Audit Log</h2>

      {/* Pending sync */}
      <div className="flex items-center gap-4">
        <span className="text-sm text-gray-400">
          {pendingEntries.length} entries pending
        </span>
        <button
          onClick={handleSync}
          disabled={syncing || pendingEntries.length === 0}
          className="px-4 py-2 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 disabled:opacity-50"
        >
          {syncing ? 'Syncing...' : 'Sync to Solana'}
        </button>
        <button
          onClick={handleQuery}
          className="px-4 py-2 bg-dark-700 text-white rounded-lg hover:bg-dark-800 border border-dark-700"
        >
          Refresh
        </button>
      </div>

      {syncing && (
        <div className="w-full bg-dark-700 rounded-full h-2">
          <div className="bg-purple-500 h-2 rounded-full transition-all" style={{ width: `${syncProgress * 100}%` }} />
        </div>
      )}

      {error && <div className="text-red-400 text-sm">{error}</div>}

      {/* History table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 border-b border-dark-700">
              <th className="py-2 pr-4">Time</th>
              <th className="py-2 pr-4">Type</th>
              <th className="py-2 pr-4">Code</th>
              <th className="py-2">Transaction</th>
            </tr>
          </thead>
          <tbody>
            {history.entries.map((entry, i) => (
              <tr key={i} className="border-b border-dark-800">
                <td className="py-2 pr-4 text-gray-300">
                  {new Date(entry.timestamp * 1000).toLocaleString()}
                </td>
                <td className="py-2 pr-4 font-medium">{entry.alertType}</td>
                <td className="py-2 pr-4 font-mono text-xs text-cyan-400">
                  {entry.code.slice(0, 16)}...
                </td>
                <td className="py-2">
                  <a
                    href={`https://explorer.solana.com/tx/${history.txSignatures[i]}?cluster=devnet`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-400 hover:text-purple-300 underline"
                  >
                    View
                  </a>
                </td>
              </tr>
            ))}
            {history.entries.length === 0 && (
              <tr>
                <td colSpan={4} className="py-8 text-center text-gray-500">
                  No audit entries found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
