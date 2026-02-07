import React from 'react';

interface Props {
  status: 'verified' | 'unverified' | 'failed' | null;
}

export function StatusBadge({ status }: Props) {
  if (!status) return null;

  const styles: Record<string, string> = {
    verified: 'bg-green-900 text-green-300 border-green-500',
    unverified: 'bg-yellow-900 text-yellow-300 border-yellow-500',
    failed: 'bg-red-900 text-red-300 border-red-500',
  };

  const labels: Record<string, string> = {
    verified: 'VERIFIED',
    unverified: 'UNVERIFIED',
    failed: 'FAILED',
  };

  const icons: Record<string, string> = {
    verified: '\u2713',
    unverified: '\u26A0',
    failed: '\u2717',
  };

  return (
    <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full border text-sm font-bold ${styles[status]}`}>
      {icons[status]} {labels[status]}
    </span>
  );
}
