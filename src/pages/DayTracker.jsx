import { useState, useEffect } from 'react';
import { useAuth } from '@/lib/AuthContext';
import { initStorage, cleanupStorage, migrateLocalToSupabase, pullFromSupabase, pushAllToSupabase } from '@/components/daytracker/storage';
import DailyView from '@/components/daytracker/DailyView';
import CombinedCalendarView from '@/components/daytracker/CombinedCalendarView';
import GoalsView from '@/components/daytracker/GoalsView';
import ProjectsView from '@/components/daytracker/ProjectsView';
import NotesView from '@/components/daytracker/NotesView';
import CoachView from '@/components/daytracker/CoachView';
import NutritionView from '@/components/daytracker/NutritionView';
import LifeLessonsView from '@/components/daytracker/LifeLessonsView';
import '@/components/daytracker/daytracker.css';

const TABS = ['Calendar2', 'Calendar', 'Goals', 'Projects', 'Notes', 'Lessons', 'Nutrition', 'Coach'];

export default function DayTracker() {
  const { user } = useAuth();
  const [dataReady, setDataReady] = useState(false);
  const [tab, setTab] = useState('Calendar2');
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
      }
      // After rendering, push all local data to Supabase in background
      // This ensures any localStorage-only data gets synced for other devices
      pushAllToSupabase().catch(e => console.error('[DayTracker] Failed to sync to Supabase:', e));
    })();
    return () => { cancelled = true; cleanupStorage(); };
  }, [user]);

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
    setTab('Calendar2');
  }

  return (
    <div className="day-tracker-root">
      <div className="dt-app">
        <nav className="tabs">
          {TABS.map(t => (
            <button
              key={t}
              className={`tab ${tab === t ? 'active' : ''}`}
              onClick={() => { setTab(t); if (t !== 'Calendar2') setSelectedDate(null); }}
            >
              {t}
            </button>
          ))}
        </nav>

        <main className="content">
          {tab === 'Calendar2' && <DailyView overrideDate={selectedDate} />}
          {tab === 'Calendar' && <CombinedCalendarView onDaySelect={handleDaySelect} />}
          {tab === 'Goals' && <GoalsView />}
          {tab === 'Projects' && <ProjectsView />}
          {tab === 'Notes' && <NotesView />}
          {tab === 'Lessons' && <LifeLessonsView />}
          {tab === 'Nutrition' && <NutritionView />}
          {tab === 'Coach' && <CoachView />}
        </main>
      </div>
    </div>
  );
}
