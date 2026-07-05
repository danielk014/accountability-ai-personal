import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { initStorage, migrateLocalToSupabase, pullFromSupabase, pushAllToSupabase } from '@/components/daytracker/storage';
import DailyView from '@/components/daytracker/DailyView';
import CalendarView from '@/components/daytracker/CalendarView';
import WeekView from '@/components/daytracker/WeekView';
import GoalsView from '@/components/daytracker/GoalsView';
import ProjectsView from '@/components/daytracker/ProjectsView';
import NotesView from '@/components/daytracker/NotesView';
import CoachView from '@/components/daytracker/CoachView';
import NutritionView from '@/components/daytracker/NutritionView';
import '@/components/daytracker/daytracker.css';

const TABS = ['Today', 'Calendar', 'Goals', 'Projects', 'Notes', 'Nutrition', 'Coach'];

export default function DayTracker() {
  const { user } = useAuth();
  const [dataReady, setDataReady] = useState(false);
  const [dataKey, setDataKey] = useState(0);
  const [tab, setTab] = useState('Today');
  const [selectedDate, setSelectedDate] = useState(null);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    (async () => {
      initStorage(user.id);
      await migrateLocalToSupabase();
      await pullFromSupabase();
      if (!cancelled) {
        setDataReady(true);
        setDataKey(k => k + 1);
      }
      // After rendering, push all local data to Supabase in background
      // This ensures any localStorage-only data gets synced for other devices
      pushAllToSupabase().catch(() => {});
    })();
    return () => { cancelled = true; };
  }, [user]);

  // Listen for realtime/visibility-based data refreshes from other devices
  useEffect(() => {
    const handler = () => setDataKey(k => k + 1);
    window.addEventListener('daytracker-data-refreshed', handler);
    return () => window.removeEventListener('daytracker-data-refreshed', handler);
  }, []);

  if (!dataReady) {
    return (
      <div className="day-tracker-root">
        <div className="dt-app" style={{ padding: '40px 20px', textAlign: 'center', color: '#666' }}>
          Loading day tracker...
        </div>
      </div>
    );
  }

  function handleDaySelect(date) {
    setSelectedDate(date);
    setTab('Today');
  }

  return (
    <div className="day-tracker-root">
      <div className="dt-app">
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); if (t !== 'Today') setSelectedDate(null); }}
            >
              {t}
            </button>
          ))}
        </nav>

        <main className="content" key={dataKey}>
          {tab === 'Today' && <DailyView overrideDate={selectedDate} />}
          {tab === 'Calendar' && <CalendarView onDaySelect={handleDaySelect} />}
          {tab === 'Goals' && <GoalsView />}
          {tab === 'Projects' && <ProjectsView />}
          {tab === 'Notes' && <NotesView />}
          {tab === 'Nutrition' && <NutritionView />}
          {tab === 'Coach' && <CoachView />}
        </main>
      </div>
    </div>
  );
}
