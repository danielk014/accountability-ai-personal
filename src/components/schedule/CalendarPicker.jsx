import React, { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight } from "lucide-react";

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

export default function CalendarPicker({ selectedDate, onSelectDate }) {
  const [open, setOpen] = useState(false);
  const [baseMonth, setBaseMonth] = useState(selectedDate || new Date());

  const handlePrevMonth = () => setBaseMonth(subMonths(baseMonth, 1));
  const handleNextMonth = () => setBaseMonth(addMonths(baseMonth, 1));

  const monthStart = startOfMonth(baseMonth);
  const monthEnd = endOfMonth(baseMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="px-4 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition"
      >
        {format(selectedDate || new Date(), "EEEE, MMMM d")}
      </button>

      {open && (
        <div className="absolute top-full mt-2 right-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {format(baseMonth, "MMMM yyyy")}
            </h3>
            <div className="flex gap-0.5">
              <button
                onClick={handlePrevMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button
                onClick={handleNextMonth}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(day => (
              <div key={day} className="flex items-center justify-center h-7 text-xs font-medium text-slate-400">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`empty-${i}`} className="h-8" />
            ))}
            
            {daysInMonth.map((day) => {
              const isSelected = isSameDay(day, selectedDate || new Date());
              const isToday = isSameDay(day, new Date());

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    onSelectDate(day);
                    setOpen(false);
                  }}
                  className={`
                    flex items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-all
                    ${isSelected ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}
                    ${isToday && !isSelected ? "ring-1 ring-indigo-400" : ""}
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