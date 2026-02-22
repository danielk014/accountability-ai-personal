import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Flag, Trash2, Pencil, Check, Bell, Timer, Play, Pause, RotateCcw, SkipForward, Settings2, ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AnimatePresence, motion } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

import GreetingHeader from "../components/dashboard/GreetingHeader";
import TaskCard from "../components/dashboard/TaskCard";
import TaskFormDialog from "../components/tasks/TaskFormDialog";
import RemindersPanel from "../components/chat/RemindersPanel";

// ── To-Do mini form ─────────────────────────────────────────────────────────
const PRIORITIES = ["urgent", "high", "medium", "low"];
const CATEGORIES = ["health", "work", "learning", "personal", "social", "mindfulness", "other"];

const priorityConfig = {
  urgent: { label: "Urgent", bg: "bg-red-50 border-red-200 text-red-600" },
  high:   { label: "High",   bg: "bg-orange-50 border-orange-200 text-orange-600" },
  medium: { label: "Medium", bg: "bg-yellow-50 border-yellow-200 text-yellow-600" },
  low:    { label: "Low",    bg: "bg-slate-50 border-slate-200 text-slate-500" },
};

function TodoFormDialog({ open, onOpenChange, onSubmit, item }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    priority: item?.priority || "medium",
    category: item?.category || "personal",
    due_date: item?.due_date || "",
  });

  React.useEffect(() => {
    setForm({
      name: item?.name || "",
      priority: item?.priority || "medium",
      category: item?.category || "personal",
      due_date: item?.due_date || "",
    });
  }, [item, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit To-Do" : "New To-Do"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Task name</label>
            <Input
              autoFocus
              placeholder="What do you need to do?"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Due date (optional)</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {item ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Pomodoro Widget ──────────────────────────────────────────────────────────
const POMO_MODES = [
  { key: "focus", label: "Focus", color: "from-rose-500 to-orange-500", text: "text-rose-600", defaultMin: 25 },
  { key: "short", label: "Short Break", color: "from-emerald-500 to-teal-500", text: "text-emerald-600", defaultMin: 5 },
  { key: "long", label: "Long Break", color: "from-blue-500 to-indigo-500", text: "text-blue-600", defaultMin: 15 },
];
function padTwo(n) { return String(n).padStart(2, "0"); }

const POMO_KEY = 'pomo_state_v1';
function loadPomoState() {
  try { return JSON.parse(localStorage.getItem(POMO_KEY) || 'null'); } catch { return null; }
}
function savePomoState(state) {
  try { localStorage.setItem(POMO_KEY, JSON.stringify(state)); } catch {}
}

function PomodoroWidget() {
  const [modeKey, setModeKey] = useState("focus");
  const [durations, setDurations] = useState({ focus: 25, short: 5, long: 15 });
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [running, setRunning] = useState(false);
  const [sessions, setSessions] = useState(0);
  const [showSettings, setShowSettings] = useState(false);
  const [settingDraft, setSettingDraft] = useState({ focus: 25, short: 5, long: 15 });
  const intervalRef = useRef(null);
  // Wall-clock refs so we can recover exact remaining time across navigation
  const startTimeRef = useRef(null);    // Date.now() when the current run began
  const secsAtStartRef = useRef(null);  // secondsLeft at that moment

  const mode = POMO_MODES.find(m => m.key === modeKey);
  const totalSeconds = durations[modeKey] * 60;
  const progress = 1 - secondsLeft / totalSeconds;

  // ── Restore persisted state on mount ──────────────────────────────────────
  useEffect(() => {
    const saved = loadPomoState();
    if (!saved) return;
    const d = saved.durations || { focus: 25, short: 5, long: 15 };
    const mk = saved.modeKey || "focus";
    setDurations(d);
    setSettingDraft(d);
    setModeKey(mk);
    setSessions(saved.sessions || 0);

    if (saved.running && saved.startTime != null && saved.secsAtStart != null) {
      const elapsed = Math.floor((Date.now() - saved.startTime) / 1000);
      const remaining = saved.secsAtStart - elapsed;
      if (remaining > 0) {
        // Timer was running while we were away — resume with correct time
        startTimeRef.current = saved.startTime;
        secsAtStartRef.current = saved.secsAtStart;
        setSecondsLeft(remaining);
        setRunning(true);
      } else {
        // Timer finished while navigated away
        setSecondsLeft(0);
        setRunning(false);
        if (mk === "focus") setSessions(s => s + 1);
        savePomoState({ ...saved, running: false, secondsLeft: 0, startTime: null, secsAtStart: null });
      }
    } else {
      setSecondsLeft(saved.secondsLeft ?? (d[mk] || 25) * 60);
      setRunning(false);
    }
  }, []); // only on mount

  // ── Persist state whenever something meaningful changes ────────────────────
  useEffect(() => {
    if (running) {
      savePomoState({
        modeKey, durations, sessions,
        running: true,
        startTime: startTimeRef.current,
        secsAtStart: secsAtStartRef.current,
      });
    } else {
      savePomoState({ modeKey, durations, sessions, running: false, secondsLeft });
    }
  }, [modeKey, durations, sessions, running, secondsLeft]);

  // ── Wall-clock-based timer interval ───────────────────────────────────────
  useEffect(() => {
    if (running) {
      // Set refs only when starting fresh (not when restoring from localStorage)
      if (startTimeRef.current === null) {
        startTimeRef.current = Date.now();
        secsAtStartRef.current = secondsLeft;
      }
      intervalRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000);
        const remaining = (secsAtStartRef.current || 0) - elapsed;
        if (remaining <= 0) {
          clearInterval(intervalRef.current);
          setSecondsLeft(0);
          setRunning(false);
          startTimeRef.current = null;
          secsAtStartRef.current = null;
          if (modeKey === "focus") setSessions(n => n + 1);
          try {
            const ctx = new (window.AudioContext || window.webkitAudioContext)();
            [0, 0.3, 0.6].forEach(offset => {
              const osc = ctx.createOscillator();
              const gain = ctx.createGain();
              osc.connect(gain); gain.connect(ctx.destination);
              osc.frequency.value = 880;
              gain.gain.setValueAtTime(0.3, ctx.currentTime + offset);
              gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + offset + 0.4);
              osc.start(ctx.currentTime + offset);
              osc.stop(ctx.currentTime + offset + 0.4);
            });
          } catch {}
        } else {
          setSecondsLeft(remaining);
        }
      }, 500);
    } else {
      clearInterval(intervalRef.current);
      startTimeRef.current = null;
      secsAtStartRef.current = null;
    }
    return () => clearInterval(intervalRef.current);
  }, [running, modeKey]);

  function switchMode(key) {
    startTimeRef.current = null;
    secsAtStartRef.current = null;
    setModeKey(key);
    setRunning(false);
    setSecondsLeft(durations[key] * 60);
  }

  function reset() {
    startTimeRef.current = null;
    secsAtStartRef.current = null;
    setRunning(false);
    setSecondsLeft(durations[modeKey] * 60);
  }

  function skip() {
    startTimeRef.current = null;
    secsAtStartRef.current = null;
    setRunning(false);
    if (modeKey === "focus") {
      const n = sessions + 1;
      setSessions(n);
      const nextMode = n % 4 === 0 ? "long" : "short";
      setModeKey(nextMode);
      setSecondsLeft(durations[nextMode] * 60);
    } else {
      setModeKey("focus");
      setSecondsLeft(durations["focus"] * 60);
    }
  }

  function saveSettings() {
    startTimeRef.current = null;
    secsAtStartRef.current = null;
    setDurations(settingDraft);
    setSecondsLeft(settingDraft[modeKey] * 60);
    setRunning(false);
    setShowSettings(false);
  }

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const R = 80;
  const circ = 2 * Math.PI * R;
  const dash = circ * (1 - progress);

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-slate-500">{sessions} session{sessions !== 1 ? "s" : ""} completed</p>
        <button onClick={() => { setShowSettings(s => !s); setSettingDraft({ ...durations }); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-slate-700 mb-3">Timer Settings (minutes)</p>
          {[{ key: "focus", label: "Focus" }, { key: "short", label: "Short Break" }, { key: "long", label: "Long Break" }].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between mb-2">
              <span className="text-sm text-slate-600">{label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSettingDraft(d => ({ ...d, [key]: Math.max(1, d[key] - 1) }))}
                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-sm transition">−</button>
                <span className="w-7 text-center text-sm font-bold text-slate-800">{settingDraft[key]}</span>
                <button onClick={() => setSettingDraft(d => ({ ...d, [key]: Math.min(90, d[key] + 1) }))}
                  className="w-6 h-6 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 font-bold flex items-center justify-center text-sm transition">+</button>
              </div>
            </div>
          ))}
          <button onClick={saveSettings}
            className="w-full mt-2 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1.5">
            <Check className="w-3.5 h-3.5" /> Save
          </button>
        </div>
      )}

      {/* Mode tabs */}
      <div className="flex gap-1.5 mb-5 bg-slate-50 border border-slate-200 rounded-xl p-1">
        {POMO_MODES.map(m => (
          <button key={m.key} onClick={() => switchMode(m.key)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              modeKey === m.key ? `bg-gradient-to-r ${m.color} text-white shadow-sm` : "text-slate-500 hover:text-slate-700"
            )}>{m.label}</button>
        ))}
      </div>

      {/* Timer + controls in a row */}
      <div className="flex items-center gap-5">
        {/* SVG Timer */}
        <div className="relative flex-shrink-0">
          <svg width="180" height="180" className="-rotate-90">
            <circle cx="90" cy="90" r={R} fill="none" stroke="#e2e8f0" strokeWidth="8" />
            <circle cx="90" cy="90" r={R} fill="none" strokeWidth="8"
              stroke="url(#pgrd)"
              strokeDasharray={circ}
              strokeDashoffset={dash}
              strokeLinecap="round"
              style={{ transition: "stroke-dashoffset 0.5s ease" }}
            />
            <defs>
              <linearGradient id="pgrd" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={modeKey === "focus" ? "#f43f5e" : modeKey === "short" ? "#10b981" : "#6366f1"} />
                <stop offset="100%" stopColor={modeKey === "focus" ? "#f97316" : modeKey === "short" ? "#14b8a6" : "#3b82f6"} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-slate-800 tabular-nums">{padTwo(mins)}:{padTwo(secs)}</span>
            <span className={cn("text-xs font-semibold mt-0.5", mode.text)}>{mode.label}</span>
          </div>
        </div>

        {/* Controls + dots */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button onClick={reset}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setRunning(r => !r)}
              className={cn("w-14 h-14 rounded-full bg-gradient-to-br text-white shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center", mode.color)}>
              {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button onClick={skip}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center text-slate-500 transition">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-all",
                i < sessions % 4 ? `bg-gradient-to-br ${mode.color}` : "bg-slate-200"
              )} />
            ))}
          </div>
          <p className="text-xs text-slate-400">{4 - (sessions % 4)} more until long break</p>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard ────────────────────────────────────────────────────────────────
function isUpcomingInFiveMinutes(scheduledTime) {
  if (!scheduledTime) return false;
  const now = new Date();
  const [h, m] = scheduledTime.split(':').map(Number);
  const taskTime = new Date();
  taskTime.setHours(h, m, 0, 0);
  const diff = taskTime.getTime() - now.getTime();
  return diff >= 0 && diff <= 5 * 60 * 1000;
}

export default function Dashboard() {
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [showPomodoro, setShowPomodoro] = useState(false);
  const [, setTick] = useState(0);
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");

  // Re-render every minute so the "upcoming in 5 min" highlight stays current
  useEffect(() => {
    const interval = setInterval(() => setTick(t => t + 1), 60_000);
    return () => clearInterval(interval);
  }, []);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  // ── Habits / Tasks ──────────────────────────────────────────────────────
  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.email],
    queryFn: () => user?.email ? base44.entities.Task.filter({ created_by: user.email }) : [],
  });

  React.useEffect(() => {
    const unsub = base44.entities.Task.subscribe(() => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    });
    return unsub;
  }, []);

  const { data: completions = [] } = useQuery({
    queryKey: ["completions", user?.email],
    queryFn: () => user?.email ? base44.entities.TaskCompletion.filter({ created_by: user.email }, "-completed_date", 500) : [],
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.email],
    queryFn: () => user?.email ? base44.entities.UserProfile.filter({ created_by: user.email }) : [],
  });

  const profile = profiles[0];
  const activeTasks = tasks.filter(t => t.is_active !== false);
  const todayCompletions = completions.filter(c => c.completed_date === today);
  const completedTaskIds = new Set(todayCompletions.map(c => c.task_id));

  const dayOfWeek = format(new Date(), "EEEE").toLowerCase();
  const isWeekday = !["saturday", "sunday"].includes(dayOfWeek);
  const todaysTasks = activeTasks.filter(t => {
    // Don't show recurring tasks that haven't started yet (future scheduled_date)
    if (t.scheduled_date && t.scheduled_date > today && t.frequency !== "once") return false;
    if (t.frequency === "once") return t.scheduled_date === today;
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekdays") return isWeekday;
    if (t.frequency === "weekends") return !isWeekday;
    if (t.frequency === dayOfWeek) return true;
    return false;
  });

  const completedToday = todaysTasks.filter(t => completedTaskIds.has(t.id)).length;

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowHabitForm(false);
      toast.success("Habit added!");
    },
  });

  const toggleCompletionMutation = useMutation({
    mutationFn: async (task) => {
      if (completedTaskIds.has(task.id)) {
        const completion = todayCompletions.find(c => c.task_id === task.id);
        if (completion) {
          await base44.entities.TaskCompletion.delete(completion.id);
          await base44.entities.Task.update(task.id, {
            streak: Math.max(0, (task.streak || 0) - 1),
            total_completions: Math.max(0, (task.total_completions || 0) - 1),
          });
        }
      } else {
        await base44.entities.TaskCompletion.create({
          task_id: task.id,
          task_name: task.name,
          completed_date: today,
          completed_at: format(new Date(), "HH:mm"),
        });
        const newStreak = (task.streak || 0) + 1;
        await base44.entities.Task.update(task.id, {
          streak: newStreak,
          best_streak: Math.max(newStreak, task.best_streak || 0),
          total_completions: (task.total_completions || 0) + 1,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const sortedTasks = [...todaysTasks]
    .filter(t => !completedTaskIds.has(t.id))
    .sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));

  // ── To-Do List ───────────────────────────────────────────────────────────
  const { data: todos = [] } = useQuery({
    queryKey: ["todos", user?.email],
    queryFn: () => user?.email ? base44.entities.TodoItem.filter({ created_by: user.email }) : [],
  });

  const pendingTodos = todos
    .filter(t => !t.is_done)
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, medium: 2, low: 3 };
      return (order[a.priority] ?? 2) - (order[b.priority] ?? 2);
    });

  const createTodoMutation = useMutation({
    mutationFn: (data) => base44.entities.TodoItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); toast.success("To-do added!"); },
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); setEditingTodo(null); },
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id) => base44.entities.TodoItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
  });

  const handleTodoSubmit = (data) => {
    if (editingTodo) {
      updateTodoMutation.mutate({ id: editingTodo.id, data });
    } else {
      createTodoMutation.mutate(data);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <GreetingHeader
        userName={user?.full_name}
        overallStreak={profile?.overall_streak || 0}
        tasksToday={todaysTasks.length}
        completedToday={completedToday}
      />

      {/* ── Pomodoro Timer ── */}
      <div className="mb-8">
        <button
          onClick={() => setShowPomodoro(p => !p)}
          className="flex items-center gap-2 mb-4 group"
        >
          <h2 className="text-lg font-bold text-slate-800">Pomodoro Timer</h2>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-rose-50 text-rose-600 text-xs font-semibold border border-rose-200 hover:bg-rose-100 transition">
            <Timer className="w-3.5 h-3.5" />
            {showPomodoro ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </button>
        {showPomodoro && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <PomodoroWidget />
          </motion.div>
        )}
      </div>

      {/* ── Today's Tasks ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">Today's tasks</h2>
        <Button
          onClick={() => setShowHabitForm(true)}
          variant="outline"
          size="sm"
          className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-2 mb-10">
        <AnimatePresence>
          {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isCompleted={completedTaskIds.has(task.id)}
              onToggle={(t) => toggleCompletionMutation.mutate(t)}
              isUpcoming={isUpcomingInFiveMinutes(task.scheduled_time)}
            />
          ))}
        </AnimatePresence>
        {sortedTasks.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-base font-medium">No habits yet</p>
            <p className="text-sm mt-1">Add your first habit to get started!</p>
          </div>
        )}
      </div>

      {/* ── To-Do List ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800">To-Do List</h2>
        <Button
          onClick={() => { setEditingTodo(null); setShowTodoForm(true); }}
          variant="outline"
          size="sm"
          className="rounded-xl border-indigo-200 text-indigo-600 hover:bg-indigo-50"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      <div className="space-y-2 mb-8">
        <AnimatePresence>
          {pendingTodos.map(item => {
            const pc = priorityConfig[item.priority] || priorityConfig.medium;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all group"
              >
                <button
                  onClick={() => updateTodoMutation.mutate({ id: item.id, data: { is_done: true, completed_at: new Date().toISOString() } })}
                  className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", pc.bg)}>
                      <Flag className="w-2.5 h-2.5 inline mr-1" />{pc.label}
                    </span>
                    {item.category && (
                      <span className="text-xs text-slate-400 capitalize">{item.category}</span>
                    )}
                    {item.due_date && (
                      <span className="text-xs text-slate-400">Due {item.due_date}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTodo(item); setShowTodoForm(true); }}>
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => deleteTodoMutation.mutate(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {pendingTodos.length === 0 && (
          <div className="text-center py-10 text-slate-400">
            <p className="text-base font-medium">All clear!</p>
            <p className="text-sm mt-1">Add a to-do item to get started.</p>
          </div>
        )}
      </div>

      {/* ── Reminders ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
          <Bell className="w-5 h-5 text-indigo-500" />
          Reminders
        </h2>
      </div>
      <div className="mb-8 bg-white border border-slate-200 rounded-2xl overflow-hidden" style={{ minHeight: 180 }}>
        <RemindersPanel />
      </div>

      <TaskFormDialog
        open={showHabitForm}
        onOpenChange={setShowHabitForm}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        defaultDate={today}
      />

      <TodoFormDialog
        open={showTodoForm}
        onOpenChange={setShowTodoForm}
        onSubmit={handleTodoSubmit}
        item={editingTodo}
      />
    </div>
  );
}
