import React, { useState, useRef, useEffect } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

/**
 * BirthdayPicker — a calendar-style date picker with easy month + year navigation.
 * value: "YYYY-MM-DD" string or ""
 * onChange: (isoString: string) => void
 */
export default function BirthdayPicker({ value, onChange, className = "" }) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef(null);

  // Parse stored value → Date (or default to today)
  const parsed = value ? new Date(value + "T00:00:00") : null;

  const [viewYear, setViewYear] = useState(() => parsed?.getFullYear() ?? new Date().getFullYear());
  const [viewMonth, setViewMonth] = useState(() => parsed?.getMonth() ?? new Date().getMonth());

  // Keep view in sync if value changes externally
  useEffect(() => {
    if (parsed) {
      setViewYear(parsed.getFullYear());
      setViewMonth(parsed.getMonth());
    }
  }, [value]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    function handleClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const baseMonth = new Date(viewYear, viewMonth, 1);
  const monthStart = startOfMonth(baseMonth);
  const monthEnd = endOfMonth(baseMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  }
  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  }

  function selectDay(day) {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  }

  function clear(e) {
    e.stopPropagation();
    onChange("");
  }

  const displayLabel = parsed
    ? format(parsed, "MMM d, yyyy")
    : "Pick a date";

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-pink-300 hover:bg-pink-50 transition text-left"
      >
        <CalendarDays className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />
        <span className={parsed ? "text-slate-700 flex-1" : "text-slate-400 flex-1"}>{displayLabel}</span>
        {parsed && (
          <span
            onClick={clear}
            className="text-slate-300 hover:text-red-400 transition cursor-pointer text-base leading-none ml-1"
          >×</span>
        )}
      </button>

      {/* Dropdown calendar */}
      {open && (
        <div className="absolute top-full mt-1 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          {/* Month + Year navigation */}
          <div className="flex items-center justify-between mb-2">
            <button type="button" onClick={prevMonth} className="p-1 rounded-lg hover:bg-slate-100 transition">
              <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
            </button>

            <div className="flex items-center gap-2">
              {/* Month selector */}
              <select
                value={viewMonth}
                onChange={e => setViewMonth(Number(e.target.value))}
                className="text-xs font-semibold text-slate-800 bg-transparent border-none outline-none cursor-pointer"
              >
                {MONTHS_SHORT.map((m, i) => <option key={m} value={i}>{m}</option>)}
              </select>

              {/* Year with +/− buttons */}
              <div className="flex items-center gap-0.5">
                <button type="button" onClick={() => setViewYear(y => y - 1)} className="p-0.5 rounded hover:bg-slate-100 transition">
                  <ChevronLeft className="w-3 h-3 text-slate-400" />
                </button>
                <span className="text-xs font-semibold text-slate-800 w-10 text-center">{viewYear}</span>
                <button type="button" onClick={() => setViewYear(y => y + 1)} className="p-0.5 rounded hover:bg-slate-100 transition">
                  <ChevronRight className="w-3 h-3 text-slate-400" />
                </button>
              </div>
            </div>

            <button type="button" onClick={nextMonth} className="p-1 rounded-lg hover:bg-slate-100 transition">
              <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
            </button>
          </div>

          {/* Day headers */}
          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="flex items-center justify-center h-6 text-xs font-medium text-slate-400">{d}</div>
            ))}
          </div>

          {/* Day grid */}
          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-7" />
            ))}
            {daysInMonth.map(day => {
              const isSelected = parsed && isSameDay(day, parsed);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => selectDay(day)}
                  className={`
                    flex items-center justify-center h-7 w-full rounded-lg text-xs font-medium transition-all
                    ${isSelected ? "bg-pink-500 text-white" : "text-slate-700 hover:bg-pink-50"}
                    ${isToday && !isSelected ? "ring-1 ring-pink-400" : ""}
                  `}
                >
                  {day.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
