import React from 'react';

interface Props {
  children: React.ReactNode;
}

export function Layout({ children }: Props) {
  return (
    <div className="min-h-screen bg-neutral-900 text-white">
      {/* Header */}
      <header className="border-b border-neutral-700 px-6 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-red-600 flex items-center justify-center text-sm font-bold">
              ES
            </div>
            <h1 className="text-lg font-bold">EchoSign</h1>
            <span className="text-xs text-gray-500">Semantic Codec</span>
          </div>
          <div className="text-xs text-gray-500">
            Emergency Communication System
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-6 py-8">
        {children}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-700 px-6 py-4 text-center text-xs text-gray-600">
        CXC 2026 AI Hackathon | 24-byte semantic codes | Ed25519 signing | FSK acoustic transport
      </footer>
    </div>
  );
}
