import React, { useState, useEffect, useCallback } from 'react';
import { Screen, Incident } from './types';
import ReportScreen from './components/ReportScreen';
import AlertScreen from './components/AlertScreen';
import LogScreen from './components/LogScreen';
import { getAllIncidents } from './services/incidents';

const STORAGE_KEY = 'echosign_incidents';

function loadFromStorage(): Incident[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveToStorage(incidents: Incident[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(incidents));
  } catch {
    // Storage full or unavailable
  }
}

const App: React.FC = () => {
  const [currentScreen, setCurrentScreen] = useState<Screen>('report');
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [logs, setLogs] = useState<Incident[]>(loadFromStorage);
  const [isLoading, setIsLoading] = useState(true);

  // Load incidents from API on mount, merge with localStorage
  useEffect(() => {
    loadIncidents();
  }, []);

  // Persist to localStorage whenever logs change
  useEffect(() => {
    saveToStorage(logs);
  }, [logs]);

  const loadIncidents = async () => {
    try {
      const serverIncidents = await getAllIncidents();
      setLogs(prev => {
        // Merge: server is source of truth, but keep local-only incidents
        const serverIds = new Set(serverIncidents.map(i => i.id));
        const localOnly = prev.filter(i => !serverIds.has(i.id));
        return [...serverIncidents, ...localOnly];
      });
    } catch (err) {
      console.error('Failed to load incidents:', err);
      // localStorage data is already loaded as initial state
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

  const addIncidentToLog = useCallback((incident: Incident) => {
    setLogs(prev => {
      // Prevent duplicates
      if (prev.some(l => l.id === incident.id)) {
        return prev.map(l => l.id === incident.id ? incident : l);
      }
      return [incident, ...prev];
    });
  }, []);

  const handleIncidentUpdate = useCallback((updated: Incident) => {
    setLogs(prev => {
      const exists = prev.some(l => l.id === updated.id);
      if (exists) {
        return prev.map(l => l.id === updated.id ? updated : l);
      }
      return [updated, ...prev];
    });
  }, []);

  return (
    <div className="flex justify-center min-h-screen">
      <div className="relative flex flex-col h-[100dvh] w-full max-w-[430px] bg-brand-bg-light dark:bg-brand-bg-dark overflow-hidden shadow-2xl transition-colors duration-300">

        {/* All screens stay mounted, only the active one is visible */}
        <div className={`flex-1 overflow-y-auto no-scrollbar ${currentScreen === 'report' ? '' : 'hidden'}`}>
          <ReportScreen onIncidentCapture={addIncidentToLog} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />
        </div>
        <div className={`flex-1 overflow-y-auto no-scrollbar ${currentScreen === 'alerts' ? '' : 'hidden'}`}>
          <AlertScreen isDarkMode={isDarkMode} onToggleTheme={toggleTheme} incidents={logs} onIncidentUpdate={handleIncidentUpdate} />
        </div>
        <div className={`flex-1 overflow-y-auto no-scrollbar ${currentScreen === 'logs' ? '' : 'hidden'}`}>
          <LogScreen logs={logs} setLogs={setLogs} isDarkMode={isDarkMode} onToggleTheme={toggleTheme} />
        </div>

        {/* Bottom Navigation */}
        <nav className="flex items-center justify-around px-8 py-4 pb-8 bg-brand-card-light dark:bg-brand-card-dark border-t border-brand-border/10 dark:border-brand-border/30 transition-colors z-50">
          <button
            onClick={() => setCurrentScreen('report')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity duration-200 ${currentScreen === 'report' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} active:animate-button-press`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'report' ? 'bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'report' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'report' ? "'FILL' 1" : "" }}>mic</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">Record</span>
          </button>

          <button
            onClick={() => setCurrentScreen('alerts')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity duration-200 ${currentScreen === 'alerts' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} active:animate-button-press`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'alerts' ? 'bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'alerts' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'alerts' ? "'FILL' 1" : "" }}>notifications_active</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">Alerts</span>
          </button>
          <button
            onClick={() => setCurrentScreen('logs')}
            className={`flex flex-col items-center gap-1.5 group transition-opacity duration-200 ${currentScreen === 'logs' ? 'opacity-100' : 'opacity-70 group-hover:opacity-100'} active:animate-button-press`}
          >
            <div className={`w-12 h-12 rounded-button flex items-center justify-center transition-all ${currentScreen === 'logs' ? 'bg-primary/10' : 'bg-transparent'}`}>
              <span className={`material-symbols-outlined text-2xl ${currentScreen === 'logs' ? 'text-primary' : 'text-gray-600 dark:text-gray-400'}`} style={{ fontVariationSettings: currentScreen === 'logs' ? "'FILL' 1" : "" }}>assignment</span>
            </div>
            <span className="text-[9px] font-black uppercase tracking-wider text-gray-600 dark:text-gray-400">Ledger</span>
          </button>        </nav>
      </div>
    </div>
  );
};

export default App;
