import { sendOneOffPrompt, loadHistory, saveHistory } from '@/api/claudeClient';
import { getUserPrefix } from '@/lib/userStore';
import { supabaseStorage } from '@/api/supabaseStorage';
import { showBrowserNotification, syncRemindersToSW } from '@/lib/notifications';

const getRemindersKey = () => `${getUserPrefix()}accountable_reminders`;
const getUnreadKey    = () => `${getUserPrefix()}accountable_unread`;

function _readStorage(key) {
  const raw = supabaseStorage.getItem(key);
  if (raw) return raw;
  const legacy = localStorage.getItem(key);
  if (legacy) { supabaseStorage.setItem(key, legacy); return legacy; }
  return null;
}

let _firing = false; // guard against concurrent checks

// ─── Reminder CRUD ────────────────────────────────────────────────────────────

export function getReminders() {
  try { return JSON.parse(_readStorage(getRemindersKey()) || '[]'); }
  catch { return []; }
}

function _saveReminders(list) {
  supabaseStorage.setItem(getRemindersKey(), JSON.stringify(list));
  syncRemindersToSW(list);
}

export function addReminder({ text, type, time, datetime }) {
  const id = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const r = { id, text, type, time: time || null, datetime: datetime || null,
               fired: false, last_fired: null, created_at: new Date().toISOString() };
  _saveReminders([...getReminders(), r]);
  return r;
}

export function deleteReminder(id) {
  _saveReminders(getReminders().filter(r => r.id !== id));
}

// ─── Unread count ─────────────────────────────────────────────────────────────

export function getUnreadCount() {
  return parseInt(_readStorage(getUnreadKey()) || '0', 10);
}

export function clearUnread() {
  supabaseStorage.setItem(getUnreadKey(), '0');
  window.dispatchEvent(new CustomEvent('unread-changed', { detail: { count: 0 } }));
}

function _incrementUnread() {
  const n = getUnreadCount() + 1;
  supabaseStorage.setItem(getUnreadKey(), String(n));
  window.dispatchEvent(new CustomEvent('unread-changed', { detail: { count: n } }));
}

// ─── Fire a single reminder (calls Claude, appends to chat history) ───────────

async function _fireReminder(reminder) {
  try {
    const prompt = `You are a caring AI accountability buddy sending a proactive check-in to your user. Their reminder just triggered: "${reminder.text}".

Write a short, warm, natural message (1–2 sentences max). Sound like a friend checking in — not a robotic notification. Don't start with "Reminder:" or "You asked me to". Just naturally bring it up in a way that feels personal and motivating.`;

    const reply = await sendOneOffPrompt(prompt);

    // Append assistant message to shared chat history
    const history = loadHistory();
    saveHistory([...history, { role: 'assistant', content: reply }]);

    _incrementUnread();
    window.dispatchEvent(new CustomEvent('reminder-fired', { detail: { message: reply, reminderId: reminder.id } }));

    // Show OS-level notification so user sees it even if the tab isn't focused
    showBrowserNotification('Accountable reminder', reminder.text);
  } catch (err) {
    console.error('[reminderEngine] Failed to fire reminder:', err);
  }
}

// ─── Check loop (call every 30 s from Layout) ─────────────────────────────────

export async function checkReminders() {
  if (_firing) return;
  _firing = true;
  try {
    const now = new Date();
    const reminders = getReminders();
    let changed = false;
    const updated = reminders.map(r => ({ ...r }));

    for (let i = 0; i < updated.length; i++) {
      const r = updated[i];

      if (r.type === 'daily') {
        if (!r.time) continue;
        const [h, m] = r.time.split(':').map(Number);
        if (now.getHours() !== h || now.getMinutes() !== m) continue;
        // Guard: don't fire again within 90 seconds
        if (r.last_fired) {
          const diff = now.getTime() - new Date(r.last_fired).getTime();
          if (diff < 90_000) continue;
        }
        updated[i] = { ...r, last_fired: now.toISOString() };
        changed = true;
        await _fireReminder(r);

      } else {
        // one-time
        if (r.fired || !r.datetime) continue;
        if (now < new Date(r.datetime)) continue;
        updated[i] = { ...r, fired: true, last_fired: now.toISOString() };
        changed = true;
        await _fireReminder(r);
      }
    }

    if (changed) _saveReminders(updated);
  } finally {
    _firing = false;
  }
}

// ─── Helpers used in RemindersPanel ───────────────────────────────────────────

export function formatReminderTime(r) {
  if (r.type === 'daily') {
    if (!r.time) return 'Daily';
    const [h, m] = r.time.split(':').map(Number);
    const d = new Date(); d.setHours(h, m, 0, 0);
    return `Daily at ${d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`;
  }
  if (!r.datetime) return 'Unknown time';
  const target = new Date(r.datetime);
  const now    = new Date();
  const tom    = new Date(); tom.setDate(tom.getDate() + 1);
  const timeStr = target.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  if (target.toDateString() === now.toDateString())  return `Today at ${timeStr}`;
  if (target.toDateString() === tom.toDateString())  return `Tomorrow at ${timeStr}`;
  return `${target.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} at ${timeStr}`;
}

// Returns a datetime-local string "YYYY-MM-DDTHH:MM" offset from now by minutes
export function minutesFromNow(minutes) {
  const d = new Date(Date.now() + minutes * 60_000);
  // format to datetime-local (no seconds, no Z)
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
