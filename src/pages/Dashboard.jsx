import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Flag, Trash2, Pencil, Check, Bell, Timer, Play, Pause, RotateCcw, SkipForward, Settings2, ChevronDown, ChevronUp, X, BookOpen, GripVertical } from "lucide-react";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
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
  urgent: { label: "Urgent", bg: "bg-[#FF3B30]/[0.08] border-[#FF3B30]/20 text-[#FF3B30]" },
  high:   { label: "High",   bg: "bg-[#FF9500]/[0.08] border-[#FF9500]/20 text-[#FF9500]" },
  medium: { label: "Medium", bg: "bg-[#FFCC00]/[0.08] border-[#FFCC00]/20 text-[#A68A00]" },
  low:    { label: "Low",    bg: "bg-[hsl(220,14%,96%)] border-[hsl(220,13%,93%)] text-[hsl(220,9%,46%)]" },
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
            <label className="text-sm font-medium text-[hsl(220,9%,30%)] mb-1 block">Task name</label>
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
              <label className="text-sm font-medium text-[hsl(220,9%,30%)] mb-1 block">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-[hsl(220,9%,30%)] mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-[hsl(220,9%,30%)] mb-1 block">Due date (optional)</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-xl bg-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,45%)]">
              {item ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Book Form Dialog ────────────────────────────────────────────────────────
function BookFormDialog({ open, onOpenChange, onSubmit, item }) {
  const [form, setForm] = useState({
    title: item?.title || "",
    author: item?.author || "",
    current_page: item?.current_page || 0,
    total_pages: item?.total_pages || 0,
  });

  React.useEffect(() => {
    setForm({
      title: item?.title || "",
      author: item?.author || "",
      current_page: item?.current_page || 0,
      total_pages: item?.total_pages || 0,
    });
  }, [item, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    onSubmit({
      title: form.title.trim(),
      author: form.author.trim(),
      current_page: Number(form.current_page) || 0,
      total_pages: Number(form.total_pages) || 0,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl">
        <DialogHeader>
          <DialogTitle>{item ? "Edit Book" : "Add Book"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-xs font-medium text-[hsl(220,9%,46%)] mb-1 block">Title</label>
            <Input
              className="rounded-xl"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Book title"
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs font-medium text-[hsl(220,9%,46%)] mb-1 block">Author</label>
            <Input
              className="rounded-xl"
              value={form.author}
              onChange={e => setForm(f => ({ ...f, author: e.target.value }))}
              placeholder="Author name"
            />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="text-xs font-medium text-[hsl(220,9%,46%)] mb-1 block">Current Page</label>
              <Input
                className="rounded-xl"
                type="number"
                min="0"
                value={form.current_page}
                onChange={e => setForm(f => ({ ...f, current_page: e.target.value }))}
              />
            </div>
            <div className="flex-1">
              <label className="text-xs font-medium text-[hsl(220,9%,46%)] mb-1 block">Total Pages</label>
              <Input
                className="rounded-xl"
                type="number"
                min="0"
                value={form.total_pages}
                onChange={e => setForm(f => ({ ...f, total_pages: e.target.value }))}
              />
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-xl bg-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,45%)]">
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
  { key: "focus", label: "Focus", color: "from-[#FF3B30] to-[#FF9500]", text: "text-[#FF3B30]", defaultMin: 25 },
  { key: "short", label: "Short Break", color: "from-[#34C759] to-[#30D158]", text: "text-[#34C759]", defaultMin: 5 },
  { key: "long", label: "Long Break", color: "from-[#007AFF] to-[#5856D6]", text: "text-[#007AFF]", defaultMin: 15 },
];
function padTwo(n) { return String(n).padStart(2, "0"); }

const POMO_KEY = 'pomo_state_v1';
function loadPomoState() {
  try { return JSON.parse(localStorage.getItem(POMO_KEY) || 'null'); } catch { return null; }
}
function savePomoState(state) {
  try { localStorage.setItem(POMO_KEY, JSON.stringify(state)); } catch {}
}

function playBell() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    // Three bell rings — each has fundamental + harmonics with natural decay
    [0, 0.55, 1.1].forEach(ringOffset => {
      [[800, 0.5], [1600, 0.25], [2400, 0.12]].forEach(([freq, vol]) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.value = freq;
        gain.gain.setValueAtTime(vol, ctx.currentTime + ringOffset);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + ringOffset + 0.9);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(ctx.currentTime + ringOffset);
        osc.stop(ctx.currentTime + ringOffset + 0.9);
      });
    });
  } catch {}
}

function PomodoroWidget({ onComplete }) {
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
          playBell();
          onComplete?.(modeKey);
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
    <div className="bg-white border border-[hsl(220,13%,93%)] rounded-2xl p-5 shadow-sm shadow-black/[0.04]">
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-[hsl(220,9%,46%)]">{sessions} session{sessions !== 1 ? "s" : ""} completed</p>
        <button onClick={() => { setShowSettings(s => !s); setSettingDraft({ ...durations }); }}
          className="p-1.5 rounded-lg hover:bg-[hsl(220,14%,96%)] text-[hsl(220,9%,55%)] hover:text-[hsl(220,9%,30%)] transition-all duration-200">
          <Settings2 className="w-4 h-4" />
        </button>
      </div>

      {showSettings && (
        <div className="bg-[hsl(220,14%,96%)] border border-[hsl(220,13%,93%)] rounded-xl p-4 mb-4">
          <p className="text-xs font-bold text-[hsl(220,9%,30%)] mb-3">Timer Settings (minutes)</p>
          {[{ key: "focus", label: "Focus" }, { key: "short", label: "Short Break" }, { key: "long", label: "Long Break" }].map(({ key, label }) => (
            <div key={key} className="flex items-center justify-between mb-2">
              <span className="text-sm text-[hsl(220,9%,40%)]">{label}</span>
              <div className="flex items-center gap-2">
                <button onClick={() => setSettingDraft(d => ({ ...d, [key]: Math.max(1, d[key] - 1) }))}
                  className="w-6 h-6 rounded-lg bg-[hsl(220,13%,90%)] hover:bg-[hsl(220,13%,85%)] text-[hsl(220,9%,30%)] font-bold flex items-center justify-center text-sm transition">−</button>
                <span className="w-7 text-center text-sm font-bold text-[hsl(220,13%,10%)]">{settingDraft[key]}</span>
                <button onClick={() => setSettingDraft(d => ({ ...d, [key]: Math.min(90, d[key] + 1) }))}
                  className="w-6 h-6 rounded-lg bg-[hsl(220,13%,90%)] hover:bg-[hsl(220,13%,85%)] text-[hsl(220,9%,30%)] font-bold flex items-center justify-center text-sm transition">+</button>
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
      <div className="flex gap-1.5 mb-5 bg-[hsl(220,14%,96%)] border border-[hsl(220,13%,93%)] rounded-xl p-1">
        {POMO_MODES.map(m => (
          <button key={m.key} onClick={() => switchMode(m.key)}
            className={cn("flex-1 py-1.5 rounded-lg text-xs font-semibold transition-all",
              modeKey === m.key ? `bg-gradient-to-r ${m.color} text-white shadow-sm` : "text-[hsl(220,9%,46%)] hover:text-[hsl(220,9%,30%)]"
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
                <stop offset="0%" stopColor={modeKey === "focus" ? "#FF3B30" : modeKey === "short" ? "#34C759" : "#007AFF"} />
                <stop offset="100%" stopColor={modeKey === "focus" ? "#FF9500" : modeKey === "short" ? "#30D158" : "#5856D6"} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-4xl font-bold text-[hsl(220,13%,10%)] tabular-nums">{padTwo(mins)}:{padTwo(secs)}</span>
            <span className={cn("text-xs font-semibold mt-0.5", mode.text)}>{mode.label}</span>
          </div>
        </div>

        {/* Controls + dots */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center gap-2">
            <button onClick={reset}
              className="w-9 h-9 rounded-full bg-[hsl(220,14%,94%)] hover:bg-[hsl(220,13%,90%)] flex items-center justify-center text-[hsl(220,9%,46%)] transition">
              <RotateCcw className="w-4 h-4" />
            </button>
            <button onClick={() => setRunning(r => !r)}
              className={cn("w-14 h-14 rounded-full bg-gradient-to-br text-white shadow-md hover:shadow-lg hover:scale-105 transition-all flex items-center justify-center", mode.color)}>
              {running ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
            </button>
            <button onClick={skip}
              className="w-9 h-9 rounded-full bg-[hsl(220,14%,94%)] hover:bg-[hsl(220,13%,90%)] flex items-center justify-center text-[hsl(220,9%,46%)] transition">
              <SkipForward className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-1.5">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className={cn("w-2.5 h-2.5 rounded-full transition-all",
                i < sessions % 4 ? `bg-gradient-to-br ${mode.color}` : "bg-[hsl(220,13%,90%)]"
              )} />
            ))}
          </div>
          <p className="text-xs text-[hsl(220,9%,55%)]">{4 - (sessions % 4)} more until long break</p>
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
  const [activeTab, setActiveTab] = useState("home");
  const [showHabitForm, setShowHabitForm] = useState(false);
  const [showTodoForm, setShowTodoForm] = useState(false);
  const [editingTodo, setEditingTodo] = useState(null);
  const [showBookForm, setShowBookForm] = useState(false);
  const [editingBook, setEditingBook] = useState(null);
  const [showPomodoro, setShowPomodoro] = useState(() => {
    try { return localStorage.getItem('pomo_open_v1') === 'true'; } catch { return false; }
  });
  const [pomoFinished, setPomoFinished] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pomo_finished_notif') || 'null'); } catch { return null; }
  });
  const [, setTick] = useState(0);

  function handlePomoToggle() {
    setShowPomodoro(p => {
      const next = !p;
      try { localStorage.setItem('pomo_open_v1', String(next)); } catch {}
      return next;
    });
  }

  function handlePomoComplete(mode) {
    const notif = { mode, time: Date.now() };
    setPomoFinished(notif);
    try { localStorage.setItem('pomo_finished_notif', JSON.stringify(notif)); } catch {}
    toast.success(mode === 'focus' ? '🎉 Focus session done! Take a break.' : '⏰ Break over — back to work!', { duration: 6000 });
  }

  function dismissPomoNotif() {
    setPomoFinished(null);
    try { localStorage.removeItem('pomo_finished_notif'); } catch {}
  }
  const queryClient = useQueryClient();
  const today = format(new Date(), "yyyy-MM-dd");
  const tomorrow = format(new Date(Date.now() + 86400000), "yyyy-MM-dd");

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
    onError: (err) => toast.error("Failed to add habit: " + err.message),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (id) => base44.entities.Task.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
    onError: (err) => toast.error("Failed to delete task: " + err.message),
  });

  const deleteTaskWithConfirm = (task) => {
    if (!window.confirm(`Delete "${task.name}"?`)) return;
    if (!window.confirm("This is permanent and cannot be undone. Delete anyway?")) return;
    deleteTaskMutation.mutate(task.id);
  };

  const toggleCompletionMutation = useMutation({
    onMutate: async (task) => {
      await queryClient.cancelQueries({ queryKey: ["completions", user?.email] });
      const prev = queryClient.getQueryData(["completions", user?.email]) || [];
      if (completedTaskIds.has(task.id)) {
        queryClient.setQueryData(["completions", user?.email],
          prev.filter(c => !(c.task_id === task.id && c.completed_date === today))
        );
      } else {
        queryClient.setQueryData(["completions", user?.email], [
          ...prev,
          { id: `tmp_${Date.now()}`, task_id: task.id, task_name: task.name, completed_date: today, completed_at: format(new Date(), "HH:mm"), created_by: user?.email },
        ]);
      }
      return { prev };
    },
    mutationFn: async (task) => {
      if (completedTaskIds.has(task.id)) {
        const completion = todayCompletions.find(c => c.task_id === task.id);
        if (completion) {
          await base44.entities.TaskCompletion.delete(completion.id);
          const updates = {
            streak: Math.max(0, (task.streak || 0) - 1),
            total_completions: Math.max(0, (task.total_completions || 0) - 1),
          };
          if (task.frequency === "once") updates.is_active = true;
          await base44.entities.Task.update(task.id, updates);
        }
      } else {
        await base44.entities.TaskCompletion.create({
          task_id: task.id,
          task_name: task.name,
          completed_date: today,
          completed_at: format(new Date(), "HH:mm"),
        });
        if (task.frequency === "once") {
          await base44.entities.Task.delete(task.id);
        } else {
          const newStreak = (task.streak || 0) + 1;
          await base44.entities.Task.update(task.id, {
            streak: newStreak,
            best_streak: Math.max(newStreak, task.best_streak || 0),
            total_completions: (task.total_completions || 0) + 1,
          });
        }
      }
    },
    onError: (_err, _task, ctx) => {
      if (ctx?.prev) queryClient.setQueryData(["completions", user?.email], ctx.prev);
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const sortedTasks = [...todaysTasks]
    .filter(t => !completedTaskIds.has(t.id))
    .sort((a, b) => (a.scheduled_time || "99:99").localeCompare(b.scheduled_time || "99:99"));

  // Overdue: once-tasks scheduled before today that were never completed
  const overdueTasks = activeTasks.filter(t => {
    if (t.frequency !== "once") return false;
    if (!t.scheduled_date || t.scheduled_date >= today) return false;
    return !completions.some(c => c.task_id === t.id);
  });

  const tomorrowDayOfWeek = format(new Date(Date.now() + 86400000), "EEEE").toLowerCase();
  const isTomorrowWeekday = !["saturday", "sunday"].includes(tomorrowDayOfWeek);
  const tomorrowsTasks = activeTasks
    .filter(t => {
      if (t.scheduled_date && t.scheduled_date > tomorrow && t.frequency !== "once") return false;
      if (t.frequency === "once") return t.scheduled_date === tomorrow;
      if (t.frequency === "daily") return true;
      if (t.frequency === "weekdays") return isTomorrowWeekday;
      if (t.frequency === "weekends") return !isTomorrowWeekday;
      if (t.frequency === tomorrowDayOfWeek) return true;
      return false;
    })
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
    onError: (err) => toast.error("Failed to add to-do: " + err.message),
  });

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); setEditingTodo(null); },
    onError: (err) => toast.error("Failed to update to-do: " + err.message),
  });

  const deleteTodoMutation = useMutation({
    mutationFn: (id) => base44.entities.TodoItem.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["todos"] }),
    onError: (err) => toast.error("Failed to delete to-do: " + err.message),
  });

  const handleTodoSubmit = (data) => {
    if (editingTodo) {
      updateTodoMutation.mutate({ id: editingTodo.id, data });
    } else {
      createTodoMutation.mutate(data);
    }
  };

  // ── Books ──────────────────────────────────────────────────────────────
  const { data: books = [] } = useQuery({
    queryKey: ["books", user?.email],
    queryFn: () => user?.email ? base44.entities.Book.filter({ created_by: user.email }) : [],
  });

  const createBookMutation = useMutation({
    mutationFn: (data) => base44.entities.Book.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["books"] }); toast.success("Book added!"); },
    onError: (err) => toast.error("Failed to add book: " + err.message),
  });

  const updateBookMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Book.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["books"] }); setEditingBook(null); },
    onError: (err) => toast.error("Failed to update book: " + err.message),
  });

  const deleteBookMutation = useMutation({
    mutationFn: (id) => base44.entities.Book.delete(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["books"] }),
    onError: (err) => toast.error("Failed to delete book: " + err.message),
  });

  const handleBookSubmit = (data) => {
    if (editingBook) {
      updateBookMutation.mutate({ id: editingBook.id, data });
    } else {
      createBookMutation.mutate({ ...data, order: books.length });
    }
  };

  // Sort books by user-defined order
  const sortedBooks = [...books].sort((a, b) => (a.order ?? 9999) - (b.order ?? 9999));

  const handleBookDragEnd = (result) => {
    if (!result.destination || result.source.index === result.destination.index) return;
    const reordered = Array.from(sortedBooks);
    const [moved] = reordered.splice(result.source.index, 1);
    reordered.splice(result.destination.index, 0, moved);
    // Update order for all affected books
    reordered.forEach((book, i) => {
      if (book.order !== i) {
        updateBookMutation.mutate({ id: book.id, data: { order: i } });
      }
    });
  };

  return (
    <div className="max-w-2xl mx-auto px-5 py-10">
      <GreetingHeader
        userName={user?.full_name}
        overallStreak={profile?.overall_streak || 0}
        tasksToday={todaysTasks.length}
        completedToday={completedToday}
      />

      {/* ── Tabs ── */}
      <div className="flex gap-1 mb-8 p-1 bg-[hsl(220,14%,96%)] rounded-2xl">
        {[
          { key: "home", label: "Home" },
          { key: "books", label: "Books", icon: BookOpen },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={cn(
              "flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all duration-200",
              activeTab === tab.key
                ? "bg-white text-[hsl(220,13%,10%)] shadow-sm"
                : "text-[hsl(220,9%,46%)] hover:text-[hsl(220,13%,10%)]"
            )}
          >
            {tab.icon && <tab.icon className="w-4 h-4" />}
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "home" && <>
      {/* ── Pomodoro Timer ── */}
      <div className="mb-8">
        <button
          onClick={handlePomoToggle}
          className="flex items-center gap-2 mb-4 group"
        >
          <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">Pomodoro Timer</h2>
          <span className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#FF3B30]/[0.08] text-[#FF3B30] text-xs font-semibold border border-[#FF3B30]/15 hover:bg-[#FF3B30]/[0.12] transition-all duration-200">
            <Timer className="w-3.5 h-3.5" />
            {showPomodoro ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </span>
        </button>

        {/* Completion notification banner */}
        {pomoFinished && (
          <div className="flex items-center justify-between gap-3 mb-3 px-4 py-3 rounded-xl bg-[#34C759]/[0.08] border border-[#34C759]/15 text-[#248A3D] text-sm font-medium">
            <span>
              {pomoFinished.mode === 'focus' ? '🎉 Focus session complete! Time for a break.' : '⏰ Break finished — ready to focus?'}
            </span>
            <button onClick={dismissPomoNotif} className="text-[#34C759] hover:text-[#248A3D] transition-all duration-200 flex-shrink-0">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {showPomodoro && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
          >
            <PomodoroWidget onComplete={handlePomoComplete} />
          </motion.div>
        )}
      </div>

      {/* ── Today's Tasks ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">Today's tasks</h2>
        <Button
          onClick={() => setShowHabitForm(true)}
          variant="outline"
          size="sm"
          className="rounded-xl border-[hsl(211,100%,85%)] text-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,97%)]"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add
        </Button>
      </div>

      {/* Overdue tasks */}
      {overdueTasks.length > 0 && (
        <div className="mb-4">
          <p className="text-xs font-semibold text-[#FF3B30] uppercase tracking-wide mb-2 flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-[#FF3B30] inline-block" />
            Overdue
          </p>
          <div className="space-y-2">
            {overdueTasks.map(task => (
              <TaskCard
                key={task.id}
                task={task}
                isCompleted={completedTaskIds.has(task.id)}
                onToggle={(t) => toggleCompletionMutation.mutate(t)}
                onDelete={deleteTaskWithConfirm}
                isUpcoming={false}
              />
            ))}
          </div>
        </div>
      )}

      <div className="space-y-2 mb-10">
        <AnimatePresence>
          {sortedTasks.map(task => (
            <TaskCard
              key={task.id}
              task={task}
              isCompleted={completedTaskIds.has(task.id)}
              onToggle={(t) => toggleCompletionMutation.mutate(t)}
              onDelete={deleteTaskWithConfirm}
              isUpcoming={isUpcomingInFiveMinutes(task.scheduled_time)}
            />
          ))}
        </AnimatePresence>

        {sortedTasks.length === 0 && (
          <div className="text-center py-10 text-[hsl(220,9%,55%)]">
            <p className="text-base font-medium">No habits yet</p>
            <p className="text-sm mt-1">Add your first habit to get started!</p>
          </div>
        )}
      </div>

      {/* ── Tomorrow's Tasks ── */}
      {tomorrowsTasks.length > 0 && (
        <div className="mb-10">
          <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)] mb-4">
            Tomorrow's tasks
            <span className="ml-2 text-xs font-semibold text-[hsl(220,9%,55%)] bg-[hsl(220,14%,94%)] rounded-full px-2 py-0.5">{tomorrowsTasks.length}</span>
          </h2>
          <div className="space-y-2">
            {tomorrowsTasks.map(task => (
              <div key={task.id} className="flex items-center gap-3 p-3 bg-white border border-[hsl(220,13%,95%)] rounded-2xl opacity-75">
                <div className="w-4 h-4 rounded-full border-2 border-[hsl(220,13%,93%)] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-[hsl(220,9%,40%)]">{task.name}</p>
                  {task.scheduled_time && (
                    <p className="text-xs text-[hsl(220,9%,55%)] mt-0.5">{task.scheduled_time}</p>
                  )}
                </div>
                {task.category && (
                  <span className="text-xs text-[hsl(220,9%,55%)] capitalize">{task.category}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── To-Do List ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)]">To-Do List</h2>
        <Button
          onClick={() => { setEditingTodo(null); setShowTodoForm(true); }}
          variant="outline"
          size="sm"
          className="rounded-xl border-[hsl(211,100%,85%)] text-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,97%)]"
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
                className="flex items-center gap-4 p-4 bg-white border border-[hsl(220,13%,93%)] rounded-2xl hover:shadow-md transition-all group"
              >
                <button
                  onClick={() => updateTodoMutation.mutate({ id: item.id, data: { is_done: true, completed_at: new Date().toISOString() } })}
                  className="w-5 h-5 rounded-full border-2 border-[hsl(220,13%,85%)] hover:border-[hsl(211,100%,50%)] flex items-center justify-center transition-colors flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-[hsl(220,13%,10%)]">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className={cn("text-xs px-2 py-0.5 rounded-full border", pc.bg)}>
                      <Flag className="w-2.5 h-2.5 inline mr-1" />{pc.label}
                    </span>
                    {item.category && (
                      <span className="text-xs text-[hsl(220,9%,55%)] capitalize">{item.category}</span>
                    )}
                    {item.due_date && (
                      <span className="text-xs text-[hsl(220,9%,55%)]">Due {item.due_date}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingTodo(item); setShowTodoForm(true); }}>
                    <Pencil className="w-4 h-4 text-[hsl(220,9%,55%)]" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                    if (!window.confirm(`Delete "${item.name}"?`)) return;
                    if (!window.confirm("This is permanent and cannot be undone. Delete anyway?")) return;
                    deleteTodoMutation.mutate(item.id);
                  }}>
                    <Trash2 className="w-4 h-4 text-[#FF3B30]/70" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {pendingTodos.length === 0 && (
          <div className="text-center py-10 text-[hsl(220,9%,55%)]">
            <p className="text-base font-medium">All clear!</p>
            <p className="text-sm mt-1">Add a to-do item to get started.</p>
          </div>
        )}
      </div>

      {/* ── Reminders ── */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)] flex items-center gap-2">
          <Bell className="w-5 h-5 text-[hsl(211,100%,50%)]" />
          Reminders
        </h2>
      </div>
      <div className="mb-8 bg-white border border-[hsl(220,13%,93%)] rounded-2xl overflow-hidden" style={{ minHeight: 180 }}>
        <RemindersPanel />
      </div>
      </>}

      {/* ── Books Tab ── */}
      {activeTab === "books" && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-lg font-semibold text-[hsl(220,13%,10%)] flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-[hsl(211,100%,50%)]" />
              Books to Read
              {books.length > 0 && (
                <span className="text-xs font-semibold text-[hsl(220,9%,55%)] bg-[hsl(220,14%,94%)] rounded-full px-2 py-0.5">{books.length}</span>
              )}
            </h2>
            <Button
              onClick={() => { setEditingBook(null); setShowBookForm(true); }}
              variant="outline"
              size="sm"
              className="rounded-xl border-[hsl(211,100%,85%)] text-[hsl(211,100%,50%)] hover:bg-[hsl(211,100%,97%)]"
            >
              <Plus className="w-4 h-4 mr-1" />
              Add
            </Button>
          </div>

          <DragDropContext onDragEnd={handleBookDragEnd}>
            <Droppable droppableId="books-list">
              {(provided) => (
                <div className="space-y-3" ref={provided.innerRef} {...provided.droppableProps}>
              {sortedBooks.map((book, index) => {
                const pct = book.total_pages > 0 ? Math.round((book.current_page / book.total_pages) * 100) : 0;
                const statusLabel = pct === 0 ? "To Read" : pct >= 100 ? "Finished" : "Reading";
                const statusColor = pct === 0 ? "text-[hsl(220,9%,55%)] bg-[hsl(220,14%,96%)] border-[hsl(220,13%,93%)]"
                  : pct >= 100 ? "text-[#34C759] bg-[#34C759]/[0.08] border-[#34C759]/20"
                  : "text-[hsl(211,100%,50%)] bg-[hsl(211,100%,50%)]/[0.08] border-[hsl(211,100%,50%)]/20";

                return (
                  <Draggable key={book.id} draggableId={book.id} index={index}>
                    {(provided, snapshot) => (
                    <div
                      ref={provided.innerRef}
                      {...provided.draggableProps}
                      className={cn(
                        "p-4 bg-white border border-[hsl(220,13%,93%)] rounded-2xl hover:shadow-md transition-all group",
                        snapshot.isDragging && "shadow-lg ring-2 ring-[hsl(211,100%,50%)]/20"
                      )}
                    >
                    <div className="flex items-start gap-3">
                      {/* Drag handle */}
                      <div
                        {...provided.dragHandleProps}
                        className="flex-shrink-0 pt-1 cursor-grab active:cursor-grabbing touch-manipulation"
                      >
                        <GripVertical className="w-4 h-4 text-[hsl(220,9%,70%)]" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <p className="font-semibold text-sm text-[hsl(220,13%,10%)] truncate">{book.title}</p>
                          <span className={cn("text-xs px-2 py-0.5 rounded-full border flex-shrink-0", statusColor)}>
                            {statusLabel}
                          </span>
                        </div>
                        {book.author && (
                          <p className="text-xs text-[hsl(220,9%,55%)] mb-2">by {book.author}</p>
                        )}
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-[hsl(220,14%,96%)] rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{
                                width: `${Math.min(pct, 100)}%`,
                                background: pct >= 100
                                  ? "linear-gradient(90deg, #34C759, #30D158)"
                                  : "linear-gradient(90deg, hsl(211,100%,50%), hsl(211,100%,60%))",
                              }}
                            />
                          </div>
                          <span className="text-xs font-medium text-[hsl(220,9%,46%)] tabular-nums flex-shrink-0 w-10 text-right">
                            {pct}%
                          </span>
                        </div>
                        {book.total_pages > 0 && (
                          <p className="text-xs text-[hsl(220,9%,55%)] mt-1 tabular-nums">
                            {book.current_page} / {book.total_pages} pages
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingBook(book); setShowBookForm(true); }}>
                          <Pencil className="w-4 h-4 text-[hsl(220,9%,55%)]" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                          if (!window.confirm(`Delete "${book.title}"?`)) return;
                          if (!window.confirm("This is permanent and cannot be undone. Delete anyway?")) return;
                          deleteBookMutation.mutate(book.id);
                        }}>
                          <Trash2 className="w-4 h-4 text-[#FF3B30]/70" />
                        </Button>
                      </div>
                    </div>
                    </div>
                    )}
                  </Draggable>
                );
              })}
              {provided.placeholder}
                </div>
              )}
            </Droppable>
          </DragDropContext>
            {books.length === 0 && (
              <div className="text-center py-10 text-[hsl(220,9%,55%)]">
                <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-base font-medium">No books yet</p>
                <p className="text-sm mt-1">Add your first book to start tracking your reading.</p>
              </div>
            )}
        </div>
      )}

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

      <BookFormDialog
        open={showBookForm}
        onOpenChange={setShowBookForm}
        onSubmit={handleBookSubmit}
        item={editingBook}
      />
    </div>
  );
}
