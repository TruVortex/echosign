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
    <nav className="flex gap-1 bg-brand-card-dark rounded-button p-1">
      {TABS.map(tab => (
        <button
          key={tab.id}
          onClick={() => onTabChange(tab.id)}
          className={`
            px-6 py-2 rounded-button text-sm font-medium transition-colors duration-200 active:animate-button-press
            ${activeTab === tab.id
              ? 'bg-primary text-white'
              : 'text-gray-400 hover:text-white'
            }
          `}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  );
}
