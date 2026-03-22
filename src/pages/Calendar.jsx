import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format, startOfWeek, addDays, isSameDay, parseISO } from "date-fns";
import { ChevronLeft, ChevronRight, Plus, ListTodo } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import DayView from "../components/schedule/DayView.jsx";
import WeekView from "../components/schedule/WeekView.jsx";
import TaskSidebar from "../components/schedule/TaskSidebar.jsx";
import TaskFormDialog from "../components/tasks/TaskFormDialog.jsx";
import CalendarPicker from "../components/schedule/CalendarPicker.jsx";

export default function Calendar() {
  const [view, setView] = useState("day");
  const [currentDate, setCurrentDate] = useState(new Date());
  const [mobileDrag, setMobileDrag] = useState(null); // { task, x, y }
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.email],
    queryFn: () => user?.email ? base44.entities.Task.filter({ created_by: user.email }) : [],
  });

  // Real-time: refresh tasks when AI or other views create/update/delete them
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

  const today = format(new Date(), "yyyy-MM-dd");
  const [showForm, setShowForm] = useState(false);

  const toggleCompletionMutation = useMutation({
    onMutate: async ({ task, date }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      await queryClient.cancelQueries({ queryKey: ["completions"] });
      const prev = queryClient.getQueryData(["completions", user?.email]);
      const existing = (prev || []).find(
        (c) => c.task_id === task.id && c.completed_date === dateStr
      );
      if (existing) {
        queryClient.setQueryData(["completions", user?.email],
          (old = []) => old.filter(c => c.id !== existing.id)
        );
      } else {
        const optimistic = { id: `opt-${Date.now()}`, task_id: task.id, task_name: task.name, completed_date: dateStr, completed_at: format(new Date(), "HH:mm") };
        queryClient.setQueryData(["completions", user?.email],
          (old = []) => [...old, optimistic]
        );
      }
      return { prev };
    },
    mutationFn: async ({ task, date }) => {
      const dateStr = format(date, "yyyy-MM-dd");
      const existing = completions.find(
        (c) => c.task_id === task.id && c.completed_date === dateStr
      );
      if (existing) {
        await base44.entities.TaskCompletion.delete(existing.id);
        const updates = {
          streak: Math.max(0, (task.streak || 0) - 1),
          total_completions: Math.max(0, (task.total_completions || 0) - 1),
        };
        if (task.frequency === "once") updates.is_active = true;
        await base44.entities.Task.update(task.id, updates);
      } else {
        await base44.entities.TaskCompletion.create({
          task_id: task.id,
          task_name: task.name,
          completed_date: dateStr,
          completed_at: format(new Date(), "HH:mm"),
        });
        const newStreak = (task.streak || 0) + 1;
        const updates = {
          streak: newStreak,
          best_streak: Math.max(newStreak, task.best_streak || 0),
          total_completions: (task.total_completions || 0) + 1,
        };
        if (task.frequency === "once") updates.is_active = false;
        await base44.entities.Task.update(task.id, updates);
        toast.success(`✓ ${task.name}`);
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

  // X button: just unschedule (clear time) so it goes back to the sidebar
  const unscheduleTaskMutation = useMutation({
    mutationFn: async (task) => {
      await base44.entities.Task.update(task.id, { scheduled_time: null });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["tasks"] }),
  });

  const deleteTaskMutation = useMutation({
    mutationFn: (task) => base44.entities.Task.delete(task.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success("Task deleted");
    },
  });

  const deleteTaskWithConfirm = (task) => {
    if (!window.confirm(`Delete "${task.name}"?`)) return;
    if (!window.confirm("This is permanent and cannot be undone. Delete anyway?")) return;
    deleteTaskMutation.mutate(task);
  };

  const createTaskMutation = useMutation({
    mutationFn: (data) => base44.entities.Task.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowForm(false);
      toast.success("Task added!");
    },
  });

  const activeTasks = tasks.filter((t) => t.is_active !== false);

  // Tasks applicable to the current day view (for sidebar: untimed only)
  const taskAppliesOnDate = (t, date) => {
    const dateStr = format(date, "yyyy-MM-dd");
    const dow = format(date, "EEEE").toLowerCase();
    const isWeekday = !["saturday", "sunday"].includes(dow);
    if (t.frequency === "once") return t.scheduled_date === dateStr;
    if (t.frequency === "daily") return true;
    if (t.frequency === "weekdays") return isWeekday;
    if (t.frequency === "weekends") return !isWeekday;
    if (t.frequency === dow) return true;
    return false;
  };

  // IDs of tasks completed on the currently viewed date
  const currentDateStr = format(currentDate, "yyyy-MM-dd");
  const completedOnCurrentDate = new Set(
    completions.filter(c => c.completed_date === currentDateStr).map(c => c.task_id)
  );

  // Sidebar shows untimed, incomplete tasks that apply to the viewed date
  const sidebarTasks = (() => {
    if (view === "day") {
      return activeTasks.filter(
        (t) => !t.scheduled_time?.trim()
          && taskAppliesOnDate(t, currentDate)
          && !completedOnCurrentDate.has(t.id)
      );
    } else {
      // Week view: show all untimed tasks
      return activeTasks.filter((t) => !t.scheduled_time?.trim());
    }
  })();

  const handleMobileDragStart = (task, startEvent) => {
    // Slot height differs per view: WeekView=44px/hr, DayView=64px/hr
    const slotHeight = view === "week" ? 44 : 64;
    setMobileSidebarOpen(false);
    setMobileDrag({ task, x: startEvent.clientX, y: startEvent.clientY });
    const onMove = (e) => {
      setMobileDrag(d => d ? { ...d, x: e.clientX, y: e.clientY } : null);
      // Auto-scroll the timeline scroll container when near its edges
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
      // Find which calendar column is under the pointer
      const els = document.elementsFromPoint(e.clientX, e.clientY);
      const col = els.find(el => el.dataset?.calendarDate);
      if (col) {
        const dateStr = col.dataset.calendarDate;
        const rect = col.getBoundingClientRect();
        const relY = Math.max(0, e.clientY - rect.top);
        const totalMin = Math.round((relY / slotHeight) * 60 / 15) * 15;
        const hour = Math.min(23, Math.floor(totalMin / 60) + 1); // timeline starts at 1am
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

  const onDropTask = async (taskId, time, height) => {
    const task = tasks.find(t => t.id === taskId);
    if (task) {
      await base44.entities.Task.update(taskId, { scheduled_time: time });
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    }
  };

  const headerLabel =
    view === "day"
      ? format(currentDate, "EEEE, MMMM d")
      : (() => {
          const start = startOfWeek(currentDate, { weekStartsOn: 1 });
          const end = addDays(start, 6);
          return `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
        })();

  const isToday = isSameDay(currentDate, new Date());


  return (
    <div className="max-w-6xl mx-auto px-3 sm:px-4 py-4 sm:py-6">
      {/* Header row 1: title + add task */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Calendar</h1>
          <button
            onClick={() => setCurrentDate(new Date())}
            disabled={isToday}
            className={`text-xs px-2.5 py-1.5 rounded-full font-medium transition-all ${
              isToday
                ? "bg-slate-100 text-slate-400 cursor-default"
                : "bg-indigo-600 text-white hover:bg-indigo-700 shadow-sm"
            }`}
          >
            Today
          </button>
        </div>
        <div className="flex items-center gap-2">
          {/* Mobile-only Tasks toggle */}
          <button
            onClick={() => setMobileSidebarOpen(true)}
            className="md:hidden flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full font-medium bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all"
          >
            <ListTodo className="w-3.5 h-3.5" />
            Tasks{sidebarTasks.length > 0 && ` (${sidebarTasks.length})`}
          </button>
          <Button
            onClick={() => setShowForm(true)}
            size="sm"
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            <Plus className="w-4 h-4 sm:mr-1" />
            <span className="hidden sm:inline">Add task</span>
          </Button>
        </div>
      </div>

      {/* Header row 2: view toggle + navigation */}
      <div className="flex items-center justify-between mb-4 sm:mb-6">
        <div className="flex items-center bg-slate-100 rounded-xl p-1">
          {["day", "week"].map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all capitalize ${
                view === v
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>

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

      {/* Calendar + sidebar — stacked on mobile, side-by-side on md+ */}
      <div className="flex flex-col md:flex-row gap-4 items-start">
        {/* Mobile sidebar drawer */}
        <TaskSidebar
          tasks={sidebarTasks}
          onMobileDragStart={handleMobileDragStart}
          onDeleteTask={deleteTaskWithConfirm}
          mobileOpen={mobileSidebarOpen}
          onClose={() => setMobileSidebarOpen(false)}
          mobileOnly
        />

        {/* Calendar: full-width on mobile, flex-1 on desktop */}
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
              tasks={activeTasks}
              completions={completions}
              onToggle={(task, date) => toggleCompletionMutation.mutate({ task, date })}
              onDropTask={(taskId, time, dayStr) => {
                base44.entities.Task.update(taskId, { scheduled_time: time, scheduled_date: dayStr });
                queryClient.invalidateQueries({ queryKey: ["tasks"] });
              }}
              onRemoveTask={(task) => unscheduleTaskMutation.mutate(task)}
              timezone={timezone}
              onDateClick={(day) => { setCurrentDate(day); setView("day"); }}
            />
          )}
        </div>

        {/* Desktop sidebar — RIGHT side */}
        <div className="hidden md:block">
          <TaskSidebar tasks={sidebarTasks} onMobileDragStart={handleMobileDragStart} onDeleteTask={deleteTaskWithConfirm} />
        </div>
      </div>

      {/* Mobile drag ghost */}
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