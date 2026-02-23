import { base44 } from './base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { addReminder, getReminders, deleteReminder } from '@/lib/reminderEngine';

const BASE_SYSTEM = `You are the user's ride-or-die best friend and accountability buddy. Be warm, playful, and encouraging. Talk like a real friend, not a chatbot. Help them stay accountable to their goals, celebrate wins, and support them when they're struggling. Keep responses concise and conversational.

You have tools to directly manage the user's data. When they ask you to add, edit, delete, or schedule anything — sleep entries, tasks, habits, calendar events, people, or context — use your tools to do it immediately without asking for confirmation unless critical information is missing. After using a tool, briefly confirm what you did in a friendly way.

When the user mentions someone important in their life (a friend, family member, partner, etc.) or shares personal info about themselves (where they live, their job, a goal, etc.), proactively save it using add_person or update_context so it's remembered for future conversations.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
Current time: ${new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}`;

import { getUserPrefix } from '@/lib/userStore';

const _CHAT_KEY = 'accountable_chat_history';
const MAX_HISTORY = 40;
const getStorageKey = () => `${getUserPrefix()}${_CHAT_KEY}`;

// ─── Tool definitions ───────────────────────────────────────────────────────

const TOOLS = [
  {
    name: "log_sleep",
    description: "Log or update sleep for a specific date. Use when the user mentions going to sleep / waking up or wants to record sleep data.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format. Use today's date if not specified." },
        sleep_time: { type: "string", description: "Time the user went to sleep in HH:MM 24-hour format (e.g. '23:30' for 11:30 PM)" },
        wake_time: { type: "string", description: "Time the user woke up in HH:MM 24-hour format (e.g. '07:00' for 7:00 AM)" },
      },
      required: ["date", "sleep_time", "wake_time"],
    },
  },
  {
    name: "delete_sleep",
    description: "Delete a sleep entry for a specific date.",
    input_schema: {
      type: "object",
      properties: {
        date: { type: "string", description: "Date in YYYY-MM-DD format" },
      },
      required: ["date"],
    },
  },
  {
    name: "list_sleep",
    description: "Fetch recent sleep entries to see what's already logged.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "create_task",
    description: "Create a new habit, recurring task, or one-time calendar event. Use frequency='once' for single-day events.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Task or habit name" },
        frequency: {
          type: "string",
          enum: ["daily", "weekdays", "weekends", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "once"],
          description: "How often it repeats. Use 'once' for one-time calendar events.",
        },
        scheduled_time: { type: "string", description: "Optional time in HH:MM 24h format (e.g. '09:00')" },
        scheduled_date: { type: "string", description: "Required when frequency='once'. Date in YYYY-MM-DD." },
        category: {
          type: "string",
          enum: ["health", "work", "learning", "personal", "social", "mindfulness", "other"],
        },
        duration_minutes: { type: "number", description: "Expected duration in minutes" },
      },
      required: ["name", "frequency"],
    },
  },
  {
    name: "list_tasks",
    description: "List all existing tasks and habits so you know what's available.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "update_task",
    description: "Update an existing task — change its time, date, name, frequency, or other properties.",
    input_schema: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "Name of the task to update (partial match is fine)" },
        scheduled_time: { type: "string", description: "New time in HH:MM 24h format" },
        scheduled_date: { type: "string", description: "New date in YYYY-MM-DD format" },
        frequency: {
          type: "string",
          enum: ["daily", "weekdays", "weekends", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday", "once"],
        },
        name: { type: "string", description: "New name for the task" },
        category: {
          type: "string",
          enum: ["health", "work", "learning", "personal", "social", "mindfulness", "other"],
        },
        duration_minutes: { type: "number" },
      },
      required: ["task_name"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task or habit permanently.",
    input_schema: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "Name of the task to delete (partial match)" },
      },
      required: ["task_name"],
    },
  },
  {
    name: "set_reminder",
    description: "Set a reminder for the user. Use when they say 'remind me to...', 'set a reminder for...', 'remind me in X minutes', etc. The reminder will appear in the Reminders tab and fire a notification at the specified time.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "What to remind the user about" },
        type: { type: "string", enum: ["once", "daily"], description: "One-time or daily recurring reminder" },
        datetime: { type: "string", description: "For one-time reminders: datetime in YYYY-MM-DDTHH:MM format (local time). Required if type is 'once'." },
        time: { type: "string", description: "For daily reminders: time in HH:MM 24h format. Required if type is 'daily'." },
      },
      required: ["text", "type"],
    },
  },
  {
    name: "list_reminders",
    description: "List all existing reminders the user has set.",
    input_schema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "delete_reminder",
    description: "Delete a reminder by matching its text.",
    input_schema: {
      type: "object",
      properties: {
        text: { type: "string", description: "Text of the reminder to delete (partial match)" },
      },
      required: ["text"],
    },
  },
  {
    name: "add_person",
    description: "Add a person to the user's 'People in My Life'. Use this when the user mentions someone important and wants to save them, or when they say 'remember that X is my ...'.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Person's name" },
        relationship: { type: "string", description: "Relationship type, e.g. 'best friend', 'mom', 'partner', 'coworker'" },
        birthday: { type: "string", description: "Birthday in YYYY-MM-DD format" },
        interests: { type: "string", description: "Their interests, comma-separated" },
        notes: { type: "string", description: "Any extra notes about this person" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_person",
    description: "Update an existing person in the user's 'People in My Life'. Use to change their relationship, birthday, interests, or notes.",
    input_schema: {
      type: "object",
      properties: {
        person_name: { type: "string", description: "Name of the person to update (partial match)" },
        name: { type: "string", description: "New name" },
        relationship: { type: "string", description: "New relationship" },
        birthday: { type: "string", description: "New birthday in YYYY-MM-DD format" },
        interests: { type: "string", description: "New interests" },
        notes: { type: "string", description: "New notes" },
      },
      required: ["person_name"],
    },
  },
  {
    name: "delete_person",
    description: "Remove a person from the user's 'People in My Life'.",
    input_schema: {
      type: "object",
      properties: {
        person_name: { type: "string", description: "Name of the person to remove (partial match)" },
      },
      required: ["person_name"],
    },
  },
  {
    name: "update_context",
    description: "Add or remove items from the user's personal context sections. Use when they share new info about themselves (About Me, Work, Goals, Extra notes).",
    input_schema: {
      type: "object",
      properties: {
        section: {
          type: "string",
          enum: ["about", "work", "goals", "notes"],
          description: "Which section: 'about' = About Me, 'work' = Work & Schedule, 'goals' = Goals & Plans, 'notes' = Extra Context",
        },
        action: {
          type: "string",
          enum: ["add", "remove"],
          description: "Add a new item or remove an existing one",
        },
        text: { type: "string", description: "The text to add or remove (partial match for remove)" },
      },
      required: ["section", "action", "text"],
    },
  },
];

// ─── Tool execution ──────────────────────────────────────────────────────────

function nextBirthdayDate(birthdayStr) {
  if (!birthdayStr) return null;
  const today = new Date();
  const bday = new Date(birthdayStr + "T00:00:00");
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (thisYear >= today) return fmt(thisYear);
  return fmt(new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate()));
}

function calcHours(sleepTime, wakeTime) {
  const [sh, sm] = sleepTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let sleepMins = sh * 60 + sm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= sleepMins) wakeMins += 24 * 60;
  return parseFloat(((wakeMins - sleepMins) / 60).toFixed(2));
}

async function executeTool(name, input) {
  try {
    const user = await base44.auth.me();

    switch (name) {

      case "log_sleep": {
        const hours = calcHours(input.sleep_time, input.wake_time);
        if (!hours || hours <= 0) return { error: "Wake time must be after sleep time" };
        const all = await base44.entities.Sleep.filter({ created_by: user.email });
        const existing = all.find(s => s.date === input.date);
        if (existing) {
          await base44.entities.Sleep.update(existing.id, { sleep_time: input.sleep_time, wake_time: input.wake_time, hours });
          queryClientInstance.invalidateQueries({ queryKey: ["sleep"] });
          return { success: true, action: "updated", date: input.date, sleep_time: input.sleep_time, wake_time: input.wake_time, hours };
        } else {
          await base44.entities.Sleep.create({ date: input.date, sleep_time: input.sleep_time, wake_time: input.wake_time, hours });
          queryClientInstance.invalidateQueries({ queryKey: ["sleep"] });
          return { success: true, action: "created", date: input.date, sleep_time: input.sleep_time, wake_time: input.wake_time, hours };
        }
      }

      case "delete_sleep": {
        const all = await base44.entities.Sleep.filter({ created_by: user.email });
        const entry = all.find(s => s.date === input.date);
        if (!entry) return { error: `No sleep entry found for ${input.date}` };
        await base44.entities.Sleep.delete(entry.id);
        queryClientInstance.invalidateQueries({ queryKey: ["sleep"] });
        return { success: true, action: "deleted", date: input.date };
      }

      case "list_sleep": {
        const entries = await base44.entities.Sleep.filter({ created_by: user.email }, "-date", 14);
        return {
          entries: entries.map(e => ({
            date: e.date,
            sleep_time: e.sleep_time,
            wake_time: e.wake_time,
            hours: e.hours,
          })),
        };
      }

      case "create_task": {
        const task = await base44.entities.Task.create({
          name: input.name,
          frequency: input.frequency,
          scheduled_time: input.scheduled_time || null,
          scheduled_date: input.scheduled_date || null,
          category: input.category || "personal",
          duration_minutes: input.duration_minutes || null,
          is_active: true,
          streak: 0,
          total_completions: 0,
        });
        queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
        return { success: true, action: "created", task: { id: task.id, name: task.name, frequency: task.frequency, scheduled_time: task.scheduled_time, scheduled_date: task.scheduled_date } };
      }

      case "list_tasks": {
        const tasks = await base44.entities.Task.filter({ created_by: user.email });
        return {
          tasks: tasks.map(t => ({
            name: t.name,
            frequency: t.frequency,
            scheduled_time: t.scheduled_time || null,
            scheduled_date: t.scheduled_date || null,
            category: t.category,
            is_active: t.is_active,
          })),
        };
      }

      case "update_task": {
        const tasks = await base44.entities.Task.filter({ created_by: user.email });
        const task = tasks.find(t => t.name.toLowerCase().includes(input.task_name.toLowerCase()));
        if (!task) return { error: `No task found matching "${input.task_name}"` };
        const updates = {};
        if (input.scheduled_time !== undefined) updates.scheduled_time = input.scheduled_time;
        if (input.scheduled_date !== undefined) updates.scheduled_date = input.scheduled_date;
        if (input.frequency !== undefined) updates.frequency = input.frequency;
        if (input.name !== undefined) updates.name = input.name;
        if (input.category !== undefined) updates.category = input.category;
        if (input.duration_minutes !== undefined) updates.duration_minutes = input.duration_minutes;
        await base44.entities.Task.update(task.id, updates);
        queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
        return { success: true, action: "updated", task: task.name, changes: updates };
      }

      case "delete_task": {
        const tasks = await base44.entities.Task.filter({ created_by: user.email });
        const task = tasks.find(t => t.name.toLowerCase().includes(input.task_name.toLowerCase()));
        if (!task) return { error: `No task found matching "${input.task_name}"` };
        await base44.entities.Task.delete(task.id);
        queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
        return { success: true, action: "deleted", task: task.name };
      }

      case "set_reminder": {
        if (input.type === 'once' && !input.datetime) return { error: "datetime is required for one-time reminders (format: YYYY-MM-DDTHH:MM)" };
        if (input.type === 'daily' && !input.time) return { error: "time is required for daily reminders (format: HH:MM)" };
        const reminder = addReminder({
          text: input.text,
          type: input.type,
          time: input.time || null,
          datetime: input.datetime || null,
        });
        window.dispatchEvent(new CustomEvent('reminders-updated'));
        return { success: true, reminder: { text: reminder.text, type: reminder.type, time: reminder.time, datetime: reminder.datetime } };
      }

      case "list_reminders": {
        const reminders = getReminders();
        return {
          reminders: reminders.map(r => ({
            text: r.text,
            type: r.type,
            time: r.time,
            datetime: r.datetime,
            fired: r.fired,
          })),
        };
      }

      case "delete_reminder": {
        const reminders = getReminders();
        const match = reminders.find(r => r.text.toLowerCase().includes(input.text.toLowerCase()));
        if (!match) return { error: `No reminder found matching "${input.text}"` };
        deleteReminder(match.id);
        window.dispatchEvent(new CustomEvent('reminders-updated'));
        return { success: true, deleted: match.text };
      }

      case "add_person": {
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];
        const existing = profile?.context_people || [];
        const newPerson = {
          name: input.name,
          relationship: input.relationship || "",
          birthday: input.birthday || "",
          interests: input.interests || "",
          notes: input.notes || "",
        };
        const updatedPeople = [...existing, JSON.stringify(newPerson)];
        if (profile?.id) {
          await base44.entities.UserProfile.update(profile.id, { context_people: updatedPeople });
        } else {
          await base44.entities.UserProfile.create({ context_people: updatedPeople });
        }
        queryClientInstance.invalidateQueries({ queryKey: ["profile"] });
        // Auto-create birthday task + calendar event if birthday provided
        if (input.birthday) {
          const scheduledDate = nextBirthdayDate(input.birthday);
          if (scheduledDate) {
            const taskName = `${input.name}'s Birthday 🎂`;
            const existingTasks = await base44.entities.Task.filter({ name: taskName });
            if (existingTasks.length === 0) {
              await base44.entities.Task.create({ name: taskName, frequency: "once", scheduled_date: scheduledDate, scheduled_time: "09:00", category: "social", is_active: true });
              queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
            }
          }
        }
        return { success: true, action: "added", person: newPerson };
      }

      case "update_person": {
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];
        if (!profile) return { error: "No profile found" };
        const people = (profile.context_people || []).map(s => { try { return JSON.parse(s); } catch { return { name: s }; } });
        const idx = people.findIndex(p => p.name?.toLowerCase().includes(input.person_name.toLowerCase()));
        if (idx === -1) return { error: `No person found matching "${input.person_name}"` };
        const updated = { ...people[idx] };
        if (input.name !== undefined) updated.name = input.name;
        if (input.relationship !== undefined) updated.relationship = input.relationship;
        if (input.birthday !== undefined) updated.birthday = input.birthday;
        if (input.interests !== undefined) updated.interests = input.interests;
        if (input.notes !== undefined) updated.notes = input.notes;
        people[idx] = updated;
        await base44.entities.UserProfile.update(profile.id, { context_people: people.map(p => JSON.stringify(p)) });
        queryClientInstance.invalidateQueries({ queryKey: ["profile"] });
        // Update birthday task + calendar event if birthday changed
        if (input.birthday) {
          const scheduledDate = nextBirthdayDate(input.birthday);
          if (scheduledDate) {
            const taskName = `${updated.name}'s Birthday 🎂`;
            const existingTasks = await base44.entities.Task.filter({ name: taskName });
            if (existingTasks.length > 0) {
              await base44.entities.Task.update(existingTasks[0].id, { scheduled_date: scheduledDate, is_active: true });
            } else {
              await base44.entities.Task.create({ name: taskName, frequency: "once", scheduled_date: scheduledDate, scheduled_time: "09:00", category: "social", is_active: true });
            }
            queryClientInstance.invalidateQueries({ queryKey: ["tasks"] });
          }
        }
        return { success: true, action: "updated", person: updated };
      }

      case "delete_person": {
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];
        if (!profile) return { error: "No profile found" };
        const people = (profile.context_people || []).map(s => { try { return JSON.parse(s); } catch { return { name: s }; } });
        const idx = people.findIndex(p => p.name?.toLowerCase().includes(input.person_name.toLowerCase()));
        if (idx === -1) return { error: `No person found matching "${input.person_name}"` };
        const deletedName = people[idx].name;
        people.splice(idx, 1);
        await base44.entities.UserProfile.update(profile.id, { context_people: people.map(p => JSON.stringify(p)) });
        queryClientInstance.invalidateQueries({ queryKey: ["profile"] });
        return { success: true, action: "deleted", person: deletedName };
      }

      case "update_context": {
        const sectionMap = { about: "context_about", work: "context_work", goals: "context_goals", notes: "context_notes" };
        const key = sectionMap[input.section];
        if (!key) return { error: `Unknown section: ${input.section}` };
        const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
        const profile = profiles[0];
        const items = profile?.[key] || [];
        if (input.action === "add") {
          const updatedItems = [...items, input.text];
          if (profile?.id) {
            await base44.entities.UserProfile.update(profile.id, { [key]: updatedItems });
          } else {
            await base44.entities.UserProfile.create({ [key]: [input.text] });
          }
          queryClientInstance.invalidateQueries({ queryKey: ["profile"] });
          return { success: true, action: "added", section: input.section, text: input.text };
        } else if (input.action === "remove") {
          const removeIdx = items.findIndex(i => i.toLowerCase().includes(input.text.toLowerCase()));
          if (removeIdx === -1) return { error: `No item found matching "${input.text}" in ${input.section}` };
          const removed = items[removeIdx];
          const updatedItems = items.filter((_, i) => i !== removeIdx);
          await base44.entities.UserProfile.update(profile.id, { [key]: updatedItems });
          queryClientInstance.invalidateQueries({ queryKey: ["profile"] });
          return { success: true, action: "removed", section: input.section, text: removed };
        }
        return { error: "Unknown action" };
      }

      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

// ─── Context builder ─────────────────────────────────────────────────────────

export async function buildSystemPrompt() {
  try {
    const user = await base44.auth.me();
    const [profiles, projects, allProjectTasks, tasks] = await Promise.all([
      base44.entities.UserProfile.filter({ created_by: user.email }),
      base44.entities.Project.filter({ created_by: user.email }, "-created_at"),
      base44.entities.ProjectTask.filter({ created_by: user.email }),
      base44.entities.Task.filter({ created_by: user.email }),
    ]);
    const profile = profiles[0];

    const lines = [];

    if (profile) {
      if (profile.context_about?.length)   lines.push(`## About Me\n${profile.context_about.join('\n')}`);
      if (profile.context_work?.length)    lines.push(`## Work & Schedule\n${profile.context_work.join('\n')}`);
      if (profile.context_goals?.length)   lines.push(`## Goals & Plans\n${profile.context_goals.join('\n')}`);
      if (profile.context_notes?.length)   lines.push(`## Extra Context\n${profile.context_notes.join('\n')}`);
      if (profile.context_people?.length) {
        const people = profile.context_people.map(p => {
          try { return JSON.parse(p); } catch { return { name: p }; }
        });
        const text = people.map(p => {
          const parts = [`- ${p.name}`];
          if (p.relationship) parts.push(`(${p.relationship})`);
          if (p.birthday)     parts.push(`birthday: ${p.birthday}`);
          if (p.interests)    parts.push(`interests: ${p.interests}`);
          if (p.notes)        parts.push(`notes: ${p.notes}`);
          return parts.join(', ');
        }).join('\n');
        lines.push(`## People in My Life\n${text}`);
      }
      if (profile.ai_personality) lines.push(`## How to Talk to Me\n${profile.ai_personality}`);
    }

    if (projects.length > 0) {
      const tasksByProject = {};
      for (const t of allProjectTasks) {
        if (!tasksByProject[t.project_id]) tasksByProject[t.project_id] = [];
        tasksByProject[t.project_id].push(t);
      }
      const projectText = projects.map(p => {
        const pts = tasksByProject[p.id] || [];
        const done  = pts.filter(t => t.is_done).length;
        const pct   = pts.length ? Math.round((done / pts.length) * 100) : 0;
        const pending = pts.filter(t => !t.is_done).map(t => `  - ${t.name}${t.due_date ? ` (due ${t.due_date})` : ''}`).join('\n');
        return `- **${p.name}** (${p.type}, ${p.status})${p.deadline ? ` — deadline: ${p.deadline}` : ''} — ${pct}% complete (${done}/${pts.length} tasks)${pending ? `\n  Pending tasks:\n${pending}` : ''}`;
      }).join('\n');
      lines.push(`## My Projects\n${projectText}`);
    }

    // Active habits & tasks
    const activeTasks = tasks.filter(t => t.is_active !== false);
    if (activeTasks.length > 0) {
      const taskText = activeTasks.map(t => {
        let desc = `- ${t.name} (${t.frequency})`;
        if (t.scheduled_time) desc += ` at ${t.scheduled_time}`;
        if (t.scheduled_date) desc += ` on ${t.scheduled_date}`;
        if (t.category) desc += ` [${t.category}]`;
        return desc;
      }).join('\n');
      lines.push(`## My Habits & Tasks\n${taskText}`);
    }

    // Financial snapshot from localStorage
    try {
      const finRaw = localStorage.getItem('accountable_financials_v2');
      if (finRaw) {
        const fin = JSON.parse(finRaw);
        const sumAmts = arr => arr.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
        const fmtAmt = n => (parseFloat(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        const income = sumAmts(fin.income_sources || []);
        const recurring = sumAmts(fin.recurring_expenses || []);
        const wishlist = sumAmts(fin.wishlist_expenses || []);
        const savings = income - recurring - wishlist;
        const rate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;
        if (income > 0 || recurring > 0) {
          let finText = `Income: $${fmtAmt(income)}/mo`;
          if ((fin.income_sources || []).length > 0) finText += ` (${fin.income_sources.map(s => `${s.name}: $${fmtAmt(s.amount)}`).join(', ')})`;
          if (recurring > 0) finText += `\nFixed Expenses: $${fmtAmt(recurring)}/mo — ${(fin.recurring_expenses || []).map(e => `${e.name}: $${fmtAmt(e.amount)}`).join(', ')}`;
          if (wishlist > 0) finText += `\nOptional Spending: $${fmtAmt(wishlist)}/mo — ${(fin.wishlist_expenses || []).map(e => `${e.name}: $${fmtAmt(e.amount)}`).join(', ')}`;
          finText += `\nMonthly Savings: $${fmtAmt(savings)} (${rate}% savings rate)`;
          lines.push(`## My Finances\n${finText}`);
        }
      }
    } catch {}

    if (lines.length === 0) return BASE_SYSTEM;

    return `${BASE_SYSTEM}

Here is everything you know about the user — always use this for personal, relevant answers:

${lines.join('\n\n')}`;
  } catch {
    return BASE_SYSTEM;
  }
}

// ─── History helpers ──────────────────────────────────────────────────────────

export function loadHistory() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function saveHistory(messages) {
  localStorage.setItem(getStorageKey(), JSON.stringify(messages.slice(-MAX_HISTORY)));
}

export function clearHistory() {
  localStorage.removeItem(getStorageKey());
}

// ─── One-off prompt (no tools, no history) ───────────────────────────────────

export async function sendOneOffPrompt(prompt) {
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 2048,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
  return (await response.json()).content[0].text;
}

// ─── Shared agentic loop (used by both chat variants) ────────────────────────

async function _agenticLoop(history, systemPrompt) {
  let messages = history.map(m => ({ role: m.role, content: m.content }));

  const hasPdf = messages.some(m =>
    Array.isArray(m.content) && m.content.some(b => b.type === 'document')
  );
  const hasFiles = messages.some(m =>
    Array.isArray(m.content) && m.content.some(b => b.type === 'image' || b.type === 'document')
  );

  for (let turn = 0; turn < 8; turn++) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools: TOOLS,
        messages,
        ...(hasPdf && { betaHeader: 'pdfs-2024-09-25' }),
      }),
    });

    if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    const data = await response.json();

    if (data.stop_reason !== 'tool_use') {
      const textBlock = data.content.find(b => b.type === 'text');
      return textBlock?.text ?? '';
    }

    messages = [...messages, { role: 'assistant', content: data.content }];

    const toolResults = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const result = await executeTool(block.name, block.input);
        toolResults.push({
          type: 'tool_result',
          tool_use_id: block.id,
          content: JSON.stringify(result),
        });
      }
    }

    messages = [...messages, { role: 'user', content: toolResults }];
  }

  return "I ran into an issue completing that. Can you try again?";
}

// ─── Main chat call with tool-use agentic loop ───────────────────────────────

export async function sendMessageToClaude(history) {
  const systemPrompt = await buildSystemPrompt();
  return _agenticLoop(history, systemPrompt);
}

// ─── Same loop but with extra context appended to the system prompt ───────────
// Used by specialised chats (e.g. Financial Advisor) that need to inject data.

export async function sendMessageToClaudeWithContext(history, extraContext) {
  const base = await buildSystemPrompt();
  const systemPrompt = `${base}\n\n${extraContext}`;
  return _agenticLoop(history, systemPrompt);
}

// ─── Gym AI tools ─────────────────────────────────────────────────────────────

const _GYM_KEY_SUFFIX = 'gym_tracker_v1';
const _getGymKey = () => `${getUserPrefix()}${_GYM_KEY_SUFFIX}`;

function _migrateGymData(parsed) {
  const days = [];
  if (Array.isArray(parsed.push_exercises)) {
    days.push({ id: 'push-default', name: 'Push', colorIndex: 0, exercises: parsed.push_exercises });
  }
  if (Array.isArray(parsed.pull_exercises)) {
    days.push({ id: 'pull-default', name: 'Pull', colorIndex: 1, exercises: parsed.pull_exercises });
  }
  if (Array.isArray(parsed.legs_exercises)) {
    days.push({ id: 'legs-default', name: 'Legs', colorIndex: 2, exercises: parsed.legs_exercises });
  }
  if (days.length === 0) {
    days.push(
      { id: 'push-default', name: 'Push', colorIndex: 0, exercises: [] },
      { id: 'pull-default', name: 'Pull', colorIndex: 1, exercises: [] },
      { id: 'legs-default', name: 'Legs', colorIndex: 2, exercises: [] },
    );
  }
  return { weight_unit: parsed.weight_unit || 'kg', workout_days: days };
}

function _loadGymData() {
  try {
    const raw = localStorage.getItem(_getGymKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.workout_days) {
        const migrated = _migrateGymData(parsed);
        localStorage.setItem(_getGymKey(), JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    }
  } catch {}
  return { weight_unit: 'kg', workout_days: [] };
}

function _saveGymData(data) {
  localStorage.setItem(_getGymKey(), JSON.stringify(data));
  window.dispatchEvent(new CustomEvent('gym-data-updated'));
}

function _gymId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

function _findDay(data, dayName) {
  return (data.workout_days || []).find(d =>
    d.name.toLowerCase() === dayName.toLowerCase() ||
    d.name.toLowerCase().includes(dayName.toLowerCase())
  ) || null;
}

function _findExercise(day, exerciseName) {
  return (day.exercises || []).find(e =>
    e.name.toLowerCase().includes(exerciseName.toLowerCase())
  ) || null;
}

const GYM_TOOLS = [
  {
    name: "gym_get_data",
    description: "Get the user's current gym data including all workout days and exercises. ALWAYS call this first before answering questions or giving advice.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "gym_add_exercise",
    description: "Add a new exercise to a workout day. Call this immediately when the user asks to add an exercise.",
    input_schema: {
      type: "object",
      properties: {
        day_name: { type: "string", description: "Name of the workout day (e.g. 'Push', 'Upper', 'Monday')" },
        name: { type: "string", description: "Exercise name e.g. 'Bench Press'" },
      },
      required: ["day_name", "name"],
    },
  },
  {
    name: "gym_delete_exercise",
    description: "Delete an exercise from a workout day.",
    input_schema: {
      type: "object",
      properties: {
        day_name: { type: "string", description: "Name of the workout day" },
        exercise_name: { type: "string", description: "Exercise name to delete (partial match)" },
      },
      required: ["day_name", "exercise_name"],
    },
  },
  {
    name: "gym_log_progress",
    description: "Record a weight progression entry for an exercise (with today's date) so the user can track strength gains over time.",
    input_schema: {
      type: "object",
      properties: {
        day_name: { type: "string", description: "Name of the workout day" },
        exercise_name: { type: "string", description: "Exercise name (partial match)" },
        weight: { type: "number", description: "Weight in kg" },
        reps: { type: "number", description: "Reps performed" },
        note: { type: "string", description: "Optional note e.g. 'new PR', 'felt strong'" },
      },
      required: ["day_name", "exercise_name", "weight", "reps"],
    },
  },
  {
    name: "gym_add_set",
    description: "Add a set (weight + reps) to an exercise for the current workout session.",
    input_schema: {
      type: "object",
      properties: {
        day_name: { type: "string", description: "Name of the workout day" },
        exercise_name: { type: "string", description: "Exercise name (partial match)" },
        weight: { type: "number" },
        reps: { type: "number" },
      },
      required: ["day_name", "exercise_name", "weight", "reps"],
    },
  },
];

async function _executeGymTool(name, input) {
  const data = _loadGymData();
  switch (name) {
    case "gym_get_data": {
      const days = (data.workout_days || []).map(day => ({
        name: day.name,
        exercises: (day.exercises || []).map(ex => ({
          name: ex.name,
          sets: ex.sets || [],
          progress_entries: (ex.weight_log || []).length,
          latest_weight: (ex.weight_log || []).at(-1)?.weight ?? (ex.sets || []).at(-1)?.weight ?? null,
        })),
      }));
      return { weight_unit: data.weight_unit, current_weight: data.current_weight, days };
    }
    case "gym_add_exercise": {
      const day = _findDay(data, input.day_name);
      if (!day) return { error: `No workout day matching "${input.day_name}". Available: ${(data.workout_days || []).map(d => d.name).join(', ')}` };
      if (_findExercise(day, input.name)) return { error: `"${input.name}" already exists in ${day.name}` };
      day.exercises = [...(day.exercises || []), { id: _gymId(), name: input.name, sets: [], weight_log: [] }];
      _saveGymData(data);
      return { success: true, message: `Added "${input.name}" to ${day.name} day` };
    }
    case "gym_delete_exercise": {
      const day = _findDay(data, input.day_name);
      if (!day) return { error: `No workout day matching "${input.day_name}"` };
      const ex = _findExercise(day, input.exercise_name);
      if (!ex) return { error: `No exercise matching "${input.exercise_name}" in ${day.name}` };
      day.exercises = day.exercises.filter(e => e.id !== ex.id);
      _saveGymData(data);
      return { success: true, message: `Deleted "${ex.name}" from ${day.name}` };
    }
    case "gym_log_progress": {
      const day = _findDay(data, input.day_name);
      if (!day) return { error: `No workout day matching "${input.day_name}"` };
      const ex = _findExercise(day, input.exercise_name);
      if (!ex) return { error: `No exercise matching "${input.exercise_name}"` };
      if (!ex.weight_log) ex.weight_log = [];
      ex.weight_log.push({ id: _gymId(), date: new Date().toISOString().split('T')[0], weight: input.weight, reps: input.reps, note: input.note || null });
      _saveGymData(data);
      return { success: true, message: `Logged ${input.weight}${data.weight_unit} × ${input.reps} for "${ex.name}"` };
    }
    case "gym_add_set": {
      const day = _findDay(data, input.day_name);
      if (!day) return { error: `No workout day matching "${input.day_name}"` };
      const ex = _findExercise(day, input.exercise_name);
      if (!ex) return { error: `No exercise matching "${input.exercise_name}"` };
      if (!ex.sets) ex.sets = [];
      ex.sets.push({ id: _gymId(), weight: input.weight, reps: input.reps });
      _saveGymData(data);
      return { success: true, message: `Added set: ${input.weight} × ${input.reps} to "${ex.name}"` };
    }
    default:
      return { error: `Unknown gym tool: ${name}` };
  }
}

export async function sendGymMessage(history, gymContext) {
  const systemPrompt = `You are a knowledgeable and motivating gym coach with direct access to the user's gym data. When they ask you to add exercises, log sets, or record progress — use your tools to do it immediately without asking for confirmation. After using a tool, briefly confirm what you did. Give specific, practical advice about form, progression, and programming.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}

${gymContext}`;

  let messages = history.map(m => ({ role: m.role, content: m.content }));

  for (let turn = 0; turn < 8; turn++) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools: GYM_TOOLS,
        // Force tool use on first turn so the AI must call a tool rather than just talking
        tool_choice: turn === 0 ? { type: "any" } : { type: "auto" },
        messages,
      }),
    });

    if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    const data = await response.json();

    if (data.stop_reason !== 'tool_use') {
      const textBlock = data.content.find(b => b.type === 'text');
      return textBlock?.text ?? '';
    }

    messages = [...messages, { role: 'assistant', content: data.content }];

    const toolResults = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const result = await _executeGymTool(block.name, block.input);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    messages = [...messages, { role: 'user', content: toolResults }];
  }

  return "I ran into an issue completing that. Can you try again?";
}
