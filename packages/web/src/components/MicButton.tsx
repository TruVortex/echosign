import React from 'react';

interface Props {
  isRecording: boolean;
  onClick: () => void;
}

export function MicButton({ isRecording, onClick }: Props) {
  return (
    <button
      onClick={onClick}
      className={`
        w-16 h-16 rounded-full flex items-center justify-center text-2xl
        transition-all duration-200
        ${isRecording
          ? 'bg-emergency-red animate-pulse-ring'
          : 'bg-dark-700 hover:bg-dark-800 border border-gray-600'
        }
      `}
      aria-label={isRecording ? 'Stop recording' : 'Start recording'}
    >
      {isRecording ? '\u23F9' : '\u{1F3A4}'}
    </button>
  );
}
