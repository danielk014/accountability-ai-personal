import React, { useState, useRef, useEffect } from "react";
import {
  Plus, Trash2, Pencil, Check, X, Dumbbell, Send, Loader2, Bot,
  Scale, Paperclip, Camera, ArrowLeft, CheckSquare, Square, ChevronLeft, ChevronRight,
  GripVertical,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserPrefix } from "@/lib/userStore";
import { sendGymMessage } from "@/api/claudeClient";
import { toast } from "sonner";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths, differenceInDays, parseISO } from "date-fns";

// ── Storage helpers ──────────────────────────────────────────────────────────
const getStorageKey    = () => `${getUserPrefix()}gym_tracker_v1`;
const getChatKey       = () => `${getUserPrefix()}gym_chat_v1`;
const getPhysiqueKey   = () => `${getUserPrefix()}gym_physique_v1`;
const getBodyweightKey = () => `${getUserPrefix()}gym_bodyweight_v1`;

function generateId() {
  return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

// 8-color palette for workout days
const DAY_COLORS = [
  { lightBg: "bg-rose-50",    border: "border-rose-200",   text: "text-rose-600",   badge: "bg-rose-100 text-rose-700",   dot: "bg-rose-500"   },
  { lightBg: "bg-blue-50",    border: "border-blue-200",   text: "text-blue-600",   badge: "bg-blue-100 text-blue-700",   dot: "bg-blue-500"   },
  { lightBg: "bg-emerald-50", border: "border-emerald-200",text: "text-emerald-600",badge: "bg-emerald-100 text-emerald-700",dot:"bg-emerald-500"},
  { lightBg: "bg-violet-50",  border: "border-violet-200", text: "text-violet-600", badge: "bg-violet-100 text-violet-700",dot: "bg-violet-500" },
  { lightBg: "bg-amber-50",   border: "border-amber-200",  text: "text-amber-600",  badge: "bg-amber-100 text-amber-700", dot: "bg-amber-500"  },
  { lightBg: "bg-pink-50",    border: "border-pink-200",   text: "text-pink-600",   badge: "bg-pink-100 text-pink-700",   dot: "bg-pink-500"   },
  { lightBg: "bg-cyan-50",    border: "border-cyan-200",   text: "text-cyan-600",   badge: "bg-cyan-100 text-cyan-700",   dot: "bg-cyan-500"   },
  { lightBg: "bg-lime-50",    border: "border-lime-200",   text: "text-lime-600",   badge: "bg-lime-100 text-lime-700",   dot: "bg-lime-500"   },
];

function getColorConfig(colorIndex) {
  return DAY_COLORS[colorIndex % DAY_COLORS.length];
}

// ── Data load / save ─────────────────────────────────────────────────────────
function migrateOldFormat(parsed) {
  const days = [];
  if (Array.isArray(parsed.push_exercises)) {
    days.push({ id: generateId(), name: "Push", colorIndex: 0, exercises: parsed.push_exercises });
  }
  if (Array.isArray(parsed.pull_exercises)) {
    days.push({ id: generateId(), name: "Pull", colorIndex: 1, exercises: parsed.pull_exercises });
  }
  if (Array.isArray(parsed.legs_exercises)) {
    days.push({ id: generateId(), name: "Legs", colorIndex: 2, exercises: parsed.legs_exercises });
  }
  if (days.length === 0) {
    days.push(
      { id: generateId(), name: "Push", colorIndex: 0, exercises: [] },
      { id: generateId(), name: "Pull", colorIndex: 1, exercises: [] },
      { id: generateId(), name: "Legs", colorIndex: 2, exercises: [] },
    );
  }
  return { weight_unit: parsed.weight_unit || "kg", workout_days: days };
}

function loadData() {
  try {
    const raw = localStorage.getItem(getStorageKey());
    if (raw) {
      const parsed = JSON.parse(raw);
      if (!parsed.workout_days) {
        const migrated = migrateOldFormat(parsed);
        localStorage.setItem(getStorageKey(), JSON.stringify(migrated));
        return migrated;
      }
      return parsed;
    }
  } catch {}
  const defaults = {
    weight_unit: "kg",
    workout_days: [
      { id: generateId(), name: "Push", colorIndex: 0, exercises: [] },
      { id: generateId(), name: "Pull", colorIndex: 1, exercises: [] },
      { id: generateId(), name: "Legs", colorIndex: 2, exercises: [] },
    ],
  };
  return defaults;
}

function saveData(data) {
  localStorage.setItem(getStorageKey(), JSON.stringify(data));
}

function loadChat() {
  try {
    const raw = localStorage.getItem(getChatKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function saveChat(msgs) {
  localStorage.setItem(getChatKey(), JSON.stringify(msgs.slice(-60)));
}

function loadPhysique() {
  try {
    const raw = localStorage.getItem(getPhysiqueKey());
    return raw ? JSON.parse(raw) : { panels: [] };
  } catch { return { panels: [] }; }
}

function savePhysique(data) {
  try {
    localStorage.setItem(getPhysiqueKey(), JSON.stringify(data));
  } catch {
    toast.error("Storage full — try deleting older check-ins.");
  }
}

function loadBodyweight() {
  try {
    const raw = localStorage.getItem(getBodyweightKey());
    return raw ? JSON.parse(raw) : { logs: [] };
  } catch { return { logs: [] }; }
}

function saveBodyweight(data) {
  localStorage.setItem(getBodyweightKey(), JSON.stringify(data));
}

// Image helpers
function compressImage(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const MAX = 900;
        const scale = Math.min(1, MAX / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.75));
      };
      img.onerror = reject;
      img.src = e.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Mini CalendarPicker (date-only, no time) ─────────────────────────────────
function GymDatePicker({ selectedDate, onSelect, label }) {
  const [open, setOpen] = useState(false);
  const [baseMonth, setBaseMonth] = useState(selectedDate ? new Date(selectedDate + "T12:00:00") : new Date());
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const monthStart  = startOfMonth(baseMonth);
  const monthEnd    = endOfMonth(baseMonth);
  const days        = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDay    = monthStart.getDay();
  const displayDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "MMM d, yyyy")
    : (label || "Pick date");

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
      >
        {displayDate}
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-800">{format(baseMonth, "MMMM yyyy")}</span>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => setBaseMonth(subMonths(baseMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button type="button" onClick={() => setBaseMonth(addMonths(baseMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition">
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const isSelected = selectedDate === dayStr;
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  type="button"
                  key={dayStr}
                  onClick={() => { onSelect(dayStr); setOpen(false); }}
                  className={cn(
                    "text-xs rounded-lg py-1.5 text-center transition font-medium",
                    isSelected ? "bg-indigo-600 text-white" :
                    isToday    ? "bg-indigo-50 text-indigo-600 border border-indigo-200" :
                                 "hover:bg-slate-100 text-slate-700"
                  )}
                >
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── ExerciseCard ─────────────────────────────────────────────────────────────
function ExerciseCard({ exercise, dayConfig, weightUnit, onDelete, onAddSet, onDeleteSet, onEditSet, onEditName, isDragOver, dragHandleProps }) {
  const [addingSet, setAddingSet]   = useState(false);
  const [setForm, setSetForm]       = useState({ weight: "", reps: "" });
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue]   = useState(exercise.name);
  const [editingSetId, setEditingSetId] = useState(null);
  const [editSetForm, setEditSetForm]   = useState({ weight: "", reps: "" });

  function handleAddSet(e) {
    e.preventDefault();
    if (!setForm.weight || !setForm.reps) return;
    onAddSet(exercise.id, { id: generateId(), weight: parseFloat(setForm.weight), reps: parseInt(setForm.reps, 10) });
    setSetForm({ weight: "", reps: "" });
    setAddingSet(false);
  }

  function handleSaveName(e) {
    e.preventDefault();
    if (!nameValue.trim()) return;
    onEditName(exercise.id, nameValue.trim());
    setEditingName(false);
  }

  function startEditSet(set) {
    setEditingSetId(set.id);
    setEditSetForm({ weight: String(set.weight), reps: String(set.reps) });
  }

  function handleSaveSet(e) {
    e.preventDefault();
    if (!editSetForm.weight || !editSetForm.reps) return;
    onEditSet(exercise.id, editingSetId, {
      weight: parseFloat(editSetForm.weight),
      reps: parseInt(editSetForm.reps, 10),
    });
    setEditingSetId(null);
  }

  return (
    <div className={cn("bg-white rounded-2xl border p-5 mb-3 transition-all", isDragOver ? "border-indigo-400 shadow-md" : "border-slate-200")}>
      <div className="flex items-start gap-2 mb-3">
        {/* Drag handle */}
        <div {...dragHandleProps} className="mt-1 cursor-grab active:cursor-grabbing text-slate-300 hover:text-slate-500 transition flex-shrink-0 pt-0.5">
          <GripVertical className="w-4 h-4" />
        </div>
        <div className="flex-1 min-w-0">
          {editingName ? (
            <form onSubmit={handleSaveName} className="flex items-center gap-2">
              <input autoFocus value={nameValue} onChange={e => setNameValue(e.target.value)}
                className="flex-1 text-sm font-semibold text-slate-800 border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button type="submit" className="p-1.5 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"><Check className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => { setEditingName(false); setNameValue(exercise.name); }}
                className="p-1.5 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"><X className="w-3.5 h-3.5" /></button>
            </form>
          ) : (
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-slate-800">{exercise.name}</h3>
              <button onClick={() => setEditingName(true)} className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
          <p className="text-xs text-slate-400 mt-0.5">{exercise.sets.length} set{exercise.sets.length !== 1 ? "s" : ""}</p>
        </div>
        <button onClick={() => onDelete(exercise.id)}
          className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition flex-shrink-0 mt-0.5">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {exercise.sets.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {exercise.sets.map((set, idx) => (
            editingSetId === set.id ? (
              <form key={set.id} onSubmit={handleSaveSet} className="flex items-center gap-1.5">
                <input autoFocus type="number" value={editSetForm.weight}
                  onChange={e => setEditSetForm(f => ({ ...f, weight: e.target.value }))}
                  placeholder={`${weightUnit}`} min="0" step="0.5"
                  className="w-24 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <span className="text-xs text-slate-400">×</span>
                <input type="number" value={editSetForm.reps}
                  onChange={e => setEditSetForm(f => ({ ...f, reps: e.target.value }))}
                  placeholder="reps" min="1"
                  className="w-16 text-xs border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
                <button type="submit" className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"><Check className="w-3 h-3" /></button>
                <button type="button" onClick={() => setEditingSetId(null)} className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"><X className="w-3 h-3" /></button>
              </form>
            ) : (
              <div key={set.id}
                className={cn("group/set flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold border", dayConfig.lightBg, dayConfig.border, dayConfig.text)}>
                <span>Set {idx + 1}: {set.weight} {weightUnit} × {set.reps}</span>
                <button onClick={() => startEditSet(set)} className="opacity-0 group-hover/set:opacity-100 hover:text-indigo-600 transition ml-0.5">
                  <Pencil className="w-3 h-3" />
                </button>
                <button onClick={() => onDeleteSet(exercise.id, set.id)} className="opacity-0 group-hover/set:opacity-100 hover:text-red-500 transition">
                  <X className="w-3 h-3" />
                </button>
              </div>
            )
          ))}
        </div>
      )}

      {addingSet ? (
        <form onSubmit={handleAddSet} className="flex items-center gap-2">
          <input autoFocus type="number" placeholder={`Weight (${weightUnit})`} value={setForm.weight}
            onChange={e => setSetForm(f => ({ ...f, weight: e.target.value }))}
            className="w-32 text-sm border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" min="0" step="0.5" />
          <input type="number" placeholder="Reps" value={setForm.reps}
            onChange={e => setSetForm(f => ({ ...f, reps: e.target.value }))}
            className="w-20 text-sm border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" min="1" />
          <button type="submit" className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Add</button>
          <button type="button" onClick={() => { setAddingSet(false); setSetForm({ weight: "", reps: "" }); }}
            className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
        </form>
      ) : (
        <button onClick={() => setAddingSet(true)}
          className={cn("text-xs font-medium px-3 py-1.5 rounded-xl border transition flex items-center gap-1", dayConfig.lightBg, dayConfig.border, dayConfig.text, "hover:opacity-80")}>
          <Plus className="w-3 h-3" /> Add Set
        </button>
      )}
    </div>
  );
}

// ── WorkoutTab ────────────────────────────────────────────────────────────────
function WorkoutTab({ day, weightUnit, onUpdate }) {
  const dayConfig     = getColorConfig(day.colorIndex);
  const exercises     = day.exercises || [];
  const [addingExercise, setAddingExercise] = useState(false);
  const [newName, setNewName] = useState("");
  const [dragIndex, setDragIndex]         = useState(null);
  const [dragOverIndex, setDragOverIndex] = useState(null);

  function getBestWeight(sets) {
    if (!sets || sets.length === 0) return null;
    return Math.max(...sets.map(s => s.weight));
  }

  function handleAddExercise(e) {
    e.preventDefault();
    if (!newName.trim()) return;
    onUpdate([...exercises, { id: generateId(), name: newName.trim(), sets: [], weight_log: [] }]);
    setNewName("");
    setAddingExercise(false);
    toast.success("Exercise added!");
  }

  function handleDeleteExercise(id) {
    if (!window.confirm("Remove this exercise?")) return;
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    onUpdate(exercises.filter(ex => ex.id !== id));
    toast.success("Exercise removed.");
  }

  function handleAddSet(exerciseId, set) {
    onUpdate(exercises.map(ex => ex.id === exerciseId ? { ...ex, sets: [...ex.sets, set] } : ex));
  }

  function handleDeleteSet(exerciseId, setId) {
    if (!window.confirm("Remove this set?")) return;
    if (!window.confirm("Are you sure? This cannot be undone.")) return;
    onUpdate(exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const oldBest = getBestWeight(ex.sets);
      const newSets = ex.sets.filter(s => s.id !== setId);
      const newBest = getBestWeight(newSets);
      return {
        ...ex,
        sets: newSets,
        ...(oldBest !== null && newBest !== oldBest ? { prev_best_weight: oldBest } : {}),
      };
    }));
  }

  function handleEditSet(exerciseId, setId, updates) {
    onUpdate(exercises.map(ex => {
      if (ex.id !== exerciseId) return ex;
      const oldBest = getBestWeight(ex.sets);
      const newSets = ex.sets.map(s => s.id === setId ? { ...s, ...updates } : s);
      const newBest = getBestWeight(newSets);
      return {
        ...ex,
        sets: newSets,
        ...(oldBest !== null && newBest !== oldBest ? { prev_best_weight: oldBest } : {}),
      };
    }));
  }

  function handleEditName(exerciseId, newNameVal) {
    onUpdate(exercises.map(ex => ex.id === exerciseId ? { ...ex, name: newNameVal } : ex));
  }

  function handleReorder(from, to) {
    if (from === null || from === to) { setDragIndex(null); setDragOverIndex(null); return; }
    const next = [...exercises];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    onUpdate(next);
    setDragIndex(null);
    setDragOverIndex(null);
  }

  return (
    <div>
      {exercises.length === 0 && !addingExercise && (
        <div className="text-center py-10 text-slate-400">
          <Dumbbell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm font-medium">No exercises yet</p>
          <p className="text-xs mt-1">Add your first exercise for {day.name}</p>
        </div>
      )}
      {exercises.map((ex, idx) => (
        <div
          key={ex.id}
          draggable
          onDragStart={() => setDragIndex(idx)}
          onDragOver={(e) => { e.preventDefault(); setDragOverIndex(idx); }}
          onDrop={() => handleReorder(dragIndex, idx)}
          onDragEnd={() => { setDragIndex(null); setDragOverIndex(null); }}
        >
          <ExerciseCard exercise={ex} dayConfig={dayConfig} weightUnit={weightUnit}
            onDelete={handleDeleteExercise} onAddSet={handleAddSet}
            onDeleteSet={handleDeleteSet} onEditSet={handleEditSet} onEditName={handleEditName}
            isDragOver={dragOverIndex === idx && dragIndex !== idx}
            dragHandleProps={{}} />
        </div>
      ))}
      {addingExercise ? (
        <form onSubmit={handleAddExercise} className="flex items-center gap-2 mt-2">
          <input autoFocus value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Exercise name (e.g. Bench Press)"
            className="flex-1 text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          <button type="submit" className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Add</button>
          <button type="button" onClick={() => { setAddingExercise(false); setNewName(""); }}
            className="px-3 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
        </form>
      ) : (
        <button onClick={() => setAddingExercise(true)}
          className="mt-2 w-full py-2.5 rounded-xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add Exercise
        </button>
      )}
    </div>
  );
}

// ── PhotosTab ─────────────────────────────────────────────────────────────────
function PhotosTab({ physique, onUpdate }) {
  const panels = physique.panels || [];
  const [fullscreenPanel, setFullscreenPanel] = useState(null);
  const [zoomedImage, setZoomedImage] = useState(null);
  const [addingPanel, setAddingPanel] = useState(false);
  const [newDate, setNewDate]   = useState(() => new Date().toISOString().split("T")[0]);
  const [newLabel, setNewLabel] = useState("");
  const addPhotoRefs = useRef({});
  const fsPhotoRef   = useRef(null);

  async function handleCreatePanel(e) {
    e.preventDefault();
    if (!newDate) return;
    const panel = { id: generateId(), date: newDate, label: newLabel.trim(), images: [] };
    onUpdate({ panels: [panel, ...panels] });
    setNewDate(new Date().toISOString().split("T")[0]);
    setNewLabel("");
    setAddingPanel(false);
    toast.success("Check-in created!");
  }

  async function handleAddImages(panelId, files, isFullscreen = false) {
    const updated = panels.map(p => ({ ...p, images: [...p.images] }));
    const panel   = updated.find(p => p.id === panelId);
    if (!panel) return;
    for (const file of Array.from(files)) {
      if (!file.type.startsWith("image/")) continue;
      try {
        const dataUrl = await compressImage(file);
        panel.images.push({ id: generateId(), dataUrl, name: file.name });
      } catch {
        toast.error(`Failed to load ${file.name}`);
      }
    }
    onUpdate({ panels: updated });
    if (isFullscreen) {
      setFullscreenPanel(updated.find(p => p.id === panelId) || null);
    }
  }

  function handleDeleteImage(panelId, imageId, isFullscreen = false) {
    const updated = panels.map(p =>
      p.id === panelId ? { ...p, images: p.images.filter(i => i.id !== imageId) } : p
    );
    onUpdate({ panels: updated });
    if (isFullscreen) {
      setFullscreenPanel(updated.find(p => p.id === panelId) || null);
    }
  }

  function handleDeletePanel(panelId) {
    onUpdate({ panels: panels.filter(p => p.id !== panelId) });
    setFullscreenPanel(null);
    toast.success("Check-in deleted.");
  }

  const sortedPanels = [...panels].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <>
      {/* Fullscreen overlay */}
      {fullscreenPanel && (
        <div className="fixed inset-0 z-50 bg-white flex flex-col" style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0 }}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-4 flex-shrink-0 border-b border-slate-100">
            <button onClick={() => setFullscreenPanel(null)}
              className="flex items-center gap-2 text-slate-700 hover:text-slate-900 transition text-sm font-medium">
              <ArrowLeft className="w-5 h-5" /> Back
            </button>
            <div className="text-center">
              <p className="text-slate-800 font-semibold text-sm">
                {new Date(fullscreenPanel.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
              </p>
              {fullscreenPanel.label && (
                <p className="text-slate-500 text-xs">{fullscreenPanel.label}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => fsPhotoRef.current?.click()}
                className="text-xs text-slate-600 hover:text-slate-800 border border-slate-300 px-3 py-1.5 rounded-xl transition flex items-center gap-1">
                <Plus className="w-3.5 h-3.5" /> Photos
              </button>
              <input ref={fsPhotoRef} type="file" accept="image/*" multiple className="hidden"
                onChange={e => { handleAddImages(fullscreenPanel.id, e.target.files, true); e.target.value = ""; }} />
              <button onClick={() => handleDeletePanel(fullscreenPanel.id)}
                className="p-2 rounded-xl border border-slate-200 text-red-400 hover:text-red-500 hover:border-red-300 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Images */}
          <div className="flex-1 overflow-y-auto px-4 pb-6 pt-4">
            {fullscreenPanel.images.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 gap-3">
                <Camera className="w-12 h-12 opacity-40" />
                <p className="text-sm">No photos yet</p>
                <button onClick={() => fsPhotoRef.current?.click()}
                  className="text-sm text-indigo-600 border border-indigo-300 px-4 py-2 rounded-xl hover:bg-indigo-50 transition">
                  Add photos
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 max-w-2xl mx-auto">
                {fullscreenPanel.images.map(img => (
                  <div key={img.id} className="relative group aspect-square rounded-2xl overflow-hidden bg-slate-100">
                    <img
                      src={img.dataUrl}
                      alt={img.name}
                      className="w-full h-full object-cover cursor-zoom-in"
                      onClick={() => setZoomedImage(img)}
                    />
                    <button
                      onClick={() => handleDeleteImage(fullscreenPanel.id, img.id, true)}
                      className="absolute top-2 right-2 p-1.5 rounded-full bg-black/50 text-white opacity-0 group-hover:opacity-100 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Photo lightbox */}
      {zoomedImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-4"
          onClick={() => setZoomedImage(null)}
        >
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" />
          <img
            src={zoomedImage.dataUrl}
            alt={zoomedImage.name}
            className="relative z-10 rounded-2xl shadow-2xl object-contain"
            style={{ maxWidth: "90vw", maxHeight: "90vh" }}
            onClick={(e) => e.stopPropagation()}
          />
          <button
            className="absolute top-4 right-4 z-10 p-2 rounded-full bg-black/50 text-white hover:bg-black/70 transition"
            onClick={() => setZoomedImage(null)}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
      )}

      {/* List view */}
      <div>
        {addingPanel ? (
          <form onSubmit={handleCreatePanel} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-5">
            <p className="text-sm font-semibold text-slate-700 mb-3">New Check-in</p>
            <div className="flex flex-wrap gap-2 items-center">
              <input type="date" value={newDate} onChange={e => setNewDate(e.target.value)}
                className="text-sm border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" required />
              <input type="text" placeholder="Label (optional, e.g. Week 4)" value={newLabel} onChange={e => setNewLabel(e.target.value)}
                className="flex-1 min-w-[160px] text-sm border border-slate-300 rounded-xl px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button type="submit" className="px-4 py-1.5 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition">Create</button>
              <button type="button" onClick={() => setAddingPanel(false)}
                className="px-3 py-1.5 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-100 transition">Cancel</button>
            </div>
          </form>
        ) : (
          <button onClick={() => setAddingPanel(true)}
            className="w-full mb-5 py-3 rounded-2xl border-2 border-dashed border-slate-200 text-sm font-medium text-slate-400 hover:border-indigo-300 hover:text-indigo-500 hover:bg-indigo-50/50 transition flex items-center justify-center gap-2">
            <Camera className="w-4 h-4" /> New Check-in
          </button>
        )}

        {sortedPanels.length === 0 && (
          <div className="text-center py-12 text-slate-400">
            <Camera className="w-10 h-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-medium">No check-ins yet</p>
            <p className="text-xs mt-1">Create your first check-in to start tracking your physique</p>
          </div>
        )}

        {sortedPanels.map(panel => (
          <button
            key={panel.id}
            onClick={() => setFullscreenPanel(panel)}
            className="w-full text-left bg-white rounded-2xl border border-slate-200 px-5 py-4 mb-3 hover:border-indigo-300 hover:bg-indigo-50/30 transition group"
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-slate-800 text-sm">
                  Photos — {new Date(panel.date + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                </p>
                {panel.label && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 mt-1 inline-block">
                    {panel.label}
                  </span>
                )}
                <p className="text-xs text-slate-400 mt-0.5">{panel.images.length} photo{panel.images.length !== 1 ? "s" : ""}</p>
              </div>
              <Camera className="w-5 h-5 text-slate-300 group-hover:text-indigo-400 transition" />
            </div>
          </button>
        ))}
      </div>
    </>
  );
}

// ── BodyweightTab ─────────────────────────────────────────────────────────────
function BodyweightTab({ bodyweight, onUpdate }) {
  const logs = bodyweight.logs || [];
  const [date, setDate]     = useState(() => new Date().toISOString().split("T")[0]);
  const [weight, setWeight] = useState("");
  const [bodyfat, setBodyfat] = useState("");
  const weightUnit = "kg"; // inherits from parent if needed — keep simple here

  const lastLog = logs.length > 0
    ? [...logs].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  const daysSinceWeigh = lastLog
    ? differenceInDays(new Date(), parseISO(lastLog.date))
    : null;

  function handleAdd(e) {
    e.preventDefault();
    if (!weight || !date) return;
    const entry = {
      id: generateId(),
      date,
      weight: parseFloat(weight),
      ...(bodyfat ? { bodyfat: parseFloat(bodyfat) } : {}),
    };
    onUpdate({ logs: [entry, ...logs] });
    setWeight("");
    setBodyfat("");
    toast.success("Entry logged!");
  }

  function handleDelete(id) {
    onUpdate({ logs: logs.filter(l => l.id !== id) });
  }

  const sortedLogs = [...logs].sort((a, b) => b.date.localeCompare(a.date));

  return (
    <div>
      {/* Last weighed indicator */}
      {daysSinceWeigh !== null && (
        <div className="bg-indigo-50 border border-indigo-100 rounded-2xl px-4 py-3 mb-5 flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-indigo-700">
              Last weighed {daysSinceWeigh === 0 ? "today" : `${daysSinceWeigh} day${daysSinceWeigh !== 1 ? "s" : ""} ago`}
            </p>
            <p className="text-xs text-indigo-500 mt-0.5">
              {lastLog.weight} kg{lastLog.bodyfat ? ` · ${lastLog.bodyfat}% body fat` : ""}
            </p>
          </div>
          <Scale className="w-5 h-5 text-indigo-400" />
        </div>
      )}

      {/* Add entry form */}
      <form onSubmit={handleAdd} className="bg-slate-50 rounded-2xl border border-slate-200 p-4 mb-6">
        <p className="text-sm font-semibold text-slate-700 mb-3">Log Weight</p>
        <div className="flex flex-wrap gap-2 items-center">
          <GymDatePicker selectedDate={date} onSelect={setDate} />
          <div className="relative">
            <input type="number" value={weight} onChange={e => setWeight(e.target.value)}
              placeholder="Weight (kg)" step="0.1" min="1" required
              className="w-36 text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <div className="relative">
            <input type="number" value={bodyfat} onChange={e => setBodyfat(e.target.value)}
              placeholder="Body fat % (optional)" step="0.1" min="1" max="60"
              className="w-44 text-sm border border-slate-300 rounded-xl px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
          </div>
          <button type="submit" disabled={!weight}
            className="px-4 py-2 rounded-xl bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5">
            <Plus className="w-4 h-4" /> Log
          </button>
        </div>
      </form>

      {/* Log list */}
      {sortedLogs.length === 0 ? (
        <div className="text-center py-12 text-slate-400">
          <Scale className="w-10 h-10 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">No entries yet</p>
          <p className="text-xs mt-1">Log your first weigh-in above</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sortedLogs.map(log => (
            <div key={log.id} className="bg-white rounded-2xl border border-slate-200 px-5 py-3 flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-800">
                  {new Date(log.date + "T12:00:00").toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                </p>
                <p className="text-xs text-slate-500 mt-0.5">
                  {log.weight} kg{log.bodyfat ? ` · ${log.bodyfat}% body fat` : ""}
                </p>
              </div>
              <button onClick={() => handleDelete(log.id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── ProgressTab ───────────────────────────────────────────────────────────────
function ProgressTab({ gymData, bodyweight }) {
  const logs = (bodyweight.logs || []).filter(l => l.weight);
  const sortedLogs = [...logs].sort((a, b) => a.date.localeCompare(b.date)).slice(-30);

  const lastLog = logs.length > 0
    ? [...logs].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;
  const daysSince = lastLog ? differenceInDays(new Date(), parseISO(lastLog.date)) : null;

  const weightChartData = sortedLogs.map(l => ({
    date: new Date(l.date + "T12:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" }),
    weight: l.weight,
    bodyfat: l.bodyfat ?? null,
  }));

  const CustomTooltip = ({ active, payload }) => {
    if (active && payload?.length) {
      const d = payload[0].payload;
      return (
        <div className="bg-white border border-slate-200 rounded-xl px-3 py-2 shadow-lg">
          <p className="text-xs font-semibold text-slate-700">{d.date}</p>
          <p className="text-xs text-indigo-600">{d.weight} kg</p>
          {d.bodyfat && <p className="text-xs text-slate-500">{d.bodyfat}% body fat</p>}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Weight history */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-slate-700">Bodyweight History</h3>
          {daysSince !== null && (
            <span className="text-xs text-slate-500">
              Last weighed: {daysSince === 0 ? "today" : `${daysSince}d ago`} · {lastLog.weight} kg
            </span>
          )}
        </div>
        {weightChartData.length >= 2 ? (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={weightChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} />
                <YAxis domain={["auto", "auto"]} axisLine={false} tickLine={false} tick={{ fontSize: 11, fill: "#94a3b8" }} width={36} />
                <Tooltip content={<CustomTooltip />} />
                <Line type="monotone" dataKey="weight" stroke="#6366f1" strokeWidth={2} dot={{ r: 3, fill: "#6366f1" }} activeDot={{ r: 5 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-100 px-5 py-8 text-center text-slate-400">
            <Scale className="w-8 h-8 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Log at least 2 weigh-ins to see the chart</p>
          </div>
        )}
      </div>

      {/* Current exercise summary with previous kg */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-3">Current Programme</h3>
        <div className="space-y-3">
          {(gymData.workout_days || []).map(day => {
            const cfg = getColorConfig(day.colorIndex);
            const exs = day.exercises || [];
            if (exs.length === 0) return null;
            return (
              <div key={day.id} className={cn("rounded-2xl border px-4 py-3", cfg.lightBg, cfg.border)}>
                <p className={cn("text-sm font-bold mb-2", cfg.text)}>{day.name}</p>
                <div className="space-y-1.5">
                  {exs.map(ex => {
                    const best = (ex.sets || []).reduce((b, s) => (!b || s.weight > b.weight ? s : b), null);
                    const prev = ex.prev_best_weight;
                    const showPrev = prev !== undefined && prev !== null && best && prev !== best.weight;
                    return (
                      <div key={ex.id} className="flex items-center justify-between gap-2">
                        <p className="text-xs text-slate-600 min-w-0 truncate">{ex.name}</p>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {showPrev && (
                            <p className="text-xs text-slate-400 line-through">{prev} kg</p>
                          )}
                          {best && (
                            <p className="text-xs font-semibold text-slate-700">{best.weight} kg × {best.reps}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          }).filter(Boolean)}
        </div>
      </div>
    </div>
  );
}

// ── AICoachTab ────────────────────────────────────────────────────────────────
function AICoachTab({ gymData, onDataChange }) {
  const [messages, setMessages]           = useState(() => loadChat());
  const [input, setInput]                 = useState("");
  const [loading, setLoading]             = useState(false);
  const [attachments, setAttachments]     = useState([]);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds]     = useState(new Set());
  const fileInputRef = useRef(null);
  const bottomRef    = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    const handler = () => onDataChange?.();
    window.addEventListener("gym-data-updated", handler);
    return () => window.removeEventListener("gym-data-updated", handler);
  }, [onDataChange]);

  function buildContext() {
    const lines = ["## Current Gym Data"];
    if (gymData.weight_unit) lines.push(`Weight unit: ${gymData.weight_unit}`);
    for (const day of (gymData.workout_days || [])) {
      lines.push(`\n### ${day.name} Day`);
      if ((day.exercises || []).length === 0) {
        lines.push("No exercises added yet.");
      } else {
        day.exercises.forEach(ex => {
          const setStr = (ex.sets || []).map((s, i) => `Set ${i + 1}: ${s.weight} ${gymData.weight_unit} × ${s.reps}`).join(", ");
          lines.push(`- ${ex.name}: ${setStr || "no sets logged"}`);
        });
      }
    }
    return lines.join("\n");
  }

  async function handleFileSelect(e) {
    for (const file of Array.from(e.target.files || [])) {
      if (!file.type.startsWith("image/")) { toast.error("Only images are supported"); continue; }
      if (file.size > 20 * 1024 * 1024) { toast.error(`${file.name} is too large`); continue; }
      try {
        const data    = await readAsBase64(file);
        const preview = URL.createObjectURL(file);
        setAttachments(prev => [...prev, { id: generateId(), name: file.name, mediaType: file.type, data, preview }]);
      } catch { toast.error(`Failed to read ${file.name}`); }
    }
    e.target.value = "";
  }

  async function handleSend(e) {
    e.preventDefault();
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const displayMsg = {
      role: "user",
      content: input.trim(),
      ...(attachments.length > 0 && { _attachments: attachments.map(a => ({ name: a.name, mediaType: a.mediaType, preview: a.preview })) }),
    };

    let apiContent;
    if (attachments.length > 0) {
      apiContent = [];
      for (const att of attachments) {
        apiContent.push({ type: "image", source: { type: "base64", media_type: att.mediaType, data: att.data } });
      }
      if (input.trim()) apiContent.push({ type: "text", text: input.trim() });
    } else {
      apiContent = input.trim();
    }

    const updatedDisplay = [...messages, displayMsg];
    setMessages(updatedDisplay);
    saveChat(updatedDisplay);
    setInput("");
    setAttachments([]);
    setLoading(true);

    const apiHistory = [
      ...messages.map(m => ({ role: m.role, content: m.content || "" })),
      { role: "user", content: apiContent },
    ];

    try {
      const context = buildContext();
      const reply   = await sendGymMessage(apiHistory, context);
      onDataChange?.();
      const withReply = [...updatedDisplay, { role: "assistant", content: reply }];
      setMessages(withReply);
      saveChat(withReply);
    } catch {
      toast.error("Couldn't reach AI coach. Check your connection.");
    } finally {
      setLoading(false);
    }
  }

  function handleToggleSelect(idx) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  }

  function handleSelectAll() {
    if (selectedIds.size === messages.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(messages.map((_, i) => i)));
  }

  function handleDeleteSelected() {
    const newMsgs = messages.filter((_, i) => !selectedIds.has(i));
    setMessages(newMsgs);
    saveChat(newMsgs);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  }

  const QUICK = [
    "What should I focus on today?",
    "How should I progress on bench press?",
    "Tips for recovery between sessions?",
  ];

  return (
    <div className="flex flex-col" style={{ minHeight: 420 }}>
      {/* Selection toolbar */}
      {isSelectionMode && (
        <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl mb-3 flex items-center justify-between flex-shrink-0">
          <button onClick={handleSelectAll} className="flex items-center gap-1.5 text-sm text-indigo-700 font-medium">
            {selectedIds.size === messages.length ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
            {selectedIds.size === messages.length ? "Deselect All" : "Select All"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-600">{selectedIds.size} selected</span>
            <button onClick={handleDeleteSelected}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition">
              <Trash2 className="w-3.5 h-3.5" /> Delete
            </button>
            <button onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
              className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-sm border border-slate-200 hover:bg-slate-50 transition">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 pr-1" style={{ maxHeight: 420 }}>
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center mx-auto mb-3">
              <Bot className="w-7 h-7 text-indigo-500" />
            </div>
            <p className="font-semibold text-slate-700 mb-1">Your AI Gym Coach</p>
            <p className="text-sm text-slate-500 mb-5">Ask me to add exercises, log weights, or give advice</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {QUICK.map(p => (
                <button key={p} onClick={() => setInput(p)}
                  className="text-xs px-3 py-1.5 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-200 hover:bg-indigo-100 transition">{p}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i}
            className={cn("flex", m.role === "user" ? "justify-end" : "justify-start", isSelectionMode && "cursor-pointer")}
            onContextMenu={(e) => { e.preventDefault(); setIsSelectionMode(true); handleToggleSelect(i); }}
            onClick={isSelectionMode ? () => handleToggleSelect(i) : undefined}
          >
            {isSelectionMode && (
              <button className="mt-1 mr-2 flex-shrink-0 text-slate-400 hover:text-indigo-600 transition">
                {selectedIds.has(i) ? <CheckSquare className="w-4 h-4 text-indigo-600" /> : <Square className="w-4 h-4" />}
              </button>
            )}
            {m.role === "assistant" && !isSelectionMode && (
              <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Bot className="w-4 h-4 text-indigo-600" />
              </div>
            )}
            <div className={cn(
              "max-w-[80%] rounded-2xl text-sm leading-relaxed",
              m.role === "user" ? "bg-indigo-600 text-white rounded-br-sm" : "bg-white border border-slate-200 text-slate-700 rounded-bl-sm",
              isSelectionMode && selectedIds.has(i) && "ring-2 ring-indigo-400"
            )}>
              {m._attachments?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 p-2 pb-0">
                  {m._attachments.map((att, ai) => (
                    <img key={ai} src={att.preview} alt={att.name}
                      className="max-w-[180px] max-h-[140px] rounded-xl object-cover border border-indigo-300" />
                  ))}
                </div>
              )}
              {m.content && <div className="px-4 py-2.5 whitespace-pre-wrap">{m.content}</div>}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-xl bg-indigo-100 flex items-center justify-center flex-shrink-0 mr-2">
              <Bot className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl rounded-bl-sm px-4 py-2.5">
              <Loader2 className="w-4 h-4 animate-spin text-indigo-400" />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Attachment previews */}
      {attachments.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {attachments.map(att => (
            <div key={att.id} className="relative group">
              <img src={att.preview} alt={att.name} className="w-16 h-16 rounded-xl object-cover border border-slate-200" />
              <button onClick={() => setAttachments(prev => prev.filter(a => a.id !== att.id))}
                className="absolute -top-1 -right-1 p-0.5 rounded-full bg-slate-700 text-white opacity-0 group-hover:opacity-100 transition">
                <X className="w-3 h-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Input */}
      <form onSubmit={handleSend} className="flex gap-2">
        <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileSelect} />
        <button type="button" onClick={() => fileInputRef.current?.click()} disabled={loading}
          className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:text-indigo-500 hover:border-indigo-300 hover:bg-indigo-50 transition disabled:opacity-40">
          <Paperclip className="w-4 h-4" />
        </button>
        <input value={input} onChange={e => setInput(e.target.value)} placeholder="Ask your gym coach..."
          className="flex-1 text-sm border border-slate-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white" disabled={loading} />
        <button type="submit" disabled={loading || (!input.trim() && attachments.length === 0)}
          className="px-4 py-2.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition flex items-center gap-1.5 text-sm font-medium">
          <Send className="w-4 h-4" />
        </button>
      </form>
      {messages.length > 0 && !isSelectionMode && (
        <button onClick={() => { setMessages([]); saveChat([]); }}
          className="text-xs text-slate-400 hover:text-slate-600 mt-2 text-center w-full transition">
          Clear chat
        </button>
      )}
    </div>
  );
}

// ── Main Gym page ─────────────────────────────────────────────────────────────
export default function Gym() {
  const [gymData, setGymData]         = useState(loadData);
  const [physique, setPhysique]       = useState(loadPhysique);
  const [bodyweight, setBodyweight]   = useState(loadBodyweight);
  const [activeTab, setActiveTab]     = useState(() => {
    const d = loadData();
    return d.workout_days?.[0]?.id || "physique";
  });
  const [addingDay, setAddingDay]         = useState(false);
  const [newDayName, setNewDayName]       = useState("");
  const [pendingDeleteDayId, setPendingDeleteDayId] = useState(null);
  const [dayDragIndex, setDayDragIndex]   = useState(null);
  const [dayDragOverIndex, setDayDragOverIndex] = useState(null);
  const tabBarRef = useRef(null);

  // Cancel pending delete when clicking outside tab bar
  useEffect(() => {
    if (!pendingDeleteDayId) return;
    const handler = (e) => {
      if (!tabBarRef.current?.contains(e.target)) setPendingDeleteDayId(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pendingDeleteDayId]);

  function updateAndSave(patch) {
    const updated = { ...gymData, ...patch };
    setGymData(updated);
    saveData(updated);
  }

  function handleExercisesUpdate(dayId, exercises) {
    const newDays = gymData.workout_days.map(d => d.id === dayId ? { ...d, exercises } : d);
    updateAndSave({ workout_days: newDays });
  }

  function handlePhysiqueUpdate(patch) {
    const updated = { ...physique, ...patch };
    setPhysique(updated);
    savePhysique(updated);
  }

  function handleBodyweightUpdate(patch) {
    const updated = { ...bodyweight, ...patch };
    setBodyweight(updated);
    saveBodyweight(updated);
  }

  function handleAddDay(e) {
    e.preventDefault();
    if (!newDayName.trim()) return;
    const usedColors = gymData.workout_days.map(d => d.colorIndex);
    let colorIndex = 0;
    while (usedColors.includes(colorIndex) && colorIndex < DAY_COLORS.length - 1) colorIndex++;
    const newDay = { id: generateId(), name: newDayName.trim(), colorIndex, exercises: [] };
    const newDays = [...gymData.workout_days, newDay];
    updateAndSave({ workout_days: newDays });
    setActiveTab(newDay.id);
    setNewDayName("");
    setAddingDay(false);
    toast.success(`"${newDay.name}" day added!`);
  }

  function handleDeleteDay(dayId) {
    const day = gymData.workout_days.find(d => d.id === dayId);
    if (!day) return;
    const newDays = gymData.workout_days.filter(d => d.id !== dayId);
    updateAndSave({ workout_days: newDays });
    if (activeTab === dayId) setActiveTab(newDays[0]?.id || "physique");
    setPendingDeleteDayId(null);
    toast.success(`"${day.name}" day removed.`);
  }

  function handleDayReorder(from, to) {
    if (from === null || from === to) { setDayDragIndex(null); setDayDragOverIndex(null); return; }
    const next = [...gymData.workout_days];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    updateAndSave({ workout_days: next });
    setDayDragIndex(null);
    setDayDragOverIndex(null);
  }

  // Current weight from most recent bodyweight log
  const latestBodyweightLog = (bodyweight.logs || []).length > 0
    ? [...bodyweight.logs].sort((a, b) => b.date.localeCompare(a.date))[0]
    : null;

  const totalExercises = (gymData.workout_days || []).reduce((sum, d) => sum + (d.exercises?.length || 0), 0);

  // Tabs: [...workout days], physique, bodyweight, progress, ai
  const staticTabs = [
    { key: "physique",    label: "Physique"   },
    { key: "bodyweight",  label: "Bodyweight" },
    { key: "progress",    label: "Progress"   },
    { key: "ai",          label: "AI Coach"   },
  ];

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center shadow-sm">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-slate-800">Gym Tracker</h1>
            <p className="text-sm text-slate-500">Track workouts, weight & progress</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* Current Weight — read-only, sourced from Bodyweight tab */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between">
            <p className="text-xs text-slate-500 font-medium">Current Weight</p>
            <Scale className="w-4 h-4 text-indigo-400" />
          </div>
          {latestBodyweightLog ? (
            <div className="flex items-baseline gap-1 mt-2">
              <span className="text-2xl font-bold text-indigo-600">{latestBodyweightLog.weight}</span>
              <span className="text-sm text-slate-500">kg</span>
            </div>
          ) : (
            <p className="text-sm text-slate-400 italic mt-2">Log in Bodyweight tab</p>
          )}
          <div className="flex gap-1 mt-2">
            <span className="text-xs px-2 py-0.5 rounded-lg font-medium bg-indigo-100 text-indigo-700">kg</span>
          </div>
        </div>

        {/* Total Exercises */}
        <div className="bg-white rounded-2xl border border-slate-200 px-5 py-4">
          <div className="flex items-start justify-between">
            <p className="text-xs text-slate-500 font-medium">Exercises</p>
            <Dumbbell className="w-4 h-4 text-emerald-500" />
          </div>
          <p className="text-2xl font-bold text-emerald-600 mt-2">{totalExercises}</p>
          <p className="text-xs text-slate-400 mt-0.5">across {gymData.workout_days?.length || 0} days</p>
        </div>
      </div>

      {/* Dynamic day breakdown */}
      {(gymData.workout_days || []).length > 0 && (
        <div className="grid grid-cols-3 gap-3 mb-8">
          {gymData.workout_days.map(d => {
            const cfg = getColorConfig(d.colorIndex);
            return (
              <div key={d.id} className={cn("rounded-xl border px-4 py-3 flex items-center gap-3", cfg.lightBg, cfg.border)}>
                <div className={cn("w-2.5 h-2.5 rounded-full flex-shrink-0", cfg.dot)} />
                <div className="min-w-0">
                  <p className={cn("text-sm font-bold truncate", cfg.text)}>{d.name}</p>
                  <p className="text-xs text-slate-500">{d.exercises?.length || 0} exercises</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Tabs */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div ref={tabBarRef} className="flex gap-1 border-b border-slate-100 mb-6 -mx-1 overflow-x-auto">
          {/* Workout day tabs with double-confirm delete + drag reorder */}
          {(gymData.workout_days || []).map((day, idx) => {
            const isPending = pendingDeleteDayId === day.id;
            const isDayDragOver = dayDragOverIndex === idx && dayDragIndex !== idx;
            return (
              <div
                key={day.id}
                className={cn("relative flex-shrink-0 group/tab cursor-grab active:cursor-grabbing transition-all", isDayDragOver && "opacity-50")}
                draggable
                onDragStart={() => setDayDragIndex(idx)}
                onDragOver={(e) => { e.preventDefault(); setDayDragOverIndex(idx); }}
                onDrop={() => handleDayReorder(dayDragIndex, idx)}
                onDragEnd={() => { setDayDragIndex(null); setDayDragOverIndex(null); }}
              >
                <button
                  onClick={() => { setActiveTab(day.id); setPendingDeleteDayId(null); }}
                  className={cn(
                    "pl-4 pr-7 py-2.5 text-sm font-medium rounded-t-lg transition-all -mb-px border-b-2 whitespace-nowrap",
                    activeTab === day.id
                      ? "text-indigo-600 border-indigo-500 bg-indigo-50/60"
                      : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
                  )}
                >
                  {day.name}
                </button>
                {/* Delete button — first click shows "Delete?", second click confirms */}
                {isPending ? (
                  <button
                    onClick={e => { e.stopPropagation(); handleDeleteDay(day.id); }}
                    className="absolute right-0.5 top-1/2 -translate-y-1/2 mt-[-2px] px-1.5 py-0.5 rounded text-xs font-bold text-white bg-red-500 hover:bg-red-600 transition"
                  >
                    Del?
                  </button>
                ) : (
                  <button
                    onClick={e => { e.stopPropagation(); setPendingDeleteDayId(day.id); }}
                    className="absolute right-1 top-1/2 -translate-y-1/2 mt-[-2px] p-0.5 rounded text-slate-300 hover:text-red-500 hover:bg-red-50 transition opacity-0 group-hover/tab:opacity-100"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {/* Add day button */}
          {addingDay ? (
            <form onSubmit={handleAddDay} className="flex items-center gap-1 px-1 flex-shrink-0">
              <input autoFocus value={newDayName} onChange={e => setNewDayName(e.target.value)}
                placeholder="Day name" maxLength={20}
                className="w-28 text-sm border border-slate-300 rounded-lg px-2 py-1 focus:outline-none focus:ring-2 focus:ring-indigo-300" />
              <button type="submit" className="p-1 rounded-lg bg-indigo-600 text-white hover:bg-indigo-700 transition"><Check className="w-3.5 h-3.5" /></button>
              <button type="button" onClick={() => { setAddingDay(false); setNewDayName(""); }}
                className="p-1 rounded-lg bg-slate-100 text-slate-500 hover:bg-slate-200 transition"><X className="w-3.5 h-3.5" /></button>
            </form>
          ) : (
            <button onClick={() => setAddingDay(true)}
              className="px-3 py-2.5 text-sm font-medium text-slate-400 hover:text-indigo-500 hover:bg-indigo-50/50 rounded-t-lg transition flex-shrink-0 flex items-center gap-1">
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}

          {/* Static tabs (right side) */}
          {staticTabs.map(tab => (
            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
              className={cn(
                "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all -mb-px border-b-2 whitespace-nowrap flex-shrink-0",
                activeTab === tab.key
                  ? "text-indigo-600 border-indigo-500 bg-indigo-50/60"
                  : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        {activeTab === "physique" ? (
          <PhotosTab physique={physique} onUpdate={handlePhysiqueUpdate} />
        ) : activeTab === "bodyweight" ? (
          <BodyweightTab bodyweight={bodyweight} onUpdate={handleBodyweightUpdate} />
        ) : activeTab === "progress" ? (
          <ProgressTab gymData={gymData} bodyweight={bodyweight} />
        ) : activeTab === "ai" ? (
          <AICoachTab gymData={gymData} onDataChange={() => setGymData(loadData())} />
        ) : (
          (() => {
            const day = (gymData.workout_days || []).find(d => d.id === activeTab);
            if (!day) return null;
            return (
              <WorkoutTab
                key={day.id}
                day={day}
                weightUnit={gymData.weight_unit}
                onUpdate={(exs) => handleExercisesUpdate(day.id, exs)}
              />
            );
          })()
        )}
      </div>
    </div>
  );
}
