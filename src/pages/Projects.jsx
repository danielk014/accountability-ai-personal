import React, { useState, useEffect, useMemo, useRef } from "react";
import { getUserPrefix } from "@/lib/userStore";
import { supabaseStorage } from "@/api/supabaseStorage";
import { createPortal } from "react-dom";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  format, startOfMonth, endOfMonth, eachDayOfInterval,
  isSameDay, addMonths, subMonths, parseISO,
} from "date-fns";
import {
  Plus, Trash2, Pencil, Check, Send, Loader2,
  Sparkles, FolderKanban, MessageCircle,
  ChevronDown, CheckSquare, ArrowLeft,
  ChevronLeft, ChevronRight, Calendar as CalendarIcon,
  GraduationCap,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import HomeworkProjectDetail from "@/components/homework/HomeworkProjectDetail";

const APP_LOGO = "https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png";

// ─── Config ──────────────────────────────────────────────────────────────────

const PROJECT_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f43f5e", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#3b82f6", "#64748b",
];

const TYPE_CONFIG = {
  business: { label: "Business", bg: "bg-blue-50 text-blue-600 border-blue-200" },
  school:   { label: "School",   bg: "bg-violet-50 text-violet-600 border-violet-200" },
};

const STATUS_CONFIG = {
  idea:      { label: "Idea",      bg: "bg-slate-100 text-slate-500" },
  active:    { label: "Active",    bg: "bg-green-100 text-green-700" },
  paused:    { label: "Paused",    bg: "bg-yellow-100 text-yellow-700" },
  completed: { label: "Completed", bg: "bg-indigo-100 text-indigo-700" },
};

const PRIORITY_CONFIG = {
  high:   { label: "High",   color: "text-rose-500" },
  medium: { label: "Medium", color: "text-amber-500" },
  low:    { label: "Low",    color: "text-slate-400" },
};

const getChatStorageKey = (projectId) => `${getUserPrefix()}accountable_project_chat_${projectId}`;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function computeProgress(tasks) {
  if (!tasks.length) return { done: 0, total: 0, pct: 0 };
  const done = tasks.filter(t => t.is_done).length;
  return { done, total: tasks.length, pct: Math.round((done / tasks.length) * 100) };
}

function deadlineLabel(deadline) {
  if (!deadline) return null;
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const due = new Date(deadline);
  const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  if (diff < 0)   return { text: `${Math.abs(diff)}d overdue`, cls: "text-red-500" };
  if (diff === 0) return { text: "Due today",                  cls: "text-red-500" };
  if (diff <= 7)  return { text: `${diff}d left`,              cls: "text-amber-500" };
  if (diff <= 30) return { text: `${diff}d left`,              cls: "text-slate-500" };
  return { text: `${diff}d left`, cls: "text-slate-400" };
}

function buildProjectSystemPrompt(project, tasks) {
  const prog = computeProgress(tasks);
  const pending   = tasks.filter(t => !t.is_done);
  const completed = tasks.filter(t =>  t.is_done);
  return `You are a dedicated project advisor for the project "${project.name}". Be specific, action-oriented, and help the user make real progress.

Project details:
- Type: ${project.type} | Status: ${project.status}
- Progress: ${prog.pct}% (${prog.done}/${prog.total} tasks done)
- Deadline: ${project.deadline || "not set"}
${project.description ? `- Description: ${project.description}` : ""}

Pending tasks (${pending.length}):
${pending.map(t => `- ${t.name}${t.due_date ? ` (due ${t.due_date})` : ""}${t.priority !== "medium" ? ` [${t.priority}]` : ""}`).join("\n") || "None"}

Completed tasks: ${completed.map(t => t.name).join(", ") || "None"}

You have tools to manage this project's tasks directly. When the user asks you to add, complete, or delete tasks — use your tools immediately. After using a tool, briefly confirm what you did.

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

// ─── Project advisor tools & agentic loop ────────────────────────────────────

const PROJECT_ADVISOR_TOOLS = [
  {
    name: "add_task",
    description: "Add a new task or milestone to this project.",
    input_schema: {
      type: "object",
      properties: {
        name:     { type: "string", description: "Task name" },
        priority: { type: "string", enum: ["high", "medium", "low"] },
        due_date: { type: "string", description: "Due date in YYYY-MM-DD format (optional)" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_tasks",
    description: "List all tasks for this project.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "complete_task",
    description: "Mark a task as done.",
    input_schema: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "Name of the task to complete (partial match)" },
      },
      required: ["task_name"],
    },
  },
  {
    name: "delete_task",
    description: "Delete a task from the project.",
    input_schema: {
      type: "object",
      properties: {
        task_name: { type: "string", description: "Name of the task to delete (partial match)" },
      },
      required: ["task_name"],
    },
  },
];

async function executeProjectTool(name, input, projectId, queryClient) {
  try {
    switch (name) {
      case "add_task": {
        const task = await base44.entities.ProjectTask.create({
          project_id: projectId,
          name: input.name,
          is_done: false,
          due_date: input.due_date || null,
          priority: input.priority || "medium",
        });
        queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
        return { success: true, task: { name: task.name, priority: task.priority, due_date: task.due_date } };
      }
      case "list_tasks": {
        const tasks = await base44.entities.ProjectTask.filter({ project_id: projectId });
        return { tasks: tasks.map(t => ({ name: t.name, is_done: t.is_done, priority: t.priority, due_date: t.due_date })) };
      }
      case "complete_task": {
        const tasks = await base44.entities.ProjectTask.filter({ project_id: projectId });
        const task = tasks.find(t => t.name.toLowerCase().includes(input.task_name.toLowerCase()));
        if (!task) return { error: `No task found matching "${input.task_name}"` };
        await base44.entities.ProjectTask.update(task.id, { is_done: true });
        queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
        return { success: true, completed: task.name };
      }
      case "delete_task": {
        const tasks = await base44.entities.ProjectTask.filter({ project_id: projectId });
        const task = tasks.find(t => t.name.toLowerCase().includes(input.task_name.toLowerCase()));
        if (!task) return { error: `No task found matching "${input.task_name}"` };
        await base44.entities.ProjectTask.delete(task.id);
        queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
        return { success: true, deleted: task.name };
      }
      default:
        return { error: `Unknown tool: ${name}` };
    }
  } catch (err) {
    return { error: err.message };
  }
}

async function projectAgenticLoop(history, systemPrompt, projectId, queryClient) {
  let messages = history.map(m => ({ role: m.role, content: m.content }));
  for (let turn = 0; turn < 8; turn++) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        tools: PROJECT_ADVISOR_TOOLS,
        messages,
      }),
    });
    if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    const data = await response.json();
    if (data.stop_reason !== 'tool_use') {
      return data.content.find(b => b.type === 'text')?.text ?? '';
    }
    messages = [...messages, { role: 'assistant', content: data.content }];
    const toolResults = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const result = await executeProjectTool(block.name, block.input, projectId, queryClient);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    messages = [...messages, { role: 'user', content: toolResults }];
  }
  return "I ran into an issue completing that. Please try again.";
}

// ─── TaskDatePicker ───────────────────────────────────────────────────────────

function TaskDatePicker({ value, onChange }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [baseMonth, setBaseMonth] = useState(() => value ? parseISO(value) : new Date());
  const btnRef = useRef(null);

  const openPicker = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.bottom + window.scrollY + 4, left: r.left + window.scrollX });
    }
    setOpen(o => !o);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (document.getElementById("proj-date-picker")?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const monthStart    = startOfMonth(baseMonth);
  const daysInMonth   = eachDayOfInterval({ start: monthStart, end: endOfMonth(baseMonth) });
  const firstDayOfWeek = monthStart.getDay();
  const selectedDate  = value ? parseISO(value) : null;
  const today         = new Date(); today.setHours(0, 0, 0, 0);

  const popup = open && createPortal(
    <div
      id="proj-date-picker"
      style={{ position: "absolute", top: coords.top, left: coords.left, zIndex: 9999 }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-64"
    >
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setBaseMonth(subMonths(baseMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700">{format(baseMonth, "MMMM yyyy")}</span>
        <button onClick={() => setBaseMonth(addMonths(baseMonth, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstDayOfWeek }, (_, i) => <div key={`e${i}`} />)}
        {daysInMonth.map(day => {
          const isSel   = selectedDate && isSameDay(day, selectedDate);
          const isToday = isSameDay(day, today);
          return (
            <button
              key={day.toISOString()}
              onClick={() => { onChange(format(day, "yyyy-MM-dd")); setOpen(false); }}
              className={cn(
                "h-8 w-full rounded-lg text-xs font-medium transition flex items-center justify-center",
                isSel   ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600",
                isToday && !isSel ? "ring-1 ring-indigo-400" : ""
              )}
            >
              {day.getDate()}
            </button>
          );
        })}
      </div>
      <div className="flex justify-between mt-3">
        {value && (
          <button onClick={() => { onChange(""); setOpen(false); }} className="text-xs text-slate-400 hover:text-red-400 transition">
            Clear
          </button>
        )}
        <button
          onClick={() => { onChange(format(today, "yyyy-MM-dd")); setOpen(false); }}
          className="text-xs text-indigo-500 hover:text-indigo-700 transition ml-auto"
        >
          Today
        </button>
      </div>
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm bg-white transition whitespace-nowrap",
          value ? "border-indigo-300 text-indigo-700 font-medium" : "border-slate-200 text-slate-400 hover:border-indigo-300"
        )}
      >
        <CalendarIcon className="w-3.5 h-3.5 flex-shrink-0" />
        {value ? format(parseISO(value), "MMM d") : "Due date"}
      </button>
      {popup}
    </>
  );
}

// ─── ProjectModal ─────────────────────────────────────────────────────────────

function ProjectModal({ open, onOpenChange, onSubmit, project }) {
  const [form, setForm] = useState({
    name: "", description: "", type: "school",
    status: "active", color: PROJECT_COLORS[0], deadline: "", homework_mode: false,
  });

  useEffect(() => {
    setForm({
      name:          project?.name          ?? "",
      description:   project?.description   ?? "",
      type:          project?.type          ?? "school",
      status:        project?.status        ?? "active",
      color:         project?.color         ?? PROJECT_COLORS[0],
      deadline:      project?.deadline      ?? "",
      homework_mode: project?.homework_mode ?? false,
    });
  }, [project, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit({ ...form, deadline: form.deadline || null });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{project ? "Edit Project" : "New Project"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Name</label>
            <Input autoFocus placeholder="What are you working on?" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Description <span className="text-slate-400 font-normal">(optional)</span></label>
            <textarea placeholder="What's the goal?" value={form.description}
              onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-200" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">
                Type <span className="text-rose-400">*</span>
              </label>
              <Select value={form.type} onValueChange={v => setForm(f => ({ ...f, type: v, homework_mode: v !== "school" ? false : f.homework_mode }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TYPE_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Status</label>
              <Select value={form.status} onValueChange={v => setForm(f => ({ ...f, status: v }))}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(STATUS_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          {form.type === "school" && (
            <label className="flex items-start gap-3 p-3.5 rounded-xl bg-violet-50 border border-violet-200 cursor-pointer hover:bg-violet-100 transition">
              <input
                type="checkbox"
                checked={form.homework_mode}
                onChange={e => setForm(f => ({ ...f, homework_mode: e.target.checked }))}
                className="mt-0.5 w-4 h-4 accent-violet-600 rounded cursor-pointer"
              />
              <div>
                <p className="text-sm font-semibold text-violet-800 flex items-center gap-1.5">
                  <GraduationCap className="w-4 h-4" />
                  Homework mode
                </p>
                <p className="text-xs text-violet-500 mt-0.5">Organize study material with chapters, flashcards &amp; AI-assisted learning objectives</p>
              </div>
            </label>
          )}
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Deadline <span className="text-slate-400 font-normal">(optional)</span></label>
            <Input type="date" value={form.deadline} onChange={e => setForm(f => ({ ...f, deadline: e.target.value }))} className="rounded-xl" />
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-2 block">Color</label>
            <div className="flex flex-wrap gap-2">
              {PROJECT_COLORS.map(c => (
                <button key={c} type="button" onClick={() => setForm(f => ({ ...f, color: c }))}
                  className={cn("w-7 h-7 rounded-full transition-all", form.color === c ? "ring-2 ring-offset-2 ring-slate-400 scale-110" : "hover:scale-105")}
                  style={{ backgroundColor: c }} />
              ))}
            </div>
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700">{project ? "Save changes" : "Create project"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ─── ProjectTaskItem ──────────────────────────────────────────────────────────

function ProjectTaskItem({ task, onToggle, onDelete }) {
  const pc = PRIORITY_CONFIG[task.priority] || PRIORITY_CONFIG.medium;
  const dl = task.due_date ? deadlineLabel(task.due_date) : null;

  return (
    <motion.div layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, x: -16 }}
      className={cn("flex items-center gap-3 px-4 py-3 rounded-xl border transition-all group",
        task.is_done ? "bg-slate-50 border-slate-100" : "bg-white border-slate-200 hover:border-indigo-200"
      )}>
      <button onClick={() => onToggle(task)}
        className={cn("w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all",
          task.is_done ? "border-indigo-500 bg-indigo-500" : "border-slate-300 hover:border-indigo-400"
        )}>
        {task.is_done && <Check className="w-3 h-3 text-white" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={cn("text-sm font-medium", task.is_done ? "line-through text-slate-400" : "text-slate-800")}>{task.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className={cn("text-xs font-medium", pc.color)}>{pc.label}</span>
          {dl && <span className={cn("text-xs", dl.cls)}>{dl.text}</span>}
        </div>
      </div>
      <button onClick={() => onDelete(task.id)}
        className="opacity-0 group-hover:opacity-100 p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition-all">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </motion.div>
  );
}

// ─── ProjectDetail (full-page view) ──────────────────────────────────────────

function ProjectDetail({ project, tasks, onBack, queryClient, onEdit, onDelete }) {
  const [newTaskName, setNewTaskName]         = useState("");
  const [newTaskDue, setNewTaskDue]           = useState("");
  const [newTaskPriority, setNewTaskPriority] = useState("medium");
  const [activeSection, setActiveSection]     = useState("tasks");

  const chatKey = getChatStorageKey(project?.id);
  const [chatMessages, setChatMessages] = useState(() => {
    try {
      const raw = supabaseStorage.getItem(chatKey) || localStorage.getItem(chatKey);
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  });
  const [chatInput, setChatInput]     = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState(null); // { x, y, index }
  const bottomRef    = useRef(null);
  const taskInputRef = useRef(null);

  useEffect(() => {
    try {
      const raw = supabaseStorage.getItem(chatKey) || localStorage.getItem(chatKey);
      setChatMessages(raw ? JSON.parse(raw) : []);
    } catch {}
  }, [project?.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    const handler = () => setContextMenu(null);
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, [contextMenu]);

  const addTask = async () => {
    if (!newTaskName.trim()) return;
    await base44.entities.ProjectTask.create({
      project_id: project.id, name: newTaskName.trim(),
      is_done: false, due_date: newTaskDue || null, priority: newTaskPriority,
    });
    queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
    setNewTaskName(""); setNewTaskDue(""); setNewTaskPriority("medium");
    taskInputRef.current?.focus();
  };

  const toggleTask = async (task) => {
    await base44.entities.ProjectTask.update(task.id, { is_done: !task.is_done });
    queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
  };

  const deleteTask = async (id) => {
    await base44.entities.ProjectTask.delete(id);
    queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
  };

  const sendChat = async (text) => {
    if (!text.trim() || chatLoading) return;
    setChatInput("");
    const userMsg = { role: "user", content: text.trim() };
    const updated = [...chatMessages, userMsg];
    setChatMessages(updated);
    supabaseStorage.setItem(chatKey, JSON.stringify(updated.slice(-60)));
    setChatLoading(true);
    try {
      const systemPrompt = buildProjectSystemPrompt(project, tasks);
      const reply = await projectAgenticLoop(updated, systemPrompt, project.id, queryClient);
      const withReply = [...updated, { role: "assistant", content: reply }];
      setChatMessages(withReply);
      supabaseStorage.setItem(chatKey, JSON.stringify(withReply.slice(-60)));
    } catch (err) {
      const withErr = [...updated, { role: "assistant", content: `Something went wrong: ${err.message}` }];
      setChatMessages(withErr);
      supabaseStorage.setItem(chatKey, JSON.stringify(withErr.slice(-60)));
    } finally {
      setChatLoading(false);
    }
  };

  const deleteChatMessage = (index) => {
    const updated = chatMessages.filter((_, i) => i !== index);
    setChatMessages(updated);
    supabaseStorage.setItem(chatKey, JSON.stringify(updated));
    setContextMenu(null);
  };

  const prog         = computeProgress(tasks);
  const dl           = deadlineLabel(project.deadline);
  const tc           = TYPE_CONFIG[project.type]    || TYPE_CONFIG.school;
  const sc           = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  const pendingTasks = tasks.filter(t => !t.is_done);
  const doneTasks    = tasks.filter(t =>  t.is_done);

  const quickPrompts = [
    "What should I work on first?",
    "Help me break this into smaller steps",
    "Am I on track to hit my deadline?",
    "Add tasks for this project based on the description",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">

      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack}
          className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition flex-shrink-0">
          <ArrowLeft className="w-4 h-4" />
        </button>

        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || PROJECT_COLORS[0] }} />

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-lg font-bold text-slate-800 truncate">{project.name}</h2>
            <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", tc.bg)}>{tc.label}</span>
            <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.bg)}>{sc.label}</span>
          </div>
          <div className="flex items-center gap-4 mt-1.5">
            <div className="flex items-center gap-2 flex-1 max-w-xs">
              <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${prog.pct}%`, backgroundColor: project.color || "#6366f1" }} />
              </div>
              <span className="text-xs text-slate-500 font-medium whitespace-nowrap">{prog.done}/{prog.total} tasks</span>
            </div>
            {dl && <span className={cn("text-xs font-medium", dl.cls)}>{dl.text}</span>}
          </div>
        </div>

        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(project)}
            className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => { onDelete(project.id); onBack(); }}
            className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-400 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="flex md:hidden border-b border-slate-100 bg-white flex-shrink-0">
        {[["tasks", "Tasks"], ["chat", "AI Advisor"]].map(([s, label]) => (
          <button key={s} onClick={() => setActiveSection(s)}
            className={cn("flex-1 py-2.5 text-sm font-medium transition-all",
              activeSection === s ? "text-indigo-600 border-b-2 border-indigo-600" : "text-slate-500")}>
            {label}
          </button>
        ))}
      </div>

      {/* Two-column body */}
      <div className="flex flex-1 overflow-hidden">

        {/* LEFT — Tasks */}
        <div className={cn("flex flex-col w-full md:w-1/2 bg-white border-r border-slate-100", activeSection !== "tasks" && "hidden md:flex")}>
          {/* Add task row */}
          <div className="px-4 pt-4 pb-3 border-b border-slate-100 flex-shrink-0 space-y-2">
            <input ref={taskInputRef} value={newTaskName} onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => e.key === "Enter" && addTask()}
              placeholder="Add a task or milestone… (Enter to add)"
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            <div className="flex gap-2 items-center">
              <TaskDatePicker value={newTaskDue} onChange={setNewTaskDue} />
              <Select value={newTaskPriority} onValueChange={setNewTaskPriority}>
                <SelectTrigger className="flex-1 rounded-xl text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PRIORITY_CONFIG).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}
                </SelectContent>
              </Select>
              <Button onClick={addTask} disabled={!newTaskName.trim()} size="sm"
                className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3">
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Task list */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-2">
            <AnimatePresence>
              {pendingTasks.map(task => (
                <ProjectTaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
              ))}
            </AnimatePresence>

            {doneTasks.length > 0 && (
              <details className="group mt-2">
                <summary className="text-xs text-slate-400 font-medium cursor-pointer py-2 hover:text-slate-600 list-none flex items-center gap-1 select-none">
                  <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                  Completed ({doneTasks.length})
                </summary>
                <div className="space-y-2 mt-1">
                  <AnimatePresence>
                    {doneTasks.map(task => (
                      <ProjectTaskItem key={task.id} task={task} onToggle={toggleTask} onDelete={deleteTask} />
                    ))}
                  </AnimatePresence>
                </div>
              </details>
            )}

            {tasks.length === 0 && (
              <div className="text-center py-12 text-slate-400">
                <CheckSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm font-medium">No tasks yet</p>
                <p className="text-xs mt-1">Add your first task above or ask the AI advisor</p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT — AI Advisor */}
        <div className={cn("flex flex-col w-full md:w-1/2 bg-slate-50", activeSection !== "chat" && "hidden md:flex")}>
          <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100 bg-white flex-shrink-0">
            <div className="w-8 h-8 rounded-xl bg-indigo-100 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">Project Advisor</p>
              <p className="text-xs text-slate-400">Can add tasks and manage this project</p>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="space-y-3">
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-6 h-6 text-indigo-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">Your Project Advisor</p>
                  <p className="text-xs text-slate-400 mt-1">Ask anything — I can also add tasks for you</p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => sendChat(q)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 hover:border-indigo-300 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 transition bg-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {chatMessages.map((msg, i) => (
              <div key={i}
                className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}
                onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, index: i }); }}
              >
                {msg.role === "assistant" && (
                  <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 mt-1">
                    <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                  </div>
                )}
                <div className={cn(
                  "max-w-[80%] rounded-2xl px-3 py-2.5 text-sm leading-relaxed whitespace-pre-wrap",
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-tr-sm"
                    : "bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100"
                )}>
                  {msg.content}
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-3 shadow-sm border border-slate-100">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          <div className="flex gap-2 px-5 py-4 border-t border-slate-100 bg-white flex-shrink-0">
            <textarea value={chatInput} onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendChat(chatInput); } }}
              placeholder="Ask your advisor or say 'add a task for…'"
              rows={1} disabled={chatLoading}
              className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-200 placeholder:text-slate-400"
              style={{ minHeight: "40px", maxHeight: "100px" }} />
            <Button onClick={() => sendChat(chatInput)} disabled={!chatInput.trim() || chatLoading}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700 px-3">
              {chatLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Right-click context menu */}
      {contextMenu && createPortal(
        <div
          style={{ position: "fixed", top: contextMenu.y, left: contextMenu.x, zIndex: 9999 }}
          className="bg-white border border-slate-200 rounded-xl shadow-xl py-1 min-w-[140px]"
        >
          <button
            onClick={() => deleteChatMessage(contextMenu.index)}
            className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-500 hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
            Delete message
          </button>
        </div>,
        document.body
      )}
    </div>
  );
}

// ─── ProjectCard ──────────────────────────────────────────────────────────────

function ProjectCard({ project, tasks, onEdit, onDelete, onSelect }) {
  const prog = computeProgress(tasks);
  const dl   = deadlineLabel(project.deadline);
  const tc   = TYPE_CONFIG[project.type]     || TYPE_CONFIG.school;
  const sc   = STATUS_CONFIG[project.status] || STATUS_CONFIG.active;
  const isHomework = project.type === "school" && project.homework_mode;

  return (
    <motion.div layout initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.96 }}
      className="bg-white rounded-2xl shadow-sm border border-slate-100 p-5 flex flex-col gap-4 hover:shadow-md transition-shadow group cursor-pointer"
      onClick={() => onSelect(project)}
    >
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || PROJECT_COLORS[0] }} />
          <span className={cn("text-xs px-2 py-0.5 rounded-full border font-medium", tc.bg)}>{tc.label}</span>
          {isHomework && (
            <span className="text-xs px-2 py-0.5 rounded-full border font-medium bg-violet-100 text-violet-600 border-violet-200 flex items-center gap-1">
              <GraduationCap className="w-3 h-3" />
              Homework
            </span>
          )}
          <span className={cn("text-xs px-2 py-0.5 rounded-full font-medium", sc.bg)}>{sc.label}</span>
        </div>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
          <button onClick={() => onEdit(project)} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <Pencil className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => onDelete(project.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-400 transition">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div>
        <h3 className="font-semibold text-slate-800 text-base leading-snug">{project.name}</h3>
        {project.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{project.description}</p>}
        {isHomework && !project.description && (
          <p className="text-xs text-violet-400 mt-1">Chapters · Flashcards · Learning Objectives</p>
        )}
      </div>

      <div className="space-y-1.5">
        {!isHomework && (
          <>
            <div className="flex justify-between items-center">
              <span className="text-xs text-slate-400">{prog.done}/{prog.total} tasks</span>
              <span className="text-xs font-semibold text-slate-600">{prog.pct}%</span>
            </div>
            <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
              <div className="h-full rounded-full transition-all duration-500"
                style={{ width: `${prog.pct}%`, backgroundColor: project.color || "#6366f1" }} />
            </div>
          </>
        )}
      </div>

      <div className="flex items-center justify-between">
        {dl ? <span className={cn("text-xs font-medium", dl.cls)}>{dl.text}</span>
             : <span className="text-xs text-slate-300">No deadline</span>}
        <button onClick={e => { e.stopPropagation(); onSelect(project); }}
          className="flex items-center gap-1 text-xs text-indigo-500 hover:text-indigo-700 font-medium transition">
          <MessageCircle className="w-3.5 h-3.5" />
          Open
        </button>
      </div>
    </motion.div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Projects() {
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: projects = [] } = useQuery({
    queryKey: ["projects", user?.email],
    queryFn: () => base44.entities.Project.filter({ created_by: user.email }, "-created_at"),
    enabled: !!user?.email,
  });

  const { data: allProjectTasks = [] } = useQuery({
    queryKey: ["projectTasks", user?.email],
    queryFn: () => base44.entities.ProjectTask.filter({ created_by: user.email }),
    enabled: !!user?.email,
  });

  useEffect(() => {
    const unsubProj = base44.entities.Project.subscribe(() => queryClient.invalidateQueries({ queryKey: ["projects"] }));
    const unsubTask = base44.entities.ProjectTask.subscribe(() => queryClient.invalidateQueries({ queryKey: ["projectTasks"] }));
    return () => { unsubProj(); unsubTask(); };
  }, []);

  const [selectedProject, setSelectedProject] = useState(null);
  const [statusFilter, setStatusFilter]         = useState("all");
  const [sortBy, setSortBy]                     = useState("created");
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editingProject, setEditingProject]     = useState(null);

  const tasksByProject = useMemo(() => {
    const map = {};
    for (const t of allProjectTasks) {
      if (!map[t.project_id]) map[t.project_id] = [];
      map[t.project_id].push(t);
    }
    return map;
  }, [allProjectTasks]);

  const visibleProjects = useMemo(() => {
    let result = projects;
    if (statusFilter !== "all") result = result.filter(p => p.status === statusFilter);
    if (sortBy === "name") {
      result = [...result].sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === "deadline") {
      result = [...result].sort((a, b) => {
        if (!a.deadline && !b.deadline) return 0;
        if (!a.deadline) return 1;
        if (!b.deadline) return -1;
        return a.deadline.localeCompare(b.deadline);
      });
    } else if (sortBy === "progress") {
      result = [...result].sort((a, b) => {
        const pa = computeProgress(tasksByProject[a.id] || []).pct;
        const pb = computeProgress(tasksByProject[b.id] || []).pct;
        return pb - pa;
      });
    }
    return result;
  }, [projects, statusFilter, sortBy, tasksByProject]);

  const createProjectMutation = useMutation({
    mutationFn: (data) => base44.entities.Project.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["projects"] }); toast.success("Project created!"); },
  });

  const updateProjectMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Project.update(id, data),
    onSuccess: (updated) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      // Keep selectedProject in sync if we're editing the open one
      if (selectedProject?.id === updated?.id) setSelectedProject(updated);
      toast.success("Project updated!");
    },
  });

  const deleteProjectMutation = useMutation({
    mutationFn: async (id) => {
      const tasks = tasksByProject[id] || [];
      await Promise.all(tasks.map(t => base44.entities.ProjectTask.delete(t.id)));
      await base44.entities.Project.delete(id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["projectTasks"] });
      toast.success("Project deleted");
    },
  });

  const handleModalSubmit = (formData) => {
    if (editingProject) {
      updateProjectMutation.mutate({ id: editingProject.id, data: formData });
    } else {
      createProjectMutation.mutate(formData);
    }
    setEditingProject(null);
  };

  const handleEdit = (project) => { setEditingProject(project); setShowProjectModal(true); };

  const handleDelete = (id) => {
    if (window.confirm("Delete this project and all its tasks?")) {
      deleteProjectMutation.mutate(id);
      if (selectedProject?.id === id) setSelectedProject(null);
    }
  };

  const SORT_OPTIONS = [
    { value: "created",  label: "Newest" },
    { value: "deadline", label: "Deadline" },
    { value: "progress", label: "Progress" },
    { value: "name",     label: "Name A–Z" },
  ];
  const STATUS_FILTERS = ["all", ...Object.keys(STATUS_CONFIG)];

  // ── Full-page project detail ───────────────────────────────────────────────
  if (selectedProject) {
    const liveTasks = tasksByProject[selectedProject.id] || [];

    // School projects with homework mode get the full homework UI
    if (selectedProject.type === "school" && selectedProject.homework_mode) {
      return (
        <>
          <HomeworkProjectDetail
            project={selectedProject}
            onBack={() => setSelectedProject(null)}
            onEdit={handleEdit}
            onDelete={handleDelete}
          />
          <ProjectModal
            open={showProjectModal}
            onOpenChange={(open) => { setShowProjectModal(open); if (!open) setEditingProject(null); }}
            onSubmit={handleModalSubmit}
            project={editingProject}
          />
        </>
      );
    }

    return (
      <>
        <ProjectDetail
          project={selectedProject}
          tasks={liveTasks}
          onBack={() => setSelectedProject(null)}
          queryClient={queryClient}
          onEdit={handleEdit}
          onDelete={handleDelete}
        />
        <ProjectModal
          open={showProjectModal}
          onOpenChange={(open) => { setShowProjectModal(open); if (!open) setEditingProject(null); }}
          onSubmit={handleModalSubmit}
          project={editingProject}
        />
      </>
    );
  }

  // ── Grid view ─────────────────────────────────────────────────────────────
  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Projects</h1>
          <p className="text-slate-400 text-sm mt-1">Track your ventures, goals, and long-term work</p>
        </div>
        <Button onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
          className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1.5" />
          New Project
        </Button>
      </div>

      <div className="flex flex-wrap gap-2 items-center mb-6">
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="rounded-xl text-xs w-36 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {STATUS_FILTERS.map(s => (
              <SelectItem key={s} value={s}>{s === "all" ? "All statuses" : STATUS_CONFIG[s]?.label ?? s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sortBy} onValueChange={setSortBy}>
          <SelectTrigger className="rounded-xl text-xs w-32 h-9"><SelectValue /></SelectTrigger>
          <SelectContent>
            {SORT_OPTIONS.map(o => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="text-xs text-slate-400 ml-auto">
          {visibleProjects.length} project{visibleProjects.length !== 1 ? "s" : ""}
        </span>
      </div>

      {visibleProjects.length === 0 && (
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="text-center py-24">
          <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center mx-auto mb-4">
            <FolderKanban className="w-8 h-8 text-indigo-400" />
          </div>
          <p className="text-lg font-semibold text-slate-700">No projects yet</p>
          <p className="text-sm text-slate-400 mt-1 mb-6">
            {statusFilter !== "all" ? "No projects match your current filters." : "Create your first project to get started."}
          </p>
          {statusFilter === "all" && (
            <Button onClick={() => { setEditingProject(null); setShowProjectModal(true); }}
              className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              <Plus className="w-4 h-4 mr-1.5" />
              Create your first project
            </Button>
          )}
        </motion.div>
      )}

      {visibleProjects.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence>
            {visibleProjects.map(project => (
              <ProjectCard
                key={project.id}
                project={project}
                tasks={tasksByProject[project.id] || []}
                onEdit={handleEdit}
                onDelete={handleDelete}
                onSelect={setSelectedProject}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      <ProjectModal
        open={showProjectModal}
        onOpenChange={(open) => { setShowProjectModal(open); if (!open) setEditingProject(null); }}
        onSubmit={handleModalSubmit}
        project={editingProject}
      />
    </div>
  );
}
