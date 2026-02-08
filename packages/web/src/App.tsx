import React, { useState, useEffect } from 'react';
import { Screen, Incident } from './types';
import ReportScreen from './components/ReportScreen';
import AlertScreen from './components/AlertScreen';
import LogScreen from './components/LogScreen';
import { getAllIncidents } from './services/incidents';

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [logs, setLogs] = useState<Incident[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Load incidents from API on mount
  useEffect(() => {
    loadIncidents();
  }, []);

  const loadIncidents = async () => {
    try {
      const incidents = await getAllIncidents();
      setLogs(incidents);
    } catch (err) {
      console.error('Failed to load incidents:', err);
      // If API fails, continue with empty array
    } finally {
      setIsLoading(false);
    }
  };

  // Sync theme with document class
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  const toggleTheme = () => setIsDarkMode(!isDarkMode);

  const addIncidentToLog = (incident: Incident) => {
    setLogs(prev => [incident, ...prev]);
  };

  const handleIncidentUpdate = (updated: Incident) => {
    setLogs(prev => {
      const exists = prev.some(l => l.id === updated.id);
      if (exists) {
        return prev.map(l => l.id === updated.id ? updated : l);
      }
      // New incident from decode
      return [updated, ...prev];
    });
  };

  const renderScreen = () => {
    switch (currentScreen) {
      case 'report':
        return <ReportScreen onIncidentCapture={addIncidentToLog} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
      case 'alerts':
        return <AlertScreen isDarkMode={isDarkMode} onToggleTheme={toggleTheme} incidents={logs} onIncidentUpdate={handleIncidentUpdate} />;
      case 'logs':
        return <LogScreen logs={logs} setLogs={setLogs} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
      default:
        return <ReportScreen onIncidentCapture={addIncidentToLog} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />;
    }
  };

  return (
    <div className="flex justify-center min-h-screen">
      <div className="relative flex flex-col h-[100dvh] w-full max-w-[430px] bg-brand-bg-light dark:bg-brand-bg-dark overflow-hidden shadow-2xl transition-colors duration-300">

        {/* Main Content Area */}
        <div className="flex-1 overflow-y-auto no-scrollbar">
          {renderScreen()}
        </div>

        {/* Bottom Navigation */}
        <nav className="flex items-center justify-around px-8 py-4 pb-8 bg-brand-card-light dark:bg-brand-card-dark border-t border-brand-border/10 dark:border-brand-border/30 transition-colors z-50">
          <button
            onClick={() => setCurrentScreen('report')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity ${currentScreen === 'report' ? 'opacity-100' : 'opacity-40'}`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'report' ? 'bg-primary/20 dark:bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'report' ? 'text-primary' : 'text-brand-dark dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'report' ? "'FILL' 1" : "" }}>mic</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-brand-dark dark:text-gray-400">Record</span>
          </button>

          <button
            onClick={() => setCurrentScreen('alerts')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity ${currentScreen === 'alerts' ? 'opacity-100' : 'opacity-40'}`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'alerts' ? 'bg-primary/20 dark:bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'alerts' ? 'text-primary' : 'text-brand-dark dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'alerts' ? "'FILL' 1" : "" }}>notifications_active</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-brand-dark dark:text-gray-400">Alerts</span>
          </button>

          <button
            onClick={() => setCurrentScreen('logs')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity ${currentScreen === 'logs' ? 'opacity-100' : 'opacity-40'}`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'logs' ? 'bg-primary/20 dark:bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'logs' ? 'text-primary' : 'text-brand-dark dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'logs' ? "'FILL' 1" : "" }}>assignment</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-brand-dark dark:text-gray-400">Ledger</span>
          </button>
        </nav>
      </div>
    </div>
  );
};

export default App;
