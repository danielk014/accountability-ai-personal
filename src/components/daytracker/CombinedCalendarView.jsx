import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DayView from "@/components/schedule/DayView.jsx";
import WeekView from "@/components/schedule/WeekView.jsx";
import TaskSidebar from "@/components/schedule/TaskSidebar.jsx";
import TaskFormDialog from "@/components/tasks/TaskFormDialog.jsx";
import CalendarPicker from "@/components/schedule/CalendarPicker.jsx";
import CalendarView from "./CalendarView";
import { loadBlocks, getDateStr } from "./storage";

export default function CombinedCalendarView({ onDaySelect, forceView }) {
  const [internalView, setInternalView] = useState("day");
  const view = forceView || internalView;
  const setView = forceView ? () => {} : setInternalView;
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mobileDrag, setMobileDrag] = useState(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [blockRefreshKey, setBlockRefreshKey] = useState(0);

  useEffect(() => {
    const handler = () => setBlockRefreshKey(k => k + 1);
    window.addEventListener('daytracker-data-refreshed', handler);
    return () => window.removeEventListener('daytracker-data-refreshed', handler);
  }, []);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

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
  const timezone = profiles[0]?.timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";

  const toggleCompletionMutation = useMutation({
    onMutate: async ({ task, date }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      await queryClient.cancelQueries({ queryKey: ["completions"] });
      const prev = queryClient.getQueryData(["completions", user?.email]);
      const existing = (prev || []).find(c => c.task_id === task.id && c.completed_date === dateStr);
      if (existing) {
        queryClient.setQueryData(["completions", user?.email], (old = []) => old.filter(c => c.id !== existing.id));
      } else {
        const optimistic = { id: `opt-${Date.now()}`, task_id: task.id, task_name: task.name, completed_date: dateStr, completed_at: format(new Date(), "HH:mm") };
        queryClient.setQueryData(["completions", user?.email], (old = []) => [...old, optimistic]);
      }
      return { prev };
    },
    mutationFn: async ({ task, date }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const existing = completions.find(c => c.task_id === task.id && c.completed_date === dateStr);
      if (existing) {
        await base44.entities.TaskCompletion.delete(existing.id);
        const updates = { streak: Math.max(0, (task.streak || 0) - 1), total_completions: Math.max(0, (task.total_completions || 0) - 1) };
        if (task.frequency === "once") updates.is_active = true;
        await base44.entities.Task.update(task.id, updates);
      } else {
        await base44.entities.TaskCompletion.create({ task_id: task.id, task_name: task.name, completed_date: dateStr, completed_at: format(new Date(), "HH:mm") });
        if (task.frequency === "once") {
          await base44.entities.Task.delete(task.id);
        } else {
          const newStreak = (task.streak || 0) + 1;
          await base44.entities.Task.update(task.id, { streak: newStreak, best_streak: Math.max(newStreak, task.best_streak || 0), total_completions: (task.total_completions || 0) + 1 });
        }
        toast.success(`\u2713 ${task.name}`);
      }
    },
    onError: (_err, _vars, ctx) => {
      if (ctx?.prev !== undefined) queryClient.setQueryData(["completions", user?.email], ctx.prev);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      queryClient.invalidateQueries({ queryKey: ["completions"] });
    },
  });

  const unscheduleTaskMutation = useMutation({
    mutationFn: async (task) => { await base44.entities.Task.update(task.id, { scheduled_time: null }); },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task) => base44.entities.Task.delete(task.id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); toast.success("Task deleted"); },
  });

  const deleteTaskWithConfirm = (task) => {
    if (!window.confirm(`Delete "${task.name}"?`)) return;
    if (!window.confirm("This is permanent and cannot be undone. Delete anyway?")) return;
    deleteTaskMutation.mutate(task);
  };

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["tasks"] }); setShowForm(false); toast.success("Task added!"); },
  });

  const activeTasks = tasks.filter(t => t.is_active !== false);

  // Convert daily schedule blocks into pseudo-tasks for the week view
  const dailyBlockTasks = React.useMemo(() => {
    if (view !== "week") return [];
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
    const blockTasks = [];
    const categoryMap = { work: "work", sleep: "other", personal: "personal", other: "other" };
    for (let i = 0; i < 7; i++) {
      const day = addDays(weekStart, i);
      const dateStr = format(day, "yyyy-MM-dd");
      const blocks = loadBlocks(dateStr);
      for (const block of blocks) {
        const hour = Math.floor(block.startHour);
        const min = Math.round((block.startHour % 1) * 60);
        const durationMin = Math.round((block.endHour - block.startHour) * 60);
        blockTasks.push({
          id: `block-${dateStr}-${block.id}`,
          name: block.text,
          scheduled_time: `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`,
          scheduled_date: dateStr,
          duration_minutes: durationMin,
          category: categoryMap[block.blockCategory] || "other",
          frequency: "once",
          is_active: true,
          _isDailyBlock: true,
        });
      }
    }
    return blockTasks;
  }, [view, currentDate, blockRefreshKey]);

  const taskAppliesOnDate = (t, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dow = format(date, "EEEE").toLowerCase();
    const isWeekday = !["saturday", "sunday"].includes(dow);
    if (t.frequency === "once") return t.scheduled_date === dateStr;
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekdays") return isWeekday;
    if (t.frequency === "weekends") return !isWeekday;
    if (t.frequency === "weekly") {
      if (!t.scheduled_date) return false;
      const start = new Date(t.scheduled_date);
      const current = new Date(dateStr);
      const diffDays = Math.round((current - start) / 86400000);
      return diffDays >= 0 && diffDays % 7 === 0;
    }
    if (t.frequency === "biweekly") {
      if (!t.scheduled_date) return false;
      const start = new Date(t.scheduled_date);
      const current = new Date(dateStr);
      const diffDays = Math.round((current - start) / 86400000);
      return diffDays >= 0 && diffDays % 14 === 0;
    }
    if (t.frequency === "monthly") {
      if (!t.scheduled_date) return false;
      const startDay = new Date(t.scheduled_date).getDate();
      return new Date(dateStr).getDate() === startDay && new Date(dateStr) >= new Date(t.scheduled_date);
    }
    if (t.frequency === dow) return true;
    return false;
  };

  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const completedOnCurrentDate = new Set(
    completions.filter(c => c.completed_date === currentDateStr).map(c => c.task_id)
  );

  const sidebarTasks = (() => {
    if (view === "day") {
      return activeTasks.filter(t => !t.scheduled_time?.trim() && taskAppliesOnDate(t, currentDate) && !completedOnCurrentDate.has(t.id));
    } else if (view === "week") {
      return activeTasks.filter(t => !t.scheduled_time?.trim());
    }
    return [];
  })();

  const handleMobileDragStart = (task, startEvent) => {
    const slotHeight = view === "week" ? 44 : 64;
    setMobileSidebarOpen(false);
    setMobileDrag({ task, x: startEvent.clientX, y: startEvent.clientY });
    const onMove = (e) => {
      setMobileDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null);
      const ZONE = 80, SPEED = 10;
      const calEl = document.querySelector('[data-calendar-scroll]');
      if (calEl) {
        const r = calEl.getBoundingClientRect();
        if (e.clientY > r.bottom - ZONE) calEl.scrollTop += SPEED;
        else if (e.clientY < r.top + ZONE) calEl.scrollTop -= SPEED;
      }
    };
    const onUp = (e) => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      setMobileDrag(null);
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const col = els.find(el => el.dataset?.calendarDate);
      if (col) {
        const dateStr = col.dataset.calendarDate;
        const rect = col.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const totalMin = Math.round((relY / slotHeight) * 60 / 15) * 15;
        const hour = Math.min(23, Math.floor(totalMin / 60) + 1);
        const min = totalMin % 60;
        const time = `${String(hour).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
        base44.entities.Task.update(task.id, { scheduled_time: time, scheduled_date: dateStr });
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
        toast.success(`Scheduled at ${time}`);
      }
    };
    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  };

  const navigate = (dir) => {
    const d = new Date(currentDate);
    if (view === "day") d.setDate(d.getDate() + dir);
    else d.setDate(d.getDate() + dir * 7);
    setCurrentDate(d);
  };

  const onDropTask = async (taskId, time, durationMin) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      const updates = { scheduled_time: time };
      if (durationMin !== undefined) updates.duration_minutes = durationMin;
      await base44.entities.Task.update(taskId, updates);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  };

  const headerLabel =
    view === "day"
      ? format(currentDate, "EEEE, MMMM d")
      : view === "week"
      ? (() => {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          const end = addDays(start, 6);
          return `${format(start, "MMM d")} \u2013 ${format(end, "MMM d, yyyy")}`;
        })()
      : null;

  const isToday = isSameDay(currentDate, new Date());

  // Month view — render the existing day tracker CalendarView
  if (view === "month") {
    return (
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-800">Calendar</h2>
          </div>
        </div>
        {!forceView && (
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center bg-slate-100 rounded-xl p-1">
              {["day", "week", "month"].map(v => (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                    view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                  }`}
                >
                  {v}
                </button>
              ))}
            </div>
          </div>
        )}
        <CalendarView onDaySelect={(dateStr) => {
          if (onDaySelect) onDaySelect(dateStr);
        }} />
      </div>
    );
  }

  // Day/Week views
  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-bold text-slate-800">Calendar</h2>
          <button
            onClick={() => setCurrentDate(new Date())}
            disabled={isToday}
            className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-all ${
              isToday ? "bg-slate-100 text-slate-400 cursor-default" : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            }`}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
          >
            <ListTodo className="w-3.5 h-3.5" />
            Tasks{sidebarTasks.length > 0 && ` (${sidebarTasks.length})`}
          </button>
          <Button onClick={() => setShowForm(true)} size="sm" className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white">
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Add task</span>
          </Button>
        </div>
      </div>

      {/* View toggle + navigation */}
      <div className="flex items-center justify-between mb-4">
        {!forceView && (
          <div className="flex items-center bg-slate-100 rounded-xl p-1">
            {["day", "week", "month"].map(v => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                  view === v ? "bg-white text-slate-800 shadow-sm" : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {v}
              </button>
            ))}
          </div>
        )}
        <div className="flex items-center gap-1 sm:gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl h-8 w-8 sm:h-9 sm:w-9">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CalendarPicker selectedDate={currentDate} onSelectDate={setCurrentDate} />
          <Button variant="ghost" size="icon" onClick={() => navigate(1)} className="rounded-xl h-8 w-8 sm:h-9 sm:w-9">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-start">
        <TaskSidebar
          tasks={sidebarTasks}
          onMobileDragStart={handleMobileDragStart}
          onDeleteTask={deleteTaskWithConfirm}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          mobileOnly
        />
        <div className="flex-1 min-w-0 w-full">
          {view === "day" ? (
            <DayView
              date={currentDate}
              tasks={activeTasks.filter(t => taskAppliesOnDate(t, currentDate))}
              completions={completions}
              onToggle={(task, date) => toggleCompletionMutation.mutate({ task, date })}
              onRemoveTask={(task) => unscheduleTaskMutation.mutate(task)}
              onDropTask={onDropTask}
              timezone={timezone}
            />
          ) : (
            <WeekView
              date={currentDate}
              tasks={[...activeTasks, ...dailyBlockTasks]}
              completions={completions}
              onToggle={(task, date) => { if (!task._isDailyBlock) toggleCompletionMutation.mutate({ task, date }); }}
              onDropTask={(taskId, time, dayStr) => {
                if (String(taskId).startsWith("block-")) return;
                base44.entities.Task.update(taskId, { scheduled_time: time, scheduled_date: dayStr });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
              }}
              onRemoveTask={(task) => { if (!task._isDailyBlock) unscheduleTaskMutation.mutate(task); }}
              timezone={timezone}
              onDateClick={(day) => { setCurrentDate(day); if (onDaySelect) onDaySelect(format(day, "yyyy-MM-dd")); else setView("day"); }}
            />
          )}
        </div>
        <div className="hidden md:block">
          <TaskSidebar tasks={sidebarTasks} onMobileDragStart={handleMobileDragStart} onDeleteTask={deleteTaskWithConfirm} />
        </div>
      </div>

      {mobileDrag && (
        <div
          className="fixed pointer-events-none z-50 rounded-xl bg-indigo-600 text-white text-xs font-semibold px-3 py-2 shadow-xl"
          style={{ left: mobileDrag.x - 10, top: mobileDrag.y - 36, transform: "translateX(-50%)", maxWidth: 160, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}
        >
          {mobileDrag.task.name}
        </div>
      )}

      <TaskFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={(data) => createTaskMutation.mutate(data)}
        defaultDate={format(currentDate, "yyyy-MM-dd")}
      />
    </div>
  );
}
