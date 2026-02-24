import React, { useState, useRef, useCallback, useEffect } from "react";
import { format, isSameDay } from "date-fns";
import { CheckCircle2, Circle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6); // 6am–11pm

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
const SLOT_HEIGHT = 64; // px per hour
const MIN_HEIGHT = SLOT_HEIGHT / 4; // 15 min minimum
const SNAP = SLOT_HEIGHT / 4; // snap to 15 min
const TOTAL_HEIGHT = HOURS.length * SLOT_HEIGHT;
const LEFT_GUTTER = 64; // px for time labels

const CATEGORY_COLORS = {
  health: "bg-emerald-100 border-emerald-400 text-emerald-800",
  work: "bg-blue-100 border-blue-400 text-blue-800",
  learning: "bg-violet-100 border-violet-400 text-violet-800",
  personal: "bg-slate-100 border-slate-400 text-slate-800",
  social: "bg-pink-100 border-pink-400 text-pink-800",
  mindfulness: "bg-amber-100 border-amber-400 text-amber-800",
  other: "bg-gray-100 border-gray-400 text-gray-800",
};

function snap(val) {
  return Math.round(val / SNAP) * SNAP;
}

function topToTime(top) {
  const totalMin = Math.round((Math.max(0, top) / SLOT_HEIGHT) * 60 / 15) * 15;
  const h = Math.floor(totalMin / 60) + 6;
  const m = totalMin % 60;
  return `${String(Math.min(h, 23)).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function isValidTime(t) {
  if (!t || typeof t !== "string" || t.trim() === "") return false;
  const parts = t.split(":");
  if (parts.length < 2) return false;
  const h = parseInt(parts[0]);
  const m = parseInt(parts[1]);
  return !isNaN(h) && !isNaN(m);
}

function timeToTop(t) {
  const [h, m] = t.split(":").map(Number);
  return ((h - 6) + m / 60) * SLOT_HEIGHT;
}

function topToMinutes(top) {
  return Math.round((top / SLOT_HEIGHT) * 60);
}

function minutesToTop(min) {
  return (min / 60) * SLOT_HEIGHT;
}

function formatHour(h) {
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
}

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

// Returns [topPx, heightPx] clamped so the moved task doesn't overlap others
function clampNoOverlap(newTop, newHeight, taskId, allTimedCards) {
  const others = allTimedCards.filter((c) => c.id !== taskId);
  let top = Math.max(0, Math.min(newTop, TOTAL_HEIGHT - newHeight));
  let bottom = top + newHeight;

  for (const other of others) {
    const oTop = other.top;
    const oBot = other.top + other.height;
    const overlaps = top < oBot && bottom > oTop;
    if (overlaps) {
      // Try to push above
      const above = oTop - newHeight;
      // Try to push below
      const below = oBot;
      // Pick closest
      if (Math.abs(above - newTop) < Math.abs(below - newTop)) {
        top = Math.max(0, above);
      } else {
        top = Math.min(TOTAL_HEIGHT - newHeight, below);
      }
      bottom = top + newHeight;
    }
  }
  return [top, newHeight];
}

function clampResizeNoOverlap(newTop, newHeight, taskId, allTimedCards) {
  const others = allTimedCards.filter((c) => c.id !== taskId);
  let top = Math.max(0, newTop);
  let height = Math.max(MIN_HEIGHT, newHeight);
  let bottom = top + height;

  for (const other of others) {
    const oTop = other.top;
    const oBot = other.top + other.height;
    if (top < oBot && bottom > oTop) {
      // clamp
      if (top >= oTop) {
        // top handle dragged down into an event below — stop
        top = Math.max(newTop, oBot);
        height = Math.max(MIN_HEIGHT, (newTop + newHeight) - top);
      } else {
        // bottom handle dragged into event below — stop
        bottom = oTop;
        height = Math.max(MIN_HEIGHT, bottom - top);
      }
    }
  }
  return [top, height];
}

function EventCard({ card, onToggle, onRemove, onMoveEnd, onResizeEnd, allCards }) {
  const colorClass = CATEGORY_COLORS[card.task.category] || CATEGORY_COLORS.other;
  const dragState = useRef(null);
  const [liveTop, setLiveTop] = useState(null);
  const [liveHeight, setLiveHeight] = useState(null);
  const [completing, setCompleting] = useState(false);

  const displayTop = liveTop !== null ? liveTop : card.top;
  const displayHeight = liveHeight !== null ? liveHeight : card.height;

  const onPointerDown = useCallback((e, type) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = { type, startY: e.clientY, startTop: card.top, startHeight: card.height };
    e.currentTarget.setPointerCapture(e.pointerId);
  }, [card.top, card.height]);

  const onPointerMove = useCallback((e) => {
    if (!dragState.current) return;
    const { type, startY, startTop, startHeight } = dragState.current;
    const dy = e.clientY - startY;

    if (type === "move") {
      const rawTop = startTop + dy;
      const snapped = snap(rawTop);
      const [t] = clampNoOverlap(snapped, startHeight, card.id, allCards);
      setLiveTop(t);
      setLiveHeight(startHeight);
    } else if (type === "resize-bottom") {
      const rawHeight = startHeight + dy;
      const snapped = snap(rawHeight);
      const [, h] = clampResizeNoOverlap(startTop, snapped, card.id, allCards);
      setLiveTop(startTop);
      setLiveHeight(h);
    } else if (type === "resize-top") {
      const rawTop = startTop + dy;
      const snappedTop = snap(rawTop);
      const newHeight = startHeight - (snappedTop - startTop);
      const [t, h] = clampResizeNoOverlap(snappedTop, newHeight, card.id, allCards);
      setLiveTop(t);
      setLiveHeight(h);
    }
  }, [card.id, allCards]);

  const onPointerUp = useCallback((e) => {
    if (!dragState.current) return;
    const { type } = dragState.current;
    const finalTop = liveTop !== null ? liveTop : card.top;
    const finalHeight = liveHeight !== null ? liveHeight : card.height;
    dragState.current = null;
    setLiveTop(null);
    setLiveHeight(null);

    if (type === "move") {
      onMoveEnd(card.id, finalTop);
    } else {
      onResizeEnd(card.id, finalTop, finalHeight);
    }
  }, [liveTop, liveHeight, card.top, card.height, card.id, onMoveEnd, onResizeEnd]);

  const handleToggle = (e) => {
    e.stopPropagation();
    if (completing) return;
    setCompleting(true);
    setTimeout(() => onToggle(card.task), 750);
  };

  return (
    <motion.div
      style={{ top: displayTop, height: displayHeight, left: LEFT_GUTTER + 4, right: 4, position: "absolute", zIndex: 10, touchAction: 'none' }}
      className={`rounded-xl border-l-4 shadow-sm select-none overflow-visible ${colorClass}`}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.3 } }}
      transition={{ duration: 0.2 }}
    >
      {/* Top resize handle */}
      <div
        className="absolute top-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center group z-20"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => onPointerDown(e, "resize-top")}
      >
        <div className="w-8 h-0.5 rounded-full bg-current opacity-20 group-hover:opacity-50 transition-opacity" />
      </div>

      {/* Main drag area */}
      <div
        className="flex items-start gap-1.5 px-2 py-1.5 h-full group cursor-grab active:cursor-grabbing"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => onPointerDown(e, "move")}
      >
        <button
          className="mt-0.5 flex-shrink-0 z-20 relative"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={handleToggle}
        >
          {completing
            ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 animate-pulse" />
            : <Circle className="w-3.5 h-3.5 opacity-60" />}
        </button>
        <div className="flex-1 min-w-0 pointer-events-none">
          <span className={`text-xs font-semibold leading-tight ${completing ? "line-through opacity-50" : ""}`}>
            {card.task.name}
          </span>
          <p className="text-xs opacity-60 mt-0.5">{topToTime(displayTop)}</p>
        </div>
        <button
          className="flex-shrink-0 p-0.5 rounded hover:bg-black/10 opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity z-20 relative"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); onRemove(card.task); }}
        >
          <X className="w-3 h-3" />
        </button>
      </div>

      {/* Bottom resize handle */}
      <div
        className="absolute bottom-0 left-0 right-0 h-2 cursor-ns-resize flex items-center justify-center group z-20"
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => onPointerDown(e, "resize-bottom")}
      >
        <div className="w-8 h-0.5 rounded-full bg-current opacity-20 group-hover:opacity-50 transition-opacity" />
      </div>
    </motion.div>
  );
}

export default function DayView({ date, tasks, completions, onToggle, onDropTask, onRemoveTask, timezone }) {
  const dateStr = format(date, "yyyy-MM-dd");
  const isToday = isSameDay(date, new Date());
  const tz = timezone || Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
  const { hour: nowHour, minute: nowMin } = getNowInTimezone(tz);
  const gridRef = useRef(null);
  const [dragOver, setDragOver] = useState(null);
  // localTimes: { taskId: { time: "HH:MM", durationMin: number } }
  const [localData, setLocalData] = useState({});

  const dayTasks = tasks.filter((t) => taskAppliesOnDate(t, date));
  const completedIds = new Set(
    completions.filter((c) => c.completed_date === dateStr).map((c) => c.task_id)
  );

  const timedTasks = dayTasks.filter((t) => {
    const ld = localData[t.id];
    const time = ld?.time !== undefined ? ld.time : t.scheduled_time;
    return isValidTime(time);
  });
  const untimedTasks = dayTasks.filter((t) => {
    const ld = localData[t.id];
    const time = ld?.time !== undefined ? ld.time : t.scheduled_time;
    return !isValidTime(time);
  });

  // Build card descriptors — exclude completed tasks so they disappear when checked off
  const timedCards = timedTasks
    .filter((t) => !completedIds.has(t.id))
    .map((t) => {
      const ld = localData[t.id];
      const time = (ld?.time && isValidTime(ld.time)) ? ld.time : t.scheduled_time;
      const top = isValidTime(time) ? timeToTop(time) : 0;
      const durationMin = ld?.durationMin ?? 60;
      const height = Math.max(MIN_HEIGHT, minutesToTop(durationMin));
      return { id: t.id, task: t, top, height };
    });

  const handleMoveEnd = useCallback((taskId, finalTop) => {
    const newTime = topToTime(finalTop);
    const existing = localData[taskId];
    setLocalData(prev => ({ ...prev, [taskId]: { ...existing, time: newTime } }));
    onDropTask?.(taskId, newTime);
  }, [localData, onDropTask]);

  const handleRemoveTask = useCallback((task) => {
    setLocalData(prev => {
      const updated = { ...prev };
      delete updated[task.id];
      return updated;
    });
    onRemoveTask?.(task);
  }, [onRemoveTask]);

  const handleResizeEnd = useCallback((taskId, finalTop, finalHeight) => {
    const newTime = topToTime(finalTop);
    const durationMin = Math.round(topToMinutes(finalHeight) / 15) * 15;
    setLocalData(prev => ({ ...prev, [taskId]: { time: newTime, durationMin } }));
    onDropTask?.(taskId, newTime);
  }, [onDropTask]);

  // Handle drops from sidebar
  const getGridTop = useCallback((clientY) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return 0;
    return Math.max(0, clientY - rect.top);
  }, []);

  const handleDrop = (e) => {
    e.preventDefault();
    const sidebarTaskId = e.dataTransfer.getData("taskId");
    if (!sidebarTaskId) return;
    const yPx = getGridTop(e.clientY);
    let targetTop = snap(yPx);
    const defaultDuration = minutesToTop(60);

    // Find next non-overlapping slot, pushing down if needed
    const otherCards = timedCards.filter(c => c.id !== sidebarTaskId);
    for (let attempt = 0; attempt < 48; attempt++) {
      const bottom = targetTop + defaultDuration;
      const overlaps = otherCards.some(c => targetTop < c.top + c.height && bottom > c.top);
      if (!overlaps) break;
      // Push down by one snap unit (15 min)
      targetTop = Math.min(TOTAL_HEIGHT - defaultDuration, targetTop + SNAP);
    }

    const newTime = topToTime(Math.max(0, targetTop));
    setLocalData(prev => ({ ...prev, [sidebarTaskId]: { time: newTime, durationMin: 60 } }));
    onDropTask?.(sidebarTaskId, newTime);
    setDragOver(null);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    // Auto-scroll the page when dragging near top/bottom edges
    const ZONE = 80, SPEED = 10;
    if (e.clientY > window.innerHeight - ZONE) window.scrollBy(0, SPEED);
    else if (e.clientY < ZONE) window.scrollBy(0, -SPEED);
    const yPx = getGridTop(e.clientY);
    const hourIdx = Math.min(Math.floor(yPx / SLOT_HEIGHT), HOURS.length - 1);
    setDragOver(HOURS[hourIdx]);
  };

  const totalGridHeight = HOURS.length * SLOT_HEIGHT;
  const nowTop = (() => {
    const idx = nowHour - 6;
    if (idx < 0 || idx >= HOURS.length) return -1;
    return idx * SLOT_HEIGHT + (nowMin / 60) * SLOT_HEIGHT;
  })();

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden flex-1">
      <div
        ref={gridRef}
        data-calendar-date={dateStr}
        className="relative"
        style={{ height: totalGridHeight }}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragOver(null)}
      >
        {/* Hour rows */}
        {HOURS.map((hour, idx) => {
          const isCurrentHour = isToday && hour === nowHour;
          return (
            <div
              key={hour}
              className={`absolute left-0 right-0 border-b border-slate-50 ${dragOver === hour ? "bg-indigo-50/50" : ""}`}
              style={{ top: idx * SLOT_HEIGHT, height: SLOT_HEIGHT }}
            >
              <div className="absolute left-0 w-16 pt-2 pr-3 text-right">
                <span className={`text-xs font-medium ${isCurrentHour ? "text-indigo-600" : "text-slate-400"}`}>
                  {formatHour(hour)}
                </span>
              </div>
              <div className="absolute left-16 right-0 border-b border-dashed border-slate-100" style={{ top: SLOT_HEIGHT / 2 }} />
            </div>
          );
        })}

        {/* Timed event cards */}
        <AnimatePresence>
          {timedCards.map((card) => (
            <EventCard
              key={card.id}
              card={card}
              allCards={timedCards}
              onToggle={(t) => onToggle(t, date)}
              onRemove={handleRemoveTask}
              onMoveEnd={handleMoveEnd}
              onResizeEnd={handleResizeEnd}
            />
          ))}
        </AnimatePresence>

        {/* Current time indicator */}
        {isToday && nowTop >= 0 && (
          <div className="absolute left-16 right-0 flex items-center z-20 pointer-events-none" style={{ top: nowTop }}>
            <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 -ml-1.5 flex-shrink-0" />
            <div className="flex-1 h-px bg-indigo-500" />
          </div>
        )}

        {/* Drop hint for sidebar tasks */}
        {dragOver !== null && (
          <div
            className="absolute right-2 h-14 rounded-xl border-2 border-dashed border-indigo-400 bg-indigo-50/70 flex items-center justify-center pointer-events-none z-20"
            style={{ left: LEFT_GUTTER + 4, top: HOURS.indexOf(dragOver) * SLOT_HEIGHT + 4 }}
          >
            <span className="text-xs text-indigo-500 font-medium">Drop here — {formatHour(dragOver)}</span>
          </div>
        )}
      </div>
    </div>
  );
}