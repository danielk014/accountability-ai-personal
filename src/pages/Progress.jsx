import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, Check, Flag, RotateCcw } from "lucide-react";
import { format, subDays } from "date-fns";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { runCleanup } from "@/api/supabaseDB";

import TimeActivityChart from "../components/progress/TimeActivityChart";
import SleepChart from "../components/progress/SleepChart";



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

        </div>
      )}

      {tab === "sleep" && <SleepChart sleepData={sleep} />}
    </div>
  );
}
