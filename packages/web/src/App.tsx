import React, { useState } from 'react';
import { Layout } from './components/Layout.js';
import { TabNav } from './components/TabNav.js';
import { EncodePanel } from './components/EncodePanel.js';
import { DecodePanel } from './components/DecodePanel.js';
import { AuditPanel } from './components/AuditPanel.js';

export default function App() {
  const [activeTab, setActiveTab] = useState('encode');

  return (
    <Layout>
      <div className="space-y-8">
        <TabNav activeTab={activeTab} onTabChange={setActiveTab} />

        <div>
          {activeTab === 'encode' && <EncodePanel />}
          {activeTab === 'decode' && <DecodePanel />}
          {activeTab === 'audit' && <AuditPanel />}
        </div>
      </div>
    </Layout>
  );
}
