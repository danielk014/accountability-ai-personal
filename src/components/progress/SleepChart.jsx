import React, { useState, useMemo } from "react";
import { format, subWeeks, startOfWeek, addDays, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from "date-fns";
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown, Moon, Sun, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { toast } from "sonner";

function calcHours(sleepTime, wakeTime) {
  if (!sleepTime || !wakeTime) return null;
  const [sh, sm] = sleepTime.split(":").map(Number);
  const [wh, wm] = wakeTime.split(":").map(Number);
  let sleepMins = sh * 60 + sm;
  let wakeMins = wh * 60 + wm;
  if (wakeMins <= sleepMins) wakeMins += 24 * 60;
  return parseFloat(((wakeMins - sleepMins) / 60).toFixed(2));
}

function parse24h(v) {
  if (!v) return { h: 12, m: 0, ampm: "AM" };
  const [hStr, mStr] = v.split(":");
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr || "0", 10);
  const ampm = h >= 12 ? "PM" : "AM";
  h = h % 12 || 12;
  return { h, m, ampm };
}

function to24h(h, m, ampm) {
  let hour = parseInt(h, 10);
  if (ampm === "AM" && hour === 12) hour = 0;
  if (ampm === "PM" && hour !== 12) hour += 12;
  return `${String(hour).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function fmt12(h, m) {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

const DAYS_SHORT = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function SleepDatePicker({ value, onChange }) {
  // value is "yyyy-MM-dd" string
  const selected = value ? new Date(value + "T12:00:00") : new Date();
  const [open, setOpen] = useState(false);
  const [baseMonth, setBaseMonth] = useState(selected);

  const monthStart = startOfMonth(baseMonth);
  const monthEnd = endOfMonth(baseMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDayOfWeek = monthStart.getDay();

  const handleSelect = (day) => {
    onChange(format(day, "yyyy-MM-dd"));
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-sm font-medium text-slate-700 hover:bg-slate-100 transition"
      >
        <span>{format(selected, "EEEE, MMMM d")}</span>
        <ChevronDown className={`w-4 h-4 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-slate-800">
              {format(baseMonth, "MMMM yyyy")}
            </h3>
            <div className="flex gap-0.5">
              <button
                type="button"
                onClick={() => setBaseMonth(subMonths(baseMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
              </button>
              <button
                type="button"
                onClick={() => setBaseMonth(addMonths(baseMonth, 1))}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition"
              >
                <ChevronRight className="w-3.5 h-3.5 text-slate-500" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-7 mb-1">
            {DAYS_SHORT.map(d => (
              <div key={d} className="flex items-center justify-center h-7 text-xs font-medium text-slate-400">
                {d}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7">
            {Array.from({ length: firstDayOfWeek }).map((_, i) => (
              <div key={`e-${i}`} className="h-8" />
            ))}
            {daysInMonth.map(day => {
              const isSel = isSameDay(day, selected);
              const isToday = isSameDay(day, new Date());
              return (
                <button
                  key={day.toISOString()}
                  type="button"
                  onClick={() => handleSelect(day)}
                  className={`flex items-center justify-center h-8 w-full rounded-lg text-xs font-medium transition-all
                    ${isSel ? "bg-indigo-600 text-white" : "text-slate-700 hover:bg-slate-100"}
                    ${isToday && !isSel ? "ring-1 ring-indigo-400" : ""}
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

const MINUTE_STEPS = [0, 5, 10, 15, 20, 25, 30, 35, 40, 45, 50, 55];

function snapMinute(m) {
  return MINUTE_STEPS.reduce((prev, cur) =>
    Math.abs(cur - m) < Math.abs(prev - m) ? cur : prev
  );
}

function TimePicker({ value, onChange, label, icon: Icon }) {
  const { h, m, ampm } = parse24h(value);
  const snappedM = snapMinute(m);

  const setH = (newH) => onChange(to24h(newH, snappedM, ampm));
  const setM = (newM) => onChange(to24h(h, newM, ampm));
  const setAmpm = (ap) => onChange(to24h(h, snappedM, ap));

  const incH = () => setH(h === 12 ? 1 : h + 1);
  const decH = () => setH(h === 1 ? 12 : h - 1);

  const curMIdx = MINUTE_STEPS.indexOf(snappedM);
  const incM = () => setM(MINUTE_STEPS[(curMIdx + 1) % MINUTE_STEPS.length]);
  const decM = () => setM(MINUTE_STEPS[(curMIdx - 1 + MINUTE_STEPS.length) % MINUTE_STEPS.length]);

  // scroll-wheel on the number columns
  const onWheelH = (e) => { e.preventDefault(); e.deltaY < 0 ? incH() : decH(); };
  const onWheelM = (e) => { e.preventDefault(); e.deltaY < 0 ? incM() : decM(); };

  return (
    <div className="flex-1 min-w-0 overflow-hidden">
      <p className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
        <Icon className="w-3 h-3" /> {label}
      </p>
      <div className="bg-slate-50 border border-slate-200 rounded-2xl p-2 flex items-center justify-center gap-1">

        {/* Hour column */}
        <div className="flex flex-col items-center" onWheel={onWheelH}>
          <button type="button" onClick={incH} className="text-slate-300 hover:text-violet-500 p-1 rounded-lg transition-colors">
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-2xl font-bold text-slate-800 w-9 text-center select-none cursor-default">
            {String(h).padStart(2, "0")}
          </span>
          <button type="button" onClick={decH} className="text-slate-300 hover:text-violet-500 p-1 rounded-lg transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        <span className="text-2xl font-bold text-slate-300 pb-0.5">:</span>

        {/* Minute column — 5-min steps */}
        <div className="flex flex-col items-center" onWheel={onWheelM}>
          <button type="button" onClick={incM} className="text-slate-300 hover:text-violet-500 p-1 rounded-lg transition-colors">
            <ChevronUp className="w-4 h-4" />
          </button>
          <span className="text-2xl font-bold text-slate-800 w-9 text-center select-none cursor-default">
            {String(snappedM).padStart(2, "0")}
          </span>
          <button type="button" onClick={decM} className="text-slate-300 hover:text-violet-500 p-1 rounded-lg transition-colors">
            <ChevronDown className="w-4 h-4" />
          </button>
        </div>

        {/* AM / PM */}
        <div className="flex flex-col gap-1 ml-1">
          {["AM", "PM"].map(ap => (
            <button
              key={ap}
              type="button"
              onClick={() => setAmpm(ap)}
              className={`text-xs font-semibold px-2 py-1 rounded-lg transition-colors ${
                ampm === ap
                  ? "bg-violet-600 text-white shadow-sm"
                  : "bg-slate-200 text-slate-400 hover:bg-slate-300"
              }`}
            >
              {ap}
            </button>
          ))}
        </div>
      </div>

      {/* Quick minute strip */}
      <div className="flex gap-0.5 mt-2 flex-wrap">
        {MINUTE_STEPS.map(min => (
          <button
            key={min}
            type="button"
            onClick={() => setM(min)}
            className={`flex-1 min-w-[1.75rem] text-[11px] font-semibold py-1 rounded-lg transition-colors ${
              snappedM === min
                ? "bg-violet-600 text-white"
                : "bg-slate-100 text-slate-500 hover:bg-violet-50 hover:text-violet-600"
            }`}
          >
            :{String(min).padStart(2, "0")}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function SleepChart({ sleepData }) {
  const [weekOffset, setWeekOffset] = useState(0);
  const [expandedDay, setExpandedDay] = useState(null);
  const [editingId, setEditingId] = useState(null);
  const today = format(new Date(), "yyyy-MM-dd");
  const [formData, setFormData] = useState({ date: today, sleep_time: "22:00", wake_time: "06:00" });
  const queryClient = useQueryClient();
  const weekStart = startOfWeek(subWeeks(new Date(), -weekOffset), { weekStartsOn: 1 });

  const chartData = useMemo(() => {
    return Array.from({ length: 7 }).map((_, dayIdx) => {
      const dayDate = addDays(weekStart, dayIdx);
      const dayStr = format(dayDate, "yyyy-MM-dd");
      const dayName = format(dayDate, "EEE");
      const sleep = sleepData.find(s => s.date === dayStr);
      const hours = sleep?.hours || 0;
      return {
        day: dayName,
        date: dayStr,
        hours,
        sleep_time: sleep?.sleep_time || "",
        wake_time: sleep?.wake_time || "",
        id: sleep?.id,
      };
    });
  }, [sleepData, weekStart]);

  const loggedDays = chartData.filter(d => d.hours > 0);
  const avgHours = loggedDays.length > 0
    ? (loggedDays.reduce((s, d) => s + d.hours, 0) / loggedDays.length).toFixed(1)
    : "—";

  // ── Sleep score (0–10) ────────────────────────────────────────────────────
  // Duration score per night based on adult male optimal (7.5–8.5 h)
  const durationScore = (h) => {
    if (h >= 7.5 && h <= 8.5) return 10;
    if (h >= 7   && h <  7.5) return 9;
    if (h >  8.5 && h <= 9)   return 9;
    if (h >= 6.5 && h <  7)   return 7;
    if (h >  9   && h <= 9.5) return 7;
    if (h >= 6   && h <  6.5) return 5;
    if (h >  9.5 && h <= 10)  return 5;
    if (h >= 5   && h <  6)   return 3;
    if (h > 10)                return 4;
    return 1; // < 5 h
  };

  // Consistency score: std-dev of sleep-start times in minutes (lower = better)
  const consistencyScore = (() => {
    const times = loggedDays
      .filter(d => d.sleep_time)
      .map(d => {
        const [hh, mm] = d.sleep_time.split(":").map(Number);
        // Normalise night-time hours so 22–23 and 0–4 sit on same scale
        return hh < 12 ? hh * 60 + mm + 24 * 60 : hh * 60 + mm;
      });
    if (times.length < 2) return 10; // not enough data → perfect score
    const mean = times.reduce((a, b) => a + b, 0) / times.length;
    const sd = Math.sqrt(times.reduce((s, t) => s + (t - mean) ** 2, 0) / times.length);
    if (sd <= 15)  return 10;
    if (sd <= 30)  return 8.5;
    if (sd <= 45)  return 7;
    if (sd <= 60)  return 5;
    if (sd <= 90)  return 3;
    return 1;
  })();

  const weekSleepScore = loggedDays.length === 0 ? null : (() => {
    const avgDur = loggedDays.reduce((s, d) => s + durationScore(d.hours), 0) / loggedDays.length;
    return Math.round((avgDur * 0.7 + consistencyScore * 0.3) * 10) / 10;
  })();

  const scoreColor = weekSleepScore === null ? "slate"
    : weekSleepScore >= 8 ? "emerald"
    : weekSleepScore >= 6 ? "amber"
    : "red";

  // Last 30 days of saved entries
  const cutoff30 = new Date();
  cutoff30.setDate(cutoff30.getDate() - 30);
  const cutoffDate30 = format(cutoff30, "yyyy-MM-dd");
  const recentSleepData = [...sleepData]
    .filter(e => e.date >= cutoffDate30)
    .sort((a, b) => b.date.localeCompare(a.date));

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.Sleep.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep"] });
      setFormData({ date: today, sleep_time: "22:00", wake_time: "06:00" });
      setEditingId(null);
      toast.success("Sleep recorded!");
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.Sleep.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep"] });
      setEditingId(null);
      setFormData({ date: today, sleep_time: "22:00", wake_time: "06:00" });
      toast.success("Sleep updated!");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.Sleep.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["sleep"] });
      setExpandedDay(null);
      toast.success("Sleep entry deleted!");
    },
  });

  const handleEdit = (item) => {
    setEditingId(item.id);
    setFormData({
      date: item.date,
      sleep_time: item.sleep_time || "22:00",
      wake_time: item.wake_time || "06:00",
    });
  };

  const handleCancel = () => {
    setEditingId(null);
    setFormData({ date: today, sleep_time: "22:00", wake_time: "06:00" });
  };

  const handleSubmit = () => {
    if (!formData.date || !formData.sleep_time || !formData.wake_time) {
      toast.error("Please set the date, sleep time, and wake time");
      return;
    }
    const hours = calcHours(formData.sleep_time, formData.wake_time);
    if (!hours || hours <= 0) {
      toast.error("Wake time must be after sleep time");
      return;
    }
    const data = { date: formData.date, hours, sleep_time: formData.sleep_time, wake_time: formData.wake_time };
    if (editingId) {
      updateMutation.mutate({ id: editingId, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const derivedHours = calcHours(formData.sleep_time, formData.wake_time);

  const fmtTime = (t) => {
    if (!t) return "—";
    const { h, m, ampm } = parse24h(t);
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")} ${ampm}`;
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Sleep</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {format(weekStart, "MMM d")} – {format(addDays(weekStart, 6), "MMM d")}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(weekOffset - 1)} className="rounded-lg h-8 w-8">
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <Button variant="ghost" onClick={() => setWeekOffset(0)} className="rounded-lg text-xs h-8 px-3">
            This week
          </Button>
          <Button variant="ghost" size="icon" onClick={() => setWeekOffset(weekOffset + 1)} disabled={weekOffset >= 0} className="rounded-lg h-8 w-8">
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={200}>
        <BarChart data={chartData} barSize={20}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="day" stroke="#cbd5e1" style={{ fontSize: "11px" }} tickLine={false} axisLine={false} />
          <YAxis hide />
          <Tooltip
            contentStyle={{ backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "10px", fontSize: "12px" }}
            formatter={(v) => [`${v}h`, "Sleep"]}
            cursor={{ fill: "#f8fafc" }}
          />
          <Bar dataKey="hours" fill="#8b5cf6" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>

      {/* Simple stats */}
      <div className="mt-4 flex gap-3 mb-6">
        <div className="flex-1 p-3 rounded-xl bg-violet-50 border border-violet-100 text-center">
          <p className="text-xs text-violet-500 font-medium">Avg / night</p>
          <p className="text-xl font-bold text-violet-800 mt-0.5">{avgHours}{loggedDays.length > 0 ? "h" : ""}</p>
        </div>
        <div className={`flex-1 p-3 rounded-xl text-center border ${
          scoreColor === "emerald" ? "bg-emerald-50 border-emerald-100" :
          scoreColor === "amber"   ? "bg-amber-50 border-amber-100"   :
          scoreColor === "red"     ? "bg-red-50 border-red-100"       :
          "bg-slate-50 border-slate-100"
        }`}>
          <p className={`text-xs font-medium ${
            scoreColor === "emerald" ? "text-emerald-500" :
            scoreColor === "amber"   ? "text-amber-500"   :
            scoreColor === "red"     ? "text-red-500"     :
            "text-slate-500"
          }`}>Sleep score</p>
          <p className={`text-xl font-bold mt-0.5 ${
            scoreColor === "emerald" ? "text-emerald-800" :
            scoreColor === "amber"   ? "text-amber-800"   :
            scoreColor === "red"     ? "text-red-800"     :
            "text-slate-800"
          }`}>
            {weekSleepScore !== null ? weekSleepScore : "—"}
            <span className="text-sm font-normal opacity-50"> / 10</span>
          </p>
        </div>
        <div className="flex-1 p-3 rounded-xl bg-emerald-50 border border-emerald-100 text-center">
          <p className="text-xs text-emerald-500 font-medium">Best night</p>
          <p className="text-xl font-bold text-emerald-800 mt-0.5">
            {loggedDays.length > 0 ? `${Math.max(...loggedDays.map(d => d.hours)).toFixed(1)}h` : "—"}
          </p>
        </div>
      </div>

      {/* Day pills */}
      <div className="flex gap-2 mb-4">
        {chartData.map(day => (
          <button
            key={day.date}
            onClick={() => setExpandedDay(expandedDay === day.date ? null : day.date)}
            className={`flex-1 text-center py-2 rounded-xl text-xs font-semibold transition-all ${
              expandedDay === day.date
                ? "bg-violet-600 text-white shadow"
                : day.hours > 0
                ? "bg-violet-50 text-violet-600 border border-violet-200"
                : "bg-slate-50 text-slate-400 hover:bg-slate-100"
            }`}
          >
            <span className="block">{day.day}</span>
            {day.hours > 0 && (
              <span className={`block text-[10px] mt-0.5 ${expandedDay === day.date ? "text-violet-200" : "text-violet-400"}`}>
                {day.hours}h
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Expanded day detail */}
      {expandedDay && (() => {
        const day = chartData.find(d => d.date === expandedDay);
        return (
          <div className="mb-6 rounded-2xl border border-slate-100 bg-slate-50 p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-semibold text-slate-700">
                {format(new Date(expandedDay + "T12:00:00"), "EEEE, MMM d")}
              </p>
              <div className="flex items-center gap-1">
                {day?.id && (
                  <>
                    <button onClick={() => handleEdit(day)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-indigo-600 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => deleteMutation.mutate(day.id)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 hover:text-red-500 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </>
                )}
                <button onClick={() => setExpandedDay(null)} className="p-1.5 rounded-lg hover:bg-slate-200 text-slate-400 transition-colors">
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
            {day?.hours > 0 ? (
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-sm">
                  <Moon className="w-4 h-4 text-indigo-400" />
                  <span className="text-slate-500">Slept</span>
                  <span className="font-semibold text-slate-800">{fmtTime(day.sleep_time)}</span>
                </div>
                <span className="text-slate-300">→</span>
                <div className="flex items-center gap-2 text-sm">
                  <Sun className="w-4 h-4 text-amber-400" />
                  <span className="text-slate-500">Woke</span>
                  <span className="font-semibold text-slate-800">{fmtTime(day.wake_time)}</span>
                </div>
                <div className="ml-auto text-sm font-bold text-violet-700 bg-violet-50 border border-violet-200 rounded-lg px-3 py-1">
                  {day.hours}h
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-400">No sleep logged for this day.</p>
            )}
          </div>
        );
      })()}

      {/* ── Log / Edit form ── */}
      <div id="sleep-form-anchor" className="border-t border-slate-100 pt-6">
        <h3 className="text-sm font-semibold text-slate-700 mb-4 flex items-center gap-2">
          <Moon className="w-4 h-4 text-violet-500" />
          {editingId ? "Edit sleep entry" : "Log sleep"}
        </h3>

        {/* Date picker */}
        <div className="mb-4">
          <p className="text-xs font-medium text-slate-500 mb-2">Date</p>
          <SleepDatePicker
            value={formData.date}
            onChange={(v) => setFormData({ ...formData, date: v })}
          />
        </div>

        {/* Time pickers */}
        <div className="flex gap-2 mb-4 min-w-0 overflow-hidden">
          <TimePicker
            value={formData.sleep_time}
            onChange={(v) => setFormData({ ...formData, sleep_time: v })}
            label="Went to sleep"
            icon={Moon}
          />
          <TimePicker
            value={formData.wake_time}
            onChange={(v) => setFormData({ ...formData, wake_time: v })}
            label="Woke up"
            icon={Sun}
          />
        </div>

        {/* Duration preview */}
        {derivedHours !== null && derivedHours > 0 && (
          <div className="mb-4 flex items-center justify-center gap-2 rounded-xl bg-violet-50 border border-violet-100 py-2.5 text-sm text-violet-700">
            <Moon className="w-3.5 h-3.5" />
            <span className="font-bold">{derivedHours}h</span>
            <span className="text-violet-500">of sleep</span>
          </div>
        )}

        <div className="flex gap-3">
          {editingId && (
            <Button variant="outline" onClick={handleCancel} className="rounded-xl flex-1">
              Cancel
            </Button>
          )}
          <Button
            onClick={handleSubmit}
            disabled={createMutation.isPending || updateMutation.isPending}
            className="rounded-xl flex-1 bg-violet-600 hover:bg-violet-700 text-white font-semibold"
          >
            {editingId ? "Update" : "Save Sleep"}
          </Button>
        </div>
      </div>

      {/* ── All saved entries (last 30 days) ── */}
      {recentSleepData.length > 0 && (
        <div className="border-t border-slate-100 pt-6 mt-2">
          <h3 className="text-sm font-semibold text-slate-700 mb-3 flex items-center gap-2">
            <Moon className="w-4 h-4 text-violet-400" />
            Saved entries <span className="text-xs font-normal text-slate-400">— last 30 days</span>
          </h3>
          <div className="space-y-2">
            {recentSleepData.map(entry => (
                <div
                  key={entry.id}
                  className={`flex items-center gap-3 rounded-xl px-4 py-3 border transition-all ${
                    editingId === entry.id
                      ? "bg-violet-50 border-violet-300"
                      : "bg-slate-50 border-slate-100"
                  }`}
                >
                  {/* Date */}
                  <div className="min-w-[90px]">
                    <p className="text-xs font-semibold text-slate-700">
                      {format(new Date(entry.date + "T12:00:00"), "EEE, MMM d")}
                    </p>
                    <p className="text-[11px] text-slate-400">{entry.date}</p>
                  </div>

                  {/* Times */}
                  <div className="flex-1 flex items-center gap-1.5 text-xs text-slate-600">
                    <Moon className="w-3 h-3 text-indigo-400 flex-shrink-0" />
                    <span className="font-medium">{fmtTime(entry.sleep_time)}</span>
                    <span className="text-slate-300">→</span>
                    <Sun className="w-3 h-3 text-amber-400 flex-shrink-0" />
                    <span className="font-medium">{fmtTime(entry.wake_time)}</span>
                  </div>

                  {/* Hours badge */}
                  <span className="text-xs font-bold text-violet-700 bg-violet-100 rounded-lg px-2 py-0.5 flex-shrink-0">
                    {entry.hours}h
                  </span>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => {
                        handleEdit(entry);
                        document.getElementById("sleep-form-anchor")?.scrollIntoView({ behavior: "smooth" });
                      }}
                      className="p-1.5 rounded-lg hover:bg-indigo-100 text-slate-400 hover:text-indigo-600 transition-colors"
                      title="Edit"
                    >
                      <Edit2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => deleteMutation.mutate(entry.id)}
                      className="p-1.5 rounded-lg hover:bg-red-100 text-slate-400 hover:text-red-500 transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
