import { supabase } from '@/api/supabaseClient';

const LOGS_KEY = 'daily-tracker-logs';
const GOALS_KEY = 'daily-tracker-goals';
const LONG_TERM_GOALS_KEY = 'daily-tracker-long-term-goals';
const PROJECTS_KEY = 'daily-tracker-projects';
const BOARD_KEY = 'daily-tracker-board';
const DAILY_TASKS_KEY = 'daily-tracker-daily-tasks';
const RECURRING_TASKS_KEY = 'daily-tracker-recurring-tasks';
const BLOCKS_KEY = 'daily-tracker-blocks';
const NOTES_KEY = 'daily-tracker-notes';
const TIMESTAMPS_KEY = 'daily-tracker-sync-timestamps';

const KEY_TO_TYPE = {
  [LOGS_KEY]: 'logs',
  [GOALS_KEY]: 'goals',
  [LONG_TERM_GOALS_KEY]: 'long_term_goals',
  [PROJECTS_KEY]: 'projects',
  [BOARD_KEY]: 'board',
  [DAILY_TASKS_KEY]: 'daily_tasks',
  [RECURRING_TASKS_KEY]: 'recurring_tasks',
  [BLOCKS_KEY]: 'blocks',
  [NOTES_KEY]: 'notes',
};

let _userId = null;
let _realtimeChannel = null;
let _visibilityHandler = null;
const _debounceTimers = {};
// Track which data types have been modified locally and need pushing
const _locallyDirty = new Set();

// Track local write timestamps so we can compare with Supabase
function _getLocalTimestamps() {
  try { return JSON.parse(localStorage.getItem(TIMESTAMPS_KEY)) || {}; } catch { return {}; }
}
function _setLocalTimestamp(dataType) {
  const ts = _getLocalTimestamps();
  ts[dataType] = new Date().toISOString();
  localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(ts));
}

function syncToSupabase(localStorageKey) {
  if (!_userId) return;
  const dataType = KEY_TO_TYPE[localStorageKey];
  if (!dataType) return;

  // Track local write time and mark as needing push
  _setLocalTimestamp(dataType);
  _locallyDirty.add(dataType);

  clearTimeout(_debounceTimers[dataType]);
  _debounceTimers[dataType] = setTimeout(async () => {
    try {
      const raw = localStorage.getItem(localStorageKey);
      const data = raw ? JSON.parse(raw) : {};
      const { error } = await supabase.from('user_data').upsert(
        { user_id: _userId, data_type: dataType, data, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,data_type' }
      );
      if (error) {
        console.error(`Supabase sync error for ${dataType}:`, error.message, error);
      }
    } catch (err) {
      console.error(`Supabase sync exception for ${dataType}:`, err);
    }
  }, 500);
}

export function getDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function loadLogs() {
  try {
    return JSON.parse(localStorage.getItem(LOGS_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  syncToSupabase(LOGS_KEY);
}

export function getHourLog(date, hour) {
  const logs = loadLogs();
  return logs[date]?.[hour] || { planned: '', actual: '', energy: 0 };
}

export function setHourLog(date, hour, data) {
  const logs = loadLogs();
  if (!logs[date]) logs[date] = {};
  logs[date][hour] = data;
  saveLogs(logs);
  return logs;
}

export function loadGoals() {
  try {
    return JSON.parse(localStorage.getItem(GOALS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  syncToSupabase(GOALS_KEY);
}

export function loadLongTermGoals() {
  try {
    return JSON.parse(localStorage.getItem(LONG_TERM_GOALS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveLongTermGoals(goals) {
  localStorage.setItem(LONG_TERM_GOALS_KEY, JSON.stringify(goals));
  syncToSupabase(LONG_TERM_GOALS_KEY);
}

export function loadProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  syncToSupabase(PROJECTS_KEY);
}

export function loadBoard() {
  try {
    return JSON.parse(localStorage.getItem(BOARD_KEY)) || { items: [], pan: { x: 0, y: 0 }, zoom: 1 };
  } catch {
    return { items: [], pan: { x: 0, y: 0 }, zoom: 1 };
  }
}

export function saveBoard(board) {
  localStorage.setItem(BOARD_KEY, JSON.stringify(board));
  syncToSupabase(BOARD_KEY);
}

export function loadDailyTasks(date) {
  try {
    const all = JSON.parse(localStorage.getItem(DAILY_TASKS_KEY)) || {};
    return all[date] || [];
  } catch {
    return [];
  }
}

export function saveDailyTasks(date, tasks) {
  try {
    const all = JSON.parse(localStorage.getItem(DAILY_TASKS_KEY)) || {};
    all[date] = tasks;
    localStorage.setItem(DAILY_TASKS_KEY, JSON.stringify(all));
  } catch {
    const obj = {};
    obj[date] = tasks;
    localStorage.setItem(DAILY_TASKS_KEY, JSON.stringify(obj));
  }
  syncToSupabase(DAILY_TASKS_KEY);
}

export function loadRecurringTasks() {
  try {
    return JSON.parse(localStorage.getItem(RECURRING_TASKS_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveRecurringTasks(tasks) {
  localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(tasks));
  syncToSupabase(RECURRING_TASKS_KEY);
}

export function loadBlocks(date) {
  try {
    const all = JSON.parse(localStorage.getItem(BLOCKS_KEY)) || {};
    return all[date] || [];
  } catch {
    return [];
  }
}

export function saveBlocks(date, blocks) {
  try {
    const all = JSON.parse(localStorage.getItem(BLOCKS_KEY)) || {};
    all[date] = blocks;
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(all));
  } catch {
    const obj = {};
    obj[date] = blocks;
    localStorage.setItem(BLOCKS_KEY, JSON.stringify(obj));
  }
  syncToSupabase(BLOCKS_KEY);
}

export function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem(NOTES_KEY)) || [];
  } catch {
    return [];
  }
}

export function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  syncToSupabase(NOTES_KEY);
}

export function loadAllBlocks() {
  try {
    return JSON.parse(localStorage.getItem(BLOCKS_KEY)) || {};
  } catch {
    return {};
  }
}

export function loadAllDailyTasks() {
  try {
    return JSON.parse(localStorage.getItem(DAILY_TASKS_KEY)) || {};
  } catch {
    return {};
  }
}

export function getLast7DaysLogs() {
  const logs = loadLogs();
  const result = {};
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = getDateStr(d);
    if (logs[key]) result[key] = logs[key];
  }
  return result;
}

export function getDayStats(date) {
  const logs = loadLogs();
  const day = logs[date];
  if (!day) return { logged: 0, avgEnergy: 0 };

  let logged = 0;
  let totalEnergy = 0;
  let energyCount = 0;

  for (let h = 0; h < 24; h++) {
    if (day[h] && (day[h].planned || day[h].actual)) {
      logged++;
      if (day[h].energy > 0) {
        totalEnergy += day[h].energy;
        energyCount++;
      }
    }
  }

  return {
    logged,
    avgEnergy: energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : 0
  };
}

const TYPE_TO_KEY = Object.fromEntries(
  Object.entries(KEY_TO_TYPE).map(([k, v]) => [v, k])
);

// Push locally-modified data to Supabase (ensures offline changes get synced)
export async function pushAllToSupabase() {
  if (!_userId) return;
  for (const [localKey, dataType] of Object.entries(KEY_TO_TYPE)) {
    // Only push data types that were actually modified locally,
    // not data that was just pulled from Supabase — otherwise we
    // overwrite newer remote data with stale local copies.
    if (!_locallyDirty.has(dataType)) continue;
    const raw = localStorage.getItem(localKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const isEmpty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0;
      if (isEmpty) continue;
      await supabase.from('user_data').upsert(
        { user_id: _userId, data_type: dataType, data: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,data_type' }
      );
      _locallyDirty.delete(dataType);
    } catch {}
  }
}

export function initStorage(userId) {
  _userId = userId;

  // Set up visibility-based sync: re-pull when user returns to the tab/app
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }
  _visibilityHandler = () => {
    if (document.visibilityState === 'visible' && _userId) {
      pullFromSupabase().then(() => {
        window.dispatchEvent(new CustomEvent('daytracker-data-refreshed'));
      });
    }
  };
  document.addEventListener('visibilitychange', _visibilityHandler);

  // Set up Supabase realtime subscription for live sync across devices
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
  }
  _realtimeChannel = supabase
    .channel(`user_data_${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_data',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      // Another device wrote — update localStorage if their data is newer
      const row = payload.new;
      if (!row || !row.data_type) return;
      const localKey = TYPE_TO_KEY[row.data_type];
      if (!localKey) return;
      const localTs = _getLocalTimestamps()[row.data_type];
      const remoteTs = row.updated_at;
      // Only apply remote change if it's newer than our last local write
      if (!localTs || remoteTs > localTs) {
        localStorage.setItem(localKey, JSON.stringify(row.data));
        // Update local timestamp to match remote so we don't re-push
        const ts = _getLocalTimestamps();
        ts[row.data_type] = remoteTs;
        localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(ts));
        window.dispatchEvent(new CustomEvent('daytracker-data-refreshed'));
      }
    })
    .subscribe();
}

export async function pullFromSupabase() {
  if (!_userId) return;
  const { data, error } = await supabase
    .from('user_data')
    .select('data_type, data, updated_at')
    .eq('user_id', _userId);
  if (error) {
    console.error('pullFromSupabase failed:', error);
    return;
  }
  const localTimestamps = _getLocalTimestamps();
  for (const row of data) {
    const localKey = TYPE_TO_KEY[row.data_type];
    if (!localKey) continue;
    const localTs = localTimestamps[row.data_type];
    const remoteTs = row.updated_at;
    const localRaw = localStorage.getItem(localKey);
    const localEmpty = !localRaw || localRaw === '{}' || localRaw === '[]';

    // Pull from Supabase if: local is empty, no local timestamp, or remote is newer
    if (localEmpty || !localTs || remoteTs >= localTs) {
      localStorage.setItem(localKey, JSON.stringify(row.data));
      localTimestamps[row.data_type] = remoteTs;
      // Remote is at least as new as local — no need to push this type back
      _locallyDirty.delete(row.data_type);
    }
  }
  localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(localTimestamps));
}

export async function migrateLocalToSupabase() {
  if (!_userId) return;

  // Fetch which data types already exist in Supabase for this user
  const { data: existing, error } = await supabase
    .from('user_data')
    .select('data_type')
    .eq('user_id', _userId);
  if (error) {
    console.error('migrateLocalToSupabase check failed:', error);
    return;
  }

  const existingTypes = new Set((existing || []).map(r => r.data_type));

  // Push any local data types that are missing from Supabase
  const rows = [];
  for (const [localKey, dataType] of Object.entries(KEY_TO_TYPE)) {
    if (existingTypes.has(dataType)) continue; // already in Supabase
    const raw = localStorage.getItem(localKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const isEmpty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0;
      if (isEmpty) continue;
      rows.push({
        user_id: _userId,
        data_type: dataType,
        data: parsed,
        updated_at: new Date().toISOString(),
      });
    } catch {
      // skip unparseable
    }
  }
  if (rows.length === 0) return;
  const { error: insertErr } = await supabase.from('user_data').insert(rows);
  if (insertErr) {
    console.error('migrateLocalToSupabase insert failed:', insertErr);
  }
}
