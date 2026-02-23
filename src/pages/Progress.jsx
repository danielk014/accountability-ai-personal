import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Flag, RotateCcw, Plus, Trash2, Smartphone } from "lucide-react";
import { format, subDays, parseISO } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runCleanup } from "@/api/localDB";

import TimeActivityChart from "../components/progress/TimeActivityChart";
import SleepChart from "../components/progress/SleepChart";
import ScreentimeAIChat from "../components/screentime/ScreentimeUpload";
import ScreentimeWeekChart from "../components/screentime/ScreentimeWeekChart";

function fmtMins(m) {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

function ScreentimeTab({ profile, saveMutation, user }) {
  const [subTab, setSubTab] = useState("chart");
  const [form, setForm] = useState({ app: "", minutes: "", date: format(new Date(), "yyyy-MM-dd") });

  // User-scoped storage key (email-based to match claudeClient prefix)
  const storageKey = user?.email
    ? `${user.email.toLowerCase().replace(/[^a-z0-9]/g, "_")}__screentime_v2`
    : "screentime_v2_anon";

  function loadLogs() {
    try { return JSON.parse(localStorage.getItem(storageKey) || "[]"); } catch { return []; }
  }
  function saveLogs(logs) {
    localStorage.setItem(storageKey, JSON.stringify(logs));
  }

  const [logs, setLogs] = useState(loadLogs);

  // Trim to 30 days on mount
  useEffect(() => {
    const cutoff = format(subDays(new Date(), 30), "yyyy-MM-dd");
    const trimmed = logs.filter(l => l.date >= cutoff);
    if (trimmed.length !== logs.length) { setLogs(trimmed); saveLogs(trimmed); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.app.trim() || !form.minutes) return;
    const entry = {
      id: Date.now().toString(),
      app: form.app.trim(),
      minutes: parseInt(form.minutes),
      date: form.date,
    };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveLogs(updated);
    setForm(f => ({ ...f, app: "", minutes: "" }));
    toast.success("Logged!");
  };

  const handleDelete = (id) => {
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    saveLogs(updated);
  };

  // Called by AI chat when it extracts entries from a screenshot
  const handleLogEntries = (entries, logDate) => {
    // Replace any existing entries for that date+app combo to avoid duplicates
    const filtered = logs.filter(l => !(l.date === logDate && entries.some(e => e.app === l.app)));
    const updated = [...filtered, ...entries];
    setLogs(updated);
    saveLogs(updated);
    toast.success(`Logged ${entries.length} app${entries.length !== 1 ? "s" : ""} for ${logDate}`);
  };

  // Group by date, newest first
  const grouped = logs.reduce((acc, l) => {
    if (!acc[l.date]) acc[l.date] = [];
    acc[l.date].push(l);
    return acc;
  }, {});
  const sortedDates = Object.keys(grouped).sort((a, b) => b.localeCompare(a));

  return (
    <div className="space-y-6">
      {/* Sub-tabs */}
      <div className="flex gap-1 bg-slate-100 rounded-xl p-1 w-fit">
        {[
          { key: "chart", label: "Chart" },
          { key: "log",   label: "Log"   },
          { key: "ai",    label: "AI"    },
        ].map(({ key, label }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {/* ── Chart ── */}
      {subTab === "chart" && <ScreentimeWeekChart logs={logs} />}

      {/* ── Log ── */}
      {subTab === "log" && (
        <div className="space-y-5">
          {/* Add entry form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Log Screen Time</h3>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
              <input
                value={form.app}
                onChange={e => setForm(f => ({ ...f, app: e.target.value }))}
                placeholder="App name (e.g. Instagram)"
                required
                className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                type="number" min="1"
                value={form.minutes}
                onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
                placeholder="Minutes"
                required
                className="w-28 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <input
                type="date"
                value={form.date}
                onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
                className="w-36 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <button type="submit"
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex-shrink-0">
                <Plus className="w-4 h-4" /> Add
              </button>
            </form>
          </div>

          {/* Apple-style daily cards */}
          {sortedDates.length === 0 ? (
            <div className="text-center py-12 text-slate-400">
              <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No screen time logged yet</p>
              <p className="text-sm mt-1">Add entries above or use the AI tab to upload a screenshot</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => {
                const dayLogs  = grouped[date].sort((a, b) => b.minutes - a.minutes);
                const totalMin = dayLogs.reduce((s, l) => s + l.minutes, 0);
                const maxMin   = dayLogs[0]?.minutes || 1;

                return (
                  <div key={date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    {/* Day header */}
                    <div className="px-5 py-4 flex items-center justify-between border-b border-slate-100">
                      <div>
                        <p className="text-sm font-bold text-slate-800">
                          {format(parseISO(date), "EEEE, MMMM d")}
                        </p>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {dayLogs.length} app{dayLogs.length !== 1 ? "s" : ""}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-bold text-orange-500">{fmtMins(totalMin)}</p>
                        <p className="text-xs text-slate-400">total</p>
                      </div>
                    </div>

                    {/* App rows with progress bars */}
                    <div className="px-5 py-2 divide-y divide-slate-50">
                      {dayLogs.map(entry => {
                        const barPct = Math.round((entry.minutes / maxMin) * 100);
                        return (
                          <div key={entry.id} className="py-3 group">
                            <div className="flex items-center justify-between mb-1.5">
                              <span className="text-sm font-medium text-slate-700">{entry.app}</span>
                              <div className="flex items-center gap-3">
                                <span className="text-sm font-semibold text-slate-500">{fmtMins(entry.minutes)}</span>
                                <button
                                  onClick={() => handleDelete(entry.id)}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-300 hover:text-red-400 transition"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              </div>
                            </div>
                            {/* Horizontal progress bar */}
                            <div className="h-1.5 bg-orange-50 rounded-full overflow-hidden">
                              <div
                                className="h-full bg-orange-400 rounded-full transition-all"
                                style={{ width: `${barPct}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ── AI Chat ── */}
      {subTab === "ai" && (
        <ScreentimeAIChat
          logs={logs}
          onLogEntries={handleLogEntries}
          today={format(new Date(), "yyyy-MM-dd")}
        />
      )}
    </div>
  );
}

const priorityConfig = {
  urgent: { label: "Urgent", bg: "bg-red-50 border-red-200 text-red-600" },
  high:   { label: "High",   bg: "bg-orange-50 border-orange-200 text-orange-600" },
  medium: { label: "Medium", bg: "bg-yellow-50 border-yellow-200 text-yellow-600" },
  low:    { label: "Low",    bg: "bg-slate-50 border-slate-200 text-slate-500" },
};

const categoryColors = {
  health: "bg-emerald-50 text-emerald-600",
  work: "bg-blue-50 text-blue-600",
  learning: "bg-violet-50 text-violet-600",
  personal: "bg-slate-100 text-slate-600",
  social: "bg-pink-50 text-pink-600",
  mindfulness: "bg-amber-50 text-amber-600",
  other: "bg-gray-100 text-gray-600",
};

export default function Progress() {
  const [tab, setTab] = useState("activity");
  const queryClient = useQueryClient();

  // Run cleanup every time this page is opened
  useEffect(() => {
    runCleanup();
    queryClient.invalidateQueries({ queryKey: ["completions"] });
    queryClient.invalidateQueries({ queryKey: ["todos"] });
  }, []);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.email],
    queryFn: () => user?.email ? base44.entities.UserProfile.filter({ created_by: user.email }) : [],
  });
  const profile = profiles[0];

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, data);
      } else {
        await base44.entities.UserProfile.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const { data: tasks = [], isLoading: loadingTasks } = useQuery({
    queryKey: ["tasks", user?.email],
    queryFn: () => user?.email ? base44.entities.Task.filter({ created_by: user.email }) : [],
  });

  const { data: completions = [], isLoading: loadingCompletions } = useQuery({
    queryKey: ["completions", user?.email],
    queryFn: () => user?.email ? base44.entities.TaskCompletion.filter({ created_by: user.email }, "-completed_date", 500) : [],
  });

  const { data: sleep = [], isLoading: loadingSleep } = useQuery({
    queryKey: ["sleep", user?.email],
    queryFn: () => user?.email ? base44.entities.Sleep.filter({ created_by: user.email }, "-date", 100) : [],
  });

  const { data: allTodos = [], isLoading: loadingTodos } = useQuery({
    queryKey: ["todos", user?.email],
    queryFn: () => user?.email ? base44.entities.TodoItem.filter({ created_by: user.email }) : [],
  });

  // Only show completions/todos from the last 7 days
  const cutoffDate = format(subDays(new Date(), 7), "yyyy-MM-dd");
  const cutoffISO = subDays(new Date(), 7).toISOString();

  const recentCompletions = completions.filter(
    c => (c.completed_date || "") >= cutoffDate
  );

  const completedTodos = allTodos.filter(t => {
    if (!t.is_done) return false;
    const ts = t.completed_at || t.created_at;
    return !ts || ts >= cutoffISO;
  });

  const deleteCompletionMutation = useMutation({
    mutationFn: (id) => base44.entities.TaskCompletion.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["completions"] });
      toast.success("Habit marked as incomplete");
    },
  });

  const uncheckTodoMutation = useMutation({
    mutationFn: (id) => base44.entities.TodoItem.update(id, { is_done: false }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["todos"] });
      toast.success("To-do returned to list");
    },
  });

  if (loadingTasks || loadingSleep || loadingCompletions || loadingTodos) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-indigo-500" />
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold text-slate-900 tracking-tight mb-2">Progress</h1>
      <p className="text-slate-500 mb-8">Track your time and sleep patterns.</p>

      {/* Tabs */}
      <div className="flex gap-2 mb-8 border-b border-slate-200">
        {[
          { key: "activity", label: "Activity" },
          { key: "sleep", label: "Sleep" },
          { key: "screentime", label: "Screen Time" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`px-4 py-2 font-medium transition-colors ${
              tab === key
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-600 hover:text-slate-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "activity" && (
        <div className="space-y-8">
          <TimeActivityChart tasks={tasks} completions={recentCompletions} />

          {/* Completed section */}
          <div>
            <h2 className="text-lg font-bold text-slate-800 mb-4">Completed <span className="text-sm font-normal text-slate-400">— last 7 days</span></h2>

            {/* Completed Habits / Tasks */}
            <div className="mb-6">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Completed Habits ({recentCompletions.length})
              </p>
              {recentCompletions.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No completed habits yet.</p>
              ) : (
                <div className="space-y-2">
                  {recentCompletions.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl"
                    >
                      <button
                        onClick={() => deleteCompletionMutation.mutate(c.id)}
                        className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0 hover:bg-slate-200 transition-colors group"
                        title="Mark as incomplete"
                      >
                        <Check className="w-3 h-3 text-white group-hover:hidden" />
                        <RotateCcw className="w-3 h-3 text-slate-500 hidden group-hover:block" />
                      </button>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-slate-700">{c.task_name}</p>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-xs text-slate-400">{c.completed_date}</p>
                        {c.completed_at && (
                          <p className="text-xs text-slate-400">{c.completed_at}</p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Completed To-Dos */}
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">
                Completed To-Dos ({completedTodos.length})
              </p>
              {completedTodos.length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">No completed to-dos yet.</p>
              ) : (
                <div className="space-y-2">
                  {completedTodos.map((item) => {
                    const pc = priorityConfig[item.priority] || priorityConfig.medium;
                    return (
                      <div
                        key={item.id}
                        className="flex items-center gap-3 p-3 bg-white border border-slate-200 rounded-xl"
                      >
                        <button
                          onClick={() => uncheckTodoMutation.mutate(item.id)}
                          className="w-5 h-5 rounded-full bg-emerald-400 flex items-center justify-center flex-shrink-0 hover:bg-slate-200 transition-colors group"
                          title="Return to list"
                        >
                          <Check className="w-3 h-3 text-white group-hover:hidden" />
                          <RotateCcw className="w-3 h-3 text-slate-500 hidden group-hover:block" />
                        </button>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-slate-700 line-through">{item.name}</p>
                          <div className="flex items-center gap-2 mt-1 flex-wrap">
                            <span className={cn("text-xs px-2 py-0.5 rounded-full border", pc.bg)}>
                              <Flag className="w-2.5 h-2.5 inline mr-1" />{pc.label}
                            </span>
                            {item.category && (
                              <span className={cn("text-xs px-2 py-0.5 rounded-full capitalize", categoryColors[item.category])}>
                                {item.category}
                              </span>
                            )}
                          </div>
                        </div>
                        {item.due_date && (
                          <p className="text-xs text-slate-400 flex-shrink-0">Due {item.due_date}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {tab === "sleep" && <SleepChart sleepData={sleep} />}

      {tab === "screentime" && (
        <ScreentimeTab profile={profile} saveMutation={saveMutation} user={user} />
      )}
    </div>
  );
}
