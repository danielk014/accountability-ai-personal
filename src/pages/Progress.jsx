import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Flag, RotateCcw, Plus, Trash2, Smartphone, Brain, Upload } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runCleanup } from "@/api/localDB";

import TimeActivityChart from "../components/progress/TimeActivityChart";
import SleepChart from "../components/progress/SleepChart";
import ScreentimeUpload from "../components/screentime/ScreentimeUpload";

const SCREENTIME_KEY = "accountable_screentime_manual_v1";

function loadScreentimeLogs() {
  try { return JSON.parse(localStorage.getItem(SCREENTIME_KEY) || "[]"); } catch { return []; }
}
function saveScreentimeLogs(logs) {
  localStorage.setItem(SCREENTIME_KEY, JSON.stringify(logs));
}

function ScreentimeTab({ profile, saveMutation }) {
  const [subTab, setSubTab] = useState("log");
  const [logs, setLogs] = useState(loadScreentimeLogs);
  const [form, setForm] = useState({ app: "", minutes: "", date: format(new Date(), "yyyy-MM-dd") });

  const handleAdd = (e) => {
    e.preventDefault();
    if (!form.app.trim() || !form.minutes) return;
    const entry = { id: Date.now().toString(), app: form.app.trim(), minutes: parseInt(form.minutes), date: form.date };
    const updated = [entry, ...logs];
    setLogs(updated);
    saveScreentimeLogs(updated);
    setForm(f => ({ ...f, app: "", minutes: "" }));
    toast.success("Logged!");
  };

  const handleDelete = (id) => {
    if (!window.confirm("Delete this screentime entry?")) return;
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    const updated = logs.filter(l => l.id !== id);
    setLogs(updated);
    saveScreentimeLogs(updated);
  };

  // Group logs by date
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
        {[{ key: "log", label: "Log", icon: Smartphone }, { key: "ai", label: "AI", icon: Brain }].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setSubTab(key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              subTab === key ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}>
            <Icon className="w-4 h-4" />{label}
          </button>
        ))}
      </div>

      {subTab === "log" && (
        <div className="space-y-6">
          {/* Manual log form */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5">
            <h3 className="text-sm font-bold text-slate-700 mb-4">Log Screen Time</h3>
            <form onSubmit={handleAdd} className="flex flex-col sm:flex-row gap-3">
              <input
                value={form.app}
                onChange={e => setForm(f => ({ ...f, app: e.target.value }))}
                placeholder="App name (e.g. Instagram)"
                className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
              />
              <input
                type="number"
                value={form.minutes}
                onChange={e => setForm(f => ({ ...f, minutes: e.target.value }))}
                placeholder="Minutes"
                min="1"
                className="w-28 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300"
                required
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

          {/* Log entries */}
          {sortedDates.length === 0 ? (
            <div className="text-center py-10 text-slate-400">
              <Smartphone className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">No entries yet</p>
              <p className="text-sm mt-1">Log your screen time above or use the AI tab to upload screenshots</p>
            </div>
          ) : (
            <div className="space-y-4">
              {sortedDates.map(date => {
                const dayLogs = grouped[date];
                const totalMin = dayLogs.reduce((s, l) => s + l.minutes, 0);
                const totalHr = Math.floor(totalMin / 60);
                const remMin = totalMin % 60;
                return (
                  <div key={date} className="bg-white border border-slate-200 rounded-2xl overflow-hidden">
                    <div className="px-4 py-3 bg-slate-50 border-b border-slate-100 flex justify-between items-center">
                      <span className="text-sm font-bold text-slate-700">{date}</span>
                      <span className="text-xs text-slate-500">{totalHr > 0 ? `${totalHr}h ` : ""}{remMin}m total</span>
                    </div>
                    <div className="divide-y divide-slate-50">
                      {dayLogs.sort((a, b) => b.minutes - a.minutes).map(entry => (
                        <div key={entry.id} className="flex items-center gap-3 px-4 py-2.5 group">
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-slate-800">{entry.app}</p>
                          </div>
                          <span className="text-sm text-slate-500 flex-shrink-0">
                            {Math.floor(entry.minutes / 60) > 0 ? `${Math.floor(entry.minutes / 60)}h ` : ""}{entry.minutes % 60}m
                          </span>
                          <button
                            onClick={() => handleDelete(entry.id)}
                            className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition flex-shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {subTab === "ai" && (
        <div className="space-y-4">
          <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
            <div className="flex items-start gap-3">
              <Brain className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-blue-800">AI Screen Time Logger</p>
                <p className="text-xs text-blue-600 mt-0.5">Upload screenshots of your screen time (from iPhone Settings or Android Digital Wellbeing) and the AI will analyze and log them for you.</p>
              </div>
            </div>
          </div>
          <ScreentimeUpload profile={profile} saveMutation={saveMutation} />
        </div>
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
        <ScreentimeTab profile={profile} saveMutation={saveMutation} />
      )}
    </div>
  );
}
