import React from 'react';

interface Props {
  text: string;
  severity?: number;
}

function severityColor(severity: number): string {
  if (severity >= 7) return 'border-red-600 bg-red-950';
  if (severity >= 4) return 'border-amber-500 bg-yellow-950';
  return 'border-green-600 bg-green-950';
}

export function AlertDisplay({ text, severity = 5 }: Props) {
  return (
    <div className={`border-2 rounded-lg p-4 font-mono text-sm whitespace-pre-wrap ${severityColor(severity)}`}>
      {text}
    </div>
  );
}
