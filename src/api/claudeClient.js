import { base44 } from './base44Client';
import { queryClientInstance } from '@/lib/query-client';
import { addReminder, getReminders, deleteReminder } from '@/lib/reminderEngine';

const BASE_SYSTEM = `You are the user's ride-or-die best friend and accountability buddy. Be warm, playful, and encouraging. Talk like a real friend, not a chatbot. Help them stay accountable to their goals, celebrate wins, and support them when they're struggling. Keep responses concise and conversational.

You have tools to directly manage the user's data. When they ask you to add, edit, delete, or schedule anything — sleep entries, tasks, habits, or calendar events — use your tools to do it immediately without asking for confirmation unless critical information is missing. After using a tool, briefly confirm what you did in a friendly way.

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
];

// ─── Tool execution ──────────────────────────────────────────────────────────

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

      // Context files — include text content directly, note PDFs/other files
      const textFiles = (profile.context_files || []).filter(f => f.type === 'text' && f.content);
      if (textFiles.length > 0) {
        const filesText = textFiles.map(f => {
          const preview = f.content.length > 2000
            ? f.content.slice(0, 2000) + '\n...(truncated)'
            : f.content;
          return `### ${f.name}\n${preview}`;
        }).join('\n\n');
        lines.push(`## My Context Files\n${filesText}`);
      }
      const nonTextFiles = (profile.context_files || []).filter(f => f.type !== 'text');
      if (nonTextFiles.length > 0) {
        lines.push(`## Uploaded Files (share in chat for AI to read)\n${nonTextFiles.map(f => `- ${f.name}`).join('\n')}`);
      }

      // Screentime analysis — include any analyzed screenshots
      const analyzedScreentime = (profile.screentime_files || []).filter(f => f.analysis);
      if (analyzedScreentime.length > 0) {
        const stText = analyzedScreentime.map(f => {
          const a = f.analysis;
          const parts = [];
          if (a.total_time) parts.push(`Total: ${a.total_time}`);
          if (a.top_apps?.length) parts.push(`Top apps: ${a.top_apps.slice(0, 4).join(', ')}`);
          if (a.summary) parts.push(a.summary);
          return `- ${f.name} (${new Date(f.uploaded_at).toLocaleDateString()}): ${parts.join(' | ')}`;
        }).join('\n');
        lines.push(`## My Screen Time Data\n${stText}`);
      }
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
