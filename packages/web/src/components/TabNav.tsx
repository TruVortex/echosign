import React from 'react';

interface Props {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

const TABS = [
  { id: 'encode', label: 'Encode' },
  { id: 'decode', label: 'Decode' },
  { id: 'audit', label: 'Audit' },
];

export function TabNav({ activeTab, onTabChange }: Props) {
  return (
    <nav className="flex gap-1 bg-dark-800 rounded-lg p-1">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-6 py-2 rounded-md text-sm font-medium transition-colors
            ${activeTab === tab.id
              ? 'bg-dark-700 text-white'
              : 'text-gray-400 hover:text-gray-200'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
