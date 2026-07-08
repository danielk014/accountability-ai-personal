import { supabase } from '@/api/supabaseClient';

// ── localStorage keys (used as local cache) ──────────────────────────────────
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

// ── Mapping: localStorage key  ↔  user_kv key (prefixed with dt: to avoid collisions) ──
const LOCAL_TO_KV = {
  [LOGS_KEY]: 'dt:logs',
  [GOALS_KEY]: 'dt:goals',
  [LONG_TERM_GOALS_KEY]: 'dt:long_term_goals',
  [PROJECTS_KEY]: 'dt:projects',
  [BOARD_KEY]: 'dt:board',
  [DAILY_TASKS_KEY]: 'dt:daily_tasks',
  [RECURRING_TASKS_KEY]: 'dt:recurring_tasks',
  [BLOCKS_KEY]: 'dt:blocks',
  [NOTES_KEY]: 'dt:notes',
};

const KV_TO_LOCAL = Object.fromEntries(
  Object.entries(LOCAL_TO_KV).map(([l, k]) => [k, l])
);

// All dt: keys we care about (for filtering pull results)
const DT_KV_KEYS = Object.values(LOCAL_TO_KV);

let _userId = null;
let _realtimeChannel = null;
let _visibilityHandler = null;
let _pullInterval = null;
const _debounceTimers = {};

// ── timestamp helpers ────────────────────────────────────────────────────────

function _getLocalTimestamps() {
  try { return JSON.parse(localStorage.getItem(TIMESTAMPS_KEY)) || {}; } catch { return {}; }
}

function _setLocalTimestamp(kvKey) {
  const ts = _getLocalTimestamps();
  ts[kvKey] = new Date().toISOString();
  localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(ts));
}

// ── write to user_kv (same table + pattern as supabaseStorage) ───────────────

function _syncToKV(localKey) {
  if (!_userId) return;
  const kvKey = LOCAL_TO_KV[localKey];
  if (!kvKey) return;

  _setLocalTimestamp(kvKey);

  clearTimeout(_debounceTimers[kvKey]);
  _debounceTimers[kvKey] = setTimeout(async () => {
    try {
      const raw = localStorage.getItem(localKey);
      const value = raw ? JSON.parse(raw) : {};
      const { error } = await supabase.from('user_kv').upsert(
        { user_id: _userId, key: kvKey, value, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
      if (error) console.error(`[dt-sync] write failed for ${kvKey}:`, error.message);
    } catch (err) {
      console.error(`[dt-sync] exception for ${kvKey}:`, err);
    }
  }, 500);
}

// ── public load/save helpers ─────────────────────────────────────────────────

export function getDateStr(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

export function loadLogs() {
  try { return JSON.parse(localStorage.getItem(LOGS_KEY)) || {}; } catch { return {}; }
}

export function saveLogs(logs) {
  localStorage.setItem(LOGS_KEY, JSON.stringify(logs));
  _syncToKV(LOGS_KEY);
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
  try { return JSON.parse(localStorage.getItem(GOALS_KEY)) || []; } catch { return []; }
}

export function saveGoals(goals) {
  localStorage.setItem(GOALS_KEY, JSON.stringify(goals));
  _syncToKV(GOALS_KEY);
}

export function loadLongTermGoals() {
  try { return JSON.parse(localStorage.getItem(LONG_TERM_GOALS_KEY)) || []; } catch { return []; }
}

export function saveLongTermGoals(goals) {
  localStorage.setItem(LONG_TERM_GOALS_KEY, JSON.stringify(goals));
  _syncToKV(LONG_TERM_GOALS_KEY);
}

export function loadProjects() {
  try { return JSON.parse(localStorage.getItem(PROJECTS_KEY)) || []; } catch { return []; }
}

export function saveProjects(projects) {
  localStorage.setItem(PROJECTS_KEY, JSON.stringify(projects));
  _syncToKV(PROJECTS_KEY);
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
  _syncToKV(BOARD_KEY);
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
  _syncToKV(DAILY_TASKS_KEY);
}

export function loadRecurringTasks() {
  try { return JSON.parse(localStorage.getItem(RECURRING_TASKS_KEY)) || []; } catch { return []; }
}

export function saveRecurringTasks(tasks) {
  localStorage.setItem(RECURRING_TASKS_KEY, JSON.stringify(tasks));
  _syncToKV(RECURRING_TASKS_KEY);
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
  _syncToKV(BLOCKS_KEY);
}

export function loadNotes() {
  try { return JSON.parse(localStorage.getItem(NOTES_KEY)) || []; } catch { return []; }
}

export function saveNotes(notes) {
  localStorage.setItem(NOTES_KEY, JSON.stringify(notes));
  _syncToKV(NOTES_KEY);
}

export function loadAllBlocks() {
  try { return JSON.parse(localStorage.getItem(BLOCKS_KEY)) || {}; } catch { return {}; }
}

export function loadAllDailyTasks() {
  try { return JSON.parse(localStorage.getItem(DAILY_TASKS_KEY)) || {}; } catch { return {}; }
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
    avgEnergy: energyCount > 0 ? (totalEnergy / energyCount).toFixed(1) : '0.0'
  };
}

// ── push all local data to user_kv ───────────────────────────────────────────

export async function pushAllToSupabase() {
  if (!_userId) return;

  // Fetch remote timestamps so we only push data that is genuinely newer
  const { data: remoteRows, error: fetchErr } = await supabase
    .from('user_kv')
    .select('key, updated_at')
    .eq('user_id', _userId)
    .in('key', DT_KV_KEYS);

  if (fetchErr) {
    console.error('[dt-sync] pushAll fetch failed:', fetchErr);
    return;
  }

  const remoteTimestamps = {};
  for (const row of (remoteRows || [])) {
    remoteTimestamps[row.key] = row.updated_at;
  }

  const localTimestamps = _getLocalTimestamps();

  for (const [localKey, kvKey] of Object.entries(LOCAL_TO_KV)) {
    const localTs = localTimestamps[kvKey];
    const remoteTs = remoteTimestamps[kvKey];

    // Skip if remote already has data at least as new as local
    if (remoteTs && localTs && remoteTs >= localTs) continue;

    const raw = localStorage.getItem(localKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const isEmpty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0;
      if (isEmpty) continue;
      await supabase.from('user_kv').upsert(
        { user_id: _userId, key: kvKey, value: parsed, updated_at: localTs || new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    } catch {}
  }
}

// ── pull remote data into localStorage ───────────────────────────────────────

export async function pullFromSupabase() {
  if (!_userId) return;
  const { data, error } = await supabase
    .from('user_kv')
    .select('key, value, updated_at')
    .eq('user_id', _userId)
    .in('key', DT_KV_KEYS);
  if (error) {
    console.error('[dt-sync] pull failed:', error);
    return;
  }
  const localTimestamps = _getLocalTimestamps();
  for (const row of (data || [])) {
    const localKey = KV_TO_LOCAL[row.key];
    if (!localKey) continue;
    const localTs = localTimestamps[row.key];
    const remoteTs = row.updated_at;
    const localRaw = localStorage.getItem(localKey);
    const localEmpty = !localRaw || localRaw === '{}' || localRaw === '[]';

    if (localEmpty || !localTs || remoteTs >= localTs) {
      localStorage.setItem(localKey, JSON.stringify(row.value));
      localTimestamps[row.key] = remoteTs;
    }
  }
  localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(localTimestamps));
}

// ── one-time migration: localStorage → user_kv, and old user_data → user_kv ─

export async function migrateLocalToSupabase() {
  if (!_userId) return;

  // 1. Check which dt: keys already exist in user_kv
  const { data: existing } = await supabase
    .from('user_kv')
    .select('key')
    .eq('user_id', _userId)
    .in('key', DT_KV_KEYS);

  const existingKeys = new Set((existing || []).map(r => r.key));

  // 2. Push any local data that's missing from user_kv
  for (const [localKey, kvKey] of Object.entries(LOCAL_TO_KV)) {
    if (existingKeys.has(kvKey)) continue;
    const raw = localStorage.getItem(localKey);
    if (!raw) continue;
    try {
      const parsed = JSON.parse(raw);
      const isEmpty = Array.isArray(parsed) ? parsed.length === 0 : Object.keys(parsed).length === 0;
      if (isEmpty) continue;
      await supabase.from('user_kv').upsert(
        { user_id: _userId, key: kvKey, value: parsed, updated_at: new Date().toISOString() },
        { onConflict: 'user_id,key' }
      );
    } catch {}
  }

  // 3. Migrate any data stuck in the old user_data table → user_kv
  //    (maps old data_type names like 'daily_tasks' → new keys like 'dt:daily_tasks')
  const OLD_TYPE_TO_KV = {
    logs: 'dt:logs', goals: 'dt:goals', long_term_goals: 'dt:long_term_goals',
    projects: 'dt:projects', board: 'dt:board', daily_tasks: 'dt:daily_tasks',
    recurring_tasks: 'dt:recurring_tasks', blocks: 'dt:blocks', notes: 'dt:notes',
  };
  try {
    const { data: oldRows } = await supabase
      .from('user_data')
      .select('data_type, data, updated_at')
      .eq('user_id', _userId);
    for (const row of (oldRows || [])) {
      const kvKey = OLD_TYPE_TO_KV[row.data_type];
      if (!kvKey || existingKeys.has(kvKey)) continue;
      await supabase.from('user_kv').upsert(
        { user_id: _userId, key: kvKey, value: row.data, updated_at: row.updated_at },
        { onConflict: 'user_id,key' }
      );
      existingKeys.add(kvKey);
    }
  } catch {
    // user_data table may not exist — that's fine
  }
}

// ── dispatch helper ──────────────────────────────────────────────────────────

function _notifyRefresh() {
  window.dispatchEvent(new CustomEvent('daytracker-data-refreshed'));
}

// ── init / cleanup ───────────────────────────────────────────────────────────

export function initStorage(userId) {
  _userId = userId;

  // Re-pull when user returns to the tab/app
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
  }
  _visibilityHandler = () => {
    if (document.visibilityState === 'visible' && _userId) {
      pullFromSupabase().then(_notifyRefresh);
    }
  };
  document.addEventListener('visibilitychange', _visibilityHandler);

  // Periodic pull as fallback (realtime WebSockets drop on mobile)
  if (_pullInterval) clearInterval(_pullInterval);
  _pullInterval = setInterval(() => {
    if (_userId && document.visibilityState === 'visible') {
      pullFromSupabase().then(_notifyRefresh);
    }
  }, 30_000);

  // Supabase realtime on the user_kv table (same table supabaseStorage uses)
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
  }
  _realtimeChannel = supabase
    .channel(`dt_kv_${userId}`)
    .on('postgres_changes', {
      event: '*',
      schema: 'public',
      table: 'user_kv',
      filter: `user_id=eq.${userId}`,
    }, (payload) => {
      const row = payload.new;
      if (!row || !row.key) return;
      // Only handle day-tracker keys (ignore nutrition, chat, etc.)
      const localKey = KV_TO_LOCAL[row.key];
      if (!localKey) return;
      const localTs = _getLocalTimestamps()[row.key];
      const remoteTs = row.updated_at;
      if (!localTs || remoteTs > localTs) {
        localStorage.setItem(localKey, JSON.stringify(row.value));
        const ts = _getLocalTimestamps();
        ts[row.key] = remoteTs;
        localStorage.setItem(TIMESTAMPS_KEY, JSON.stringify(ts));
        _notifyRefresh();
      }
    })
    .subscribe();
}

export function cleanupStorage() {
  if (_visibilityHandler) {
    document.removeEventListener('visibilitychange', _visibilityHandler);
    _visibilityHandler = null;
  }
  if (_pullInterval) {
    clearInterval(_pullInterval);
    _pullInterval = null;
  }
  if (_realtimeChannel) {
    supabase.removeChannel(_realtimeChannel);
    _realtimeChannel = null;
  }
}
