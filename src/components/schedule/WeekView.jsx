import React, { useRef, useState, useCallback } from "react";
import { format, startOfWeek, addDays, isSameDay } from "date-fns";
import { CheckCircle2, Circle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const SLOT_HEIGHT = 44;

function getNowInTimezone(timezone) {
  try {
    const now = new Date();
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: 'numeric',
      hour12: false,
    }).formatToParts(now);
    let h = parseInt(parts.find(p => p.type === 'hour')?.value ?? '');
    let m = parseInt(parts.find(p => p.type === 'minute')?.value ?? '');
    if (isNaN(h)) h = new Date().getHours();
    if (isNaN(m)) m = new Date().getMinutes();
    if (h === 24) h = 0;
    return { hour: h, minute: m };
  } catch {
    return { hour: new Date().getHours(), minute: new Date().getMinutes() };
  }
}
const MIN_HEIGHT = SLOT_HEIGHT / 2;
const SNAP = SLOT_HEIGHT / 4;

const CATEGORY_BLOCK = {
  health: "bg-emerald-100 border-l-emerald-400 text-emerald-800",
  work: "bg-blue-100 border-l-blue-400 text-blue-800",
  learning: "bg-violet-100 border-l-violet-400 text-violet-800",
  personal: "bg-slate-100 border-l-slate-400 text-slate-700",
  social: "bg-pink-100 border-l-pink-400 text-pink-800",
  mindfulness: "bg-amber-100 border-l-amber-400 text-amber-800",
  other: "bg-gray-100 border-l-gray-400 text-gray-800",
};

function taskAppliesOnDate(task, date) {
  const dow = format(date, "EEEE").toLowerCase();
  const isWeekday = !["saturday", "sunday"].includes(dow);
  const dateStr = format(date, "yyyy-MM-dd");
  if (task.frequency === "once") return task.scheduled_date === dateStr;
  if (task.frequency === "daily") return true;
  if (task.frequency === "weekdays") return isWeekday;
  if (task.frequency === "weekends") return !isWeekday;
  if (task.frequency === dow) return true;
  return false;
}

function formatHour(h) {
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

function topToTime(top) {
  const totalMinutes = Math.round((top / SLOT_HEIGHT) * 60 / 15) * 15;
  const hour = Math.floor(totalMinutes / 60) + 6;
  const min = totalMinutes % 60;
  return `${String(Math.min(hour, 23)).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function timeToTop(timeStr) {
  const [h, m] = timeStr.split(":").map(Number);
  return ((h - 6) + m / 60) * SLOT_HEIGHT;
}

function topToMinutes(top) {
  return Math.round((top / SLOT_HEIGHT) * 60);
}

function minutesToTop(min) {
  return (min / 60) * SLOT_HEIGHT;
}

function snap(val) {
  return Math.round(val / SNAP) * SNAP;
}

// Compute side-by-side layout for overlapping tasks within a single day column
function computeLayout(timedTasks, localData) {
  if (timedTasks.length === 0) return [];
  const items = timedTasks.map(task => {
    const ld = localData[task.id];
    const timeStr = ld?.time || task.scheduled_time;
    const top = timeToTop(timeStr);
    const height = minutesToTop(ld?.durationMin ?? 60);
    return { task, top, height, bottom: top + Math.max(MIN_HEIGHT, height) };
  });
  items.sort((a, b) => a.top - b.top);
  // Greedy column assignment
  const colEnds = [];
  const assigned = items.map(item => {
    let col = colEnds.findIndex(end => end <= item.top + 1);
    if (col === -1) col = colEnds.length;
    colEnds[col] = item.bottom;
    return { ...item, col };
  });
  // Each task's totalCols = max col among all tasks that overlap with it + 1
  return assigned.map(item => {
    const totalCols = assigned
      .filter(o => item.top < o.bottom && item.bottom > o.top)
      .reduce((max, o) => Math.max(max, o.col), 0) + 1;
    return { ...item, totalCols };
  });
}

// Static block — renders with drag/resize handles (logic handled at WeekView level)
function TimedTaskBlock({ task, color, completing, onToggle, onRemove, onPointerDown, top, height, col = 0, totalCols = 1 }) {
  const leftPct  = (col / totalCols) * 100;
  const rightPct = ((totalCols - col - 1) / totalCols) * 100;
  return (
    <motion.div
      style={{ top: top + 1, height: Math.max(MIN_HEIGHT, height - 3), zIndex: 5 + col, position: "absolute", left: `calc(${leftPct}% + 2px)`, right: `calc(${rightPct}% + 2px)` }}
      className={`rounded border-l-2 shadow-sm select-none overflow-visible ${color}`}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.25 } }}
      transition={{ duration: 0.15 }}
    >
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center group z-20"
        onPointerDown={(e) => onPointerDown(e, "resize-top")}
      >
        <div className="w-6 h-0.5 rounded-full bg-current opacity-20 group-hover:opacity-60 transition-opacity" />
      </div>

      {/* Main drag area */}
      <div
        className="flex items-center gap-1 px-1.5 py-0.5 h-full cursor-grab active:cursor-grabbing group"
        onPointerDown={(e) => { if (e.target.closest("button")) return; onPointerDown(e, "move"); }}
      >
        <button type="button" className="flex-shrink-0 z-20" onClick={(e) => { e.stopPropagation(); onToggle(); }}>
          {completing
            ? <CheckCircle2 className="w-2.5 h-2.5 text-emerald-500 animate-pulse flex-shrink-0" />
            : <Circle className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />}
        </button>
        <span className={`text-xs font-semibold truncate flex-1 pointer-events-none ${completing ? "line-through opacity-50" : ""}`}>
          {task.name}
        </span>
        <button
          type="button"
          className="flex-shrink-0 p-0.5 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity z-20"
          onClick={(e) => { e.stopPropagation(); onRemove(); }}
        >
          <X className="w-2.5 h-2.5" />
        </button>
      </div>

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center group z-20"
        onPointerDown={(e) => onPointerDown(e, "resize-bottom")}
      >
        <div className="w-6 h-0.5 rounded-full bg-current opacity-20 group-hover:opacity-60 transition-opacity" />
      </div>
    </motion.div>
  );
}

export default function WeekView({ date, tasks, completions, onToggle, onDropTask, onRemoveTask, timezone }) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  const gridRefs = useRef({});
  const scrollContainerRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  const [localData, setLocalData] = useState({});
  const [completing, setCompleting] = useState({}); // { taskId: true }

  // Active drag state — lifted here so ghost can render across columns
  const [activeDrag, setActiveDrag] = useState(null);
  // activeDrag = { taskId, task, color, height, ghostX, ghostY, targetDayIdx, targetTop }
  const dragRef = useRef(null);

  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const { hour: nowHour, minute: nowMin } = getNowInTimezone(tz);

  const isValidTime = (t) => t && typeof t === "string" && t.trim().length >= 4 && t.includes(":");

  // Find which day column index a clientX falls in
  const getDayIdxFromX = useCallback((clientX) => {
    for (let i = 0; i < days.length; i++) {
      const el = gridRefs.current[format(days[i], "yyyy-MM-dd")];
      if (el) {
        const r = el.getBoundingClientRect();
        if (clientX >= r.left && clientX <= r.right) return i;
      }
    }
    // Clamp to edges
    const first = gridRefs.current[format(days[0], "yyyy-MM-dd")];
    const last = gridRefs.current[format(days[days.length - 1], "yyyy-MM-dd")];
    if (first && last) {
      if (clientX < first.getBoundingClientRect().left) return 0;
      if (clientX > last.getBoundingClientRect().right) return days.length - 1;
    }
    return 0;
  }, [days]);

  // Get the pixel offset within a column from clientY
  const getTopInColumn = useCallback((dayIdx, clientY) => {
    const el = gridRefs.current[format(days[dayIdx], "yyyy-MM-dd")];
    if (!el) return 0;
    return Math.max(0, clientY - el.getBoundingClientRect().top);
  }, [days]);

  // Pointer down on a task block — start drag/resize
  const handleTaskPointerDown = useCallback((e, task, color, type = "move") => {
    if (e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const ld = localData[task.id];
    const timeStr = ld?.time || task.scheduled_time;
    const top = isValidTime(timeStr) ? timeToTop(timeStr) : 0;
    const height = minutesToTop(ld?.durationMin ?? 60);
    const startDayIdx = ld?.dayStr
      ? days.findIndex(d => format(d, "yyyy-MM-dd") === ld.dayStr)
      : getDayIdxFromX(e.clientX);

    dragRef.current = {
      type,
      taskId: task.id,
      startClientY: e.clientY,
      startTop: top,
      startHeight: height,
      startDayIdx,
    };

    setActiveDrag({
      type,
      taskId: task.id,
      task,
      color,
      height,
      ghostX: e.clientX,
      ghostY: e.clientY,
      targetDayIdx: startDayIdx,
      targetTop: top,
    });

    // Listen on document so we get events even outside the element
    const onMove = (ev) => {
      if (!dragRef.current) return;
      const { type, startClientY, startTop, startHeight, startDayIdx } = dragRef.current;
      const dy = ev.clientY - startClientY;

      let newTop = startTop;
      let newHeight = startHeight;

      if (type === "move") {
        newTop = snap(Math.max(0, startTop + dy));
        newHeight = startHeight;
      } else if (type === "resize-bottom") {
        newTop = startTop;
        newHeight = snap(Math.max(MIN_HEIGHT, startHeight + dy));
      } else if (type === "resize-top") {
        const rawTop = startTop + dy;
        const snappedTop = snap(Math.max(0, rawTop));
        newTop = snappedTop;
        newHeight = Math.max(MIN_HEIGHT, startHeight - (snappedTop - startTop));
      }

      const targetDayIdx = type === "move" ? getDayIdxFromX(ev.clientX) : startDayIdx;

      // Auto-scroll the timetable grid when dragging near its edges
      const sc = scrollContainerRef.current;
      if (sc) {
        const { top: scTop, bottom: scBottom } = sc.getBoundingClientRect();
        const ZONE = 60, SPEED = 8;
        if (ev.clientY > scBottom - ZONE) sc.scrollTop += SPEED;
        else if (ev.clientY < scTop + ZONE) sc.scrollTop -= SPEED;
      }

      setActiveDrag(prev => prev ? {
        ...prev,
        ghostX: ev.clientX,
        ghostY: ev.clientY,
        targetDayIdx,
        targetTop: newTop,
        height: newHeight,
      } : null);
    };

    const onUp = () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);

      if (!dragRef.current) return;
      const drag = dragRef.current;
      dragRef.current = null;

      setActiveDrag(prev => {
        if (!prev) return null;
        const finalDayStr = format(days[prev.targetDayIdx], "yyyy-MM-dd");
        const newTime = topToTime(prev.targetTop);
        const durationMin = Math.round(topToMinutes(prev.height) / 15) * 15;
        setLocalData(ld => ({ ...ld, [drag.taskId]: { time: newTime, durationMin, dayStr: finalDayStr } }));
        onDropTask?.(drag.taskId, newTime, finalDayStr, durationMin);
        return null;
      });
    };

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
  }, [days, getDayIdxFromX, localData, onDropTask]);

  const handleToggle = useCallback((task, day) => {
    if (completing[task.id]) return;
    setCompleting(prev => ({ ...prev, [task.id]: true }));
    setTimeout(() => {
      onToggle(task, day);
      setCompleting(prev => { const n = { ...prev }; delete n[task.id]; return n; });
    }, 750);
  }, [completing, onToggle]);

  const handleRemoveTask = useCallback((task) => {
    setLocalData(prev => { const u = { ...prev }; delete u[task.id]; return u; });
    onRemoveTask?.(task);
  }, [onRemoveTask]);

  const handleDrop = (e, day) => {
    e.preventDefault();
    const dayStr = format(day, "yyyy-MM-dd");
    const sidebarId = e.dataTransfer.getData("taskId");
    if (sidebarId) {
      const el = gridRefs.current[dayStr];
      const top = el ? Math.max(0, e.clientY - el.getBoundingClientRect().top) : 0;
      const newTime = topToTime(top);
      setLocalData(prev => ({ ...prev, [sidebarId]: { time: newTime, dayStr } }));
      onDropTask?.(sidebarId, newTime, dayStr);
    }
    setDragOver(null);
  };

  const handleDragOver = (e, day) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    const dayStr = format(day, "yyyy-MM-dd");
    const el = gridRefs.current[dayStr];
    const top = el ? Math.max(0, e.clientY - el.getBoundingClientRect().top) : 0;
    const hourIdx = Math.min(Math.floor(top / SLOT_HEIGHT), HOURS.length - 1);
    setDragOver({ dayStr, hour: HOURS[hourIdx] });
  };

  const totalGridHeight = HOURS.length * SLOT_HEIGHT;

  // Ghost column width — approximate from first column
  const getColWidth = () => {
    const el = gridRefs.current[format(days[0], "yyyy-MM-dd")];
    return el ? el.getBoundingClientRect().width : 100;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1 relative">
      {/* Day headers */}
      <div className="flex border-b border-slate-200 sticky top-0 bg-white z-10">
        <div className="w-12 flex-shrink-0 border-r border-slate-100" />
        {days.map((day, i) => {
          const isToday = isSameDay(day, new Date());
          const dateStr = format(day, "yyyy-MM-dd");
          const isTargeted = activeDrag?.targetDayIdx === i;
          return (
            <div
              key={dateStr}
              className={`flex-1 p-2 text-center border-r border-slate-100 last:border-0 transition-colors ${
                isTargeted ? "bg-indigo-100" : isToday ? "bg-indigo-50" : ""
              }`}
            >
              <p className={`text-xs font-semibold uppercase tracking-wide ${isToday || isTargeted ? "text-indigo-500" : "text-slate-400"}`}>
                {format(day, "EEE")}
              </p>
              <div className="flex items-center justify-center gap-1 mt-0.5">
                <p className={`text-base font-bold w-7 h-7 flex items-center justify-center rounded-full ${
                  isToday ? "bg-indigo-600 text-white" : "text-slate-800"
                }`}>
                  {format(day, "d")}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Timetable grid */}
      <div ref={scrollContainerRef} className="flex overflow-y-auto" style={{ maxHeight: "calc(100vh - 220px)" }}>
        {/* Time gutter */}
        <div className="w-12 flex-shrink-0 border-r border-slate-100 relative" style={{ height: totalGridHeight }}>
          {HOURS.map((hour, idx) => (
            <div key={hour} className="absolute left-0 right-0 flex items-start justify-end pr-1.5 pt-1" style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}>
              <span className="text-xs text-slate-400 font-medium leading-none">{formatHour(hour)}</span>
            </div>
          ))}
        </div>

        {/* Day columns */}
        {days.map((day, colIdx) => {
          const dateStr = format(day, "yyyy-MM-dd");
          const isToday = isSameDay(day, new Date());
          const isTargeted = activeDrag?.targetDayIdx === colIdx;
          const completedIds = new Set(
            completions.filter(c => c.completed_date === dateStr).map(c => c.task_id)
          );

          const timedTasks = tasks.filter((t) => {
            const ld = localData[t.id];
            const time = ld?.time !== undefined ? ld.time : t.scheduled_time;
            if (!isValidTime(time)) return false;
            if (completedIds.has(t.id)) return false;
            if (t.id === activeDrag?.taskId) return false; // hide original while dragging
            const assignedDay = ld?.dayStr;
            if (assignedDay !== undefined) return assignedDay === dateStr;
            return taskAppliesOnDate(t, day);
          });

          const isDragTarget = dragOver?.dayStr === dateStr;
          const nowTop = isToday && nowHour >= 6 && nowHour < 24
            ? ((nowHour - 6) + nowMin / 60) * SLOT_HEIGHT : -1;

          const layout = computeLayout(timedTasks, localData);

          return (
            <div
              key={dateStr}
              ref={(el) => { gridRefs.current[dateStr] = el; }}
              data-calendar-date={dateStr}
              className={`flex-1 border-r border-slate-100 last:border-0 relative transition-colors ${
                isTargeted ? "bg-indigo-50/40" : isToday ? "bg-indigo-50/20" : ""
              }`}
              style={{ height: totalGridHeight }}
              onDrop={(e) => handleDrop(e, day)}
              onDragOver={(e) => handleDragOver(e, day)}
              onDragLeave={() => setDragOver(null)}
            >
              {/* Hour lines */}
              {HOURS.map((hour, idx) => (
                <div
                  key={hour}
                  className={`absolute left-0 right-0 border-b border-slate-50 ${isDragTarget && dragOver?.hour === hour ? "bg-indigo-50/60" : ""}`}
                  style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
                >
                  <div className="absolute left-0 right-0 border-b border-dashed border-slate-50" style={{ top: SLOT_HEIGHT / 2 }} />
                </div>
              ))}

              {/* Target drop preview for pointer drag */}
              {isTargeted && activeDrag && (
                <div
                  className="absolute left-1 right-1 rounded border-2 border-dashed border-indigo-400 bg-indigo-100/50 pointer-events-none z-10"
                  style={{ top: activeDrag.targetTop, height: Math.max(MIN_HEIGHT, activeDrag.height) }}
                />
              )}

              {/* Timed tasks */}
              <AnimatePresence>
                {layout.map(({ task, top, height, col, totalCols }) => {
                  const color = CATEGORY_BLOCK[task.category] || CATEGORY_BLOCK.other;
                  return (
                    <TimedTaskBlock
                      key={task.id}
                      task={task}
                      color={color}
                      completing={!!completing[task.id]}
                      top={top}
                      height={height}
                      col={col}
                      totalCols={totalCols}
                      onToggle={() => handleToggle(task, day)}
                      onRemove={() => handleRemoveTask(task)}
                      onPointerDown={(e, type) => handleTaskPointerDown(e, task, color, type)}
                    />
                  );
                })}
              </AnimatePresence>

              {/* Current time line */}
              {nowTop >= 0 && (
                <div className="absolute left-0 right-0 flex items-center z-20 pointer-events-none" style={{ top: nowTop }}>
                  <div className="w-1.5 h-1.5 rounded-full bg-indigo-500 flex-shrink-0" />
                  <div className="flex-1 h-px bg-indigo-500" />
                </div>
              )}

              {/* Sidebar drop hint */}
              {isDragTarget && dragOver?.hour != null && (
                <div
                  className="absolute left-0.5 right-0.5 rounded border border-dashed border-indigo-400 bg-indigo-50/70 pointer-events-none z-20"
                  style={{ top: HOURS.indexOf(dragOver.hour) * SLOT_HEIGHT + 1, height: SLOT_HEIGHT - 2 }}
                />
              )}
            </div>
          );
        })}
      </div>

      {/* Floating ghost — only during move, not resize */}
      {activeDrag && activeDrag.type === "move" && (
        <div
          className={`pointer-events-none fixed z-50 rounded border-l-2 shadow-xl opacity-90 ${activeDrag.color}`}
          style={{
            left: activeDrag.ghostX - 20,
            top: activeDrag.ghostY - 14,
            width: 120,
            height: Math.max(MIN_HEIGHT, activeDrag.height),
          }}
        >
          <div className="flex items-center gap-1 px-1.5 py-0.5 h-full">
            <Circle className="w-2.5 h-2.5 flex-shrink-0 opacity-50" />
            <span className="text-xs font-semibold truncate">{activeDrag.task.name}</span>
          </div>
        </div>
      )}
    </div>
  );
}
