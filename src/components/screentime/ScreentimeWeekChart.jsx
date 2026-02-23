import React, { useState } from "react";
import { format, startOfWeek, endOfWeek, eachDayOfInterval, addWeeks, isToday } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

function fmtMins(mins) {
  if (!mins) return "0m";
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

export default function ScreentimeWeekChart({ logs }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const MAX_BACK = 4;

  const baseDate = addWeeks(new Date(), weekOffset);
  const weekStart = startOfWeek(baseDate, { weekStartsOn: 1 }); // Mon
  const weekEnd   = endOfWeek(baseDate,   { weekStartsOn: 1 }); // Sun
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const minutesPerDay = days.map(day => {
    const d = format(day, "yyyy-MM-dd");
    return logs.filter(l => l.date === d).reduce((s, l) => s + l.minutes, 0);
  });

  const maxMins    = Math.max(...minutesPerDay, 60);
  const totalMins  = minutesPerDay.reduce((s, m) => s + m, 0);
  const activeDays = minutesPerDay.filter(m => m > 0).length;
  const avgMins    = activeDays > 0 ? Math.round(totalMins / activeDays) : 0;
  const isCurrentWeek = weekOffset === 0;

  const weekLabel = `${format(weekStart, "MMM d")} – ${format(weekEnd, "MMM d, yyyy")}`;

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Screen Time</p>
          <p className="text-sm font-semibold text-slate-700 mt-0.5">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekOffset(o => Math.max(-MAX_BACK, o - 1))}
            disabled={weekOffset <= -MAX_BACK}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition"
          >
            <ChevronLeft className="w-4 h-4 text-slate-500" />
          </button>
          {!isCurrentWeek && (
            <button
              onClick={() => setWeekOffset(0)}
              className="text-xs text-indigo-600 font-semibold px-2 py-1 rounded-lg hover:bg-indigo-50 transition"
            >
              This week
            </button>
          )}
          <button
            onClick={() => setWeekOffset(o => Math.min(0, o + 1))}
            disabled={isCurrentWeek}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-25 transition"
          >
            <ChevronRight className="w-4 h-4 text-slate-500" />
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-6 mb-5 pb-4 border-b border-slate-100">
        <div>
          <p className="text-xs text-slate-400">Weekly total</p>
          <p className="text-2xl font-bold text-orange-500">{fmtMins(totalMins)}</p>
        </div>
        <div>
          <p className="text-xs text-slate-400">
            Daily avg{activeDays > 0 ? ` · ${activeDays} day${activeDays !== 1 ? "s" : ""}` : ""}
          </p>
          <p className="text-2xl font-bold text-slate-700">{fmtMins(avgMins)}</p>
        </div>
      </div>

      {/* Bars */}
      <div className="flex items-end gap-2 mb-3" style={{ height: 120 }}>
        {days.map((day, i) => {
          const mins   = minutesPerDay[i];
          const pct    = maxMins > 0 ? (mins / maxMins) : 0;
          const barH   = Math.max(pct * 100, mins > 0 ? 4 : 0);
          const today  = isToday(day);
          const future = day > new Date();

          return (
            <div key={i} className="flex-1 flex flex-col items-center justify-end gap-1.5">
              {/* Value label */}
              <span className="text-slate-400 leading-none font-medium" style={{ fontSize: 10 }}>
                {mins > 0
                  ? Math.floor(mins / 60) > 0
                    ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? `${mins % 60}m` : ""}`
                    : `${mins}m`
                  : ""}
              </span>
              {/* Bar */}
              <div
                className="w-full rounded-t-lg bg-orange-50 flex flex-col justify-end overflow-hidden"
                style={{ height: 88 }}
              >
                <div
                  className={`w-full rounded-t-lg transition-all duration-300 ${
                    today ? "bg-orange-500" : future ? "bg-slate-100" : "bg-orange-300"
                  }`}
                  style={{ height: `${barH}%`, minHeight: mins > 0 ? 3 : 0 }}
                />
              </div>
              {/* Day label */}
              <span className={`text-xs font-bold ${today ? "text-orange-500" : "text-slate-400"}`}>
                {format(day, "EEEEE")}
              </span>
            </div>
          );
        })}
      </div>

      {totalMins === 0 && (
        <p className="text-center text-sm text-slate-400 pt-1">No screen time logged this week</p>
      )}
    </div>
  );
}
