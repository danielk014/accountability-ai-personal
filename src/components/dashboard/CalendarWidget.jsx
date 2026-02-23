import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Calendar, Loader2, Plus, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { format, addDays } from "date-fns";
import AddEventDialog from "./AddEventDialog";

// Returns the next upcoming Date for a task, or null if not upcoming
function getNextOccurrence(task) {
  const today = new Date();
  const todayStr = format(today, "yyyy-MM-dd");

  if (task.frequency === "once") {
    if (task.scheduled_date && task.scheduled_date >= todayStr) {
      return new Date(task.scheduled_date + "T" + (task.scheduled_time || "00:00"));
    }
    return null;
  }

  // For recurring tasks, find the next occurrence within 7 days
  for (let i = 0; i <= 7; i++) {
    const d = addDays(today, i);
    const dow = format(d, "EEEE").toLowerCase();
    const isWeekday = !["saturday", "sunday"].includes(dow);
    let applies = false;
    if (task.frequency === "daily") applies = true;
    else if (task.frequency === "weekdays") applies = isWeekday;
    else if (task.frequency === "weekends") applies = !isWeekday;
    else if (task.frequency === dow) applies = true;
    if (applies) {
      return new Date(format(d, "yyyy-MM-dd") + "T" + (task.scheduled_time || "00:00"));
    }
  }
  return null;
}

export default function CalendarWidget() {
  const [showAddEvent, setShowAddEvent] = useState(false);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks", user?.email],
    queryFn: () => user?.email ? base44.entities.Task.filter({ created_by: user.email }) : [],
    enabled: !!user?.email,
  });

  const handleAddEvent = async (eventData) => {
    try {
      const startDate = new Date(eventData.startTime);
      await base44.entities.Task.create({
        name: eventData.title,
        frequency: "once",
        scheduled_date: format(startDate, "yyyy-MM-dd"),
        scheduled_time: format(startDate, "HH:mm"),
        category: "personal",
        is_active: true,
      });
      toast.success("Event added to calendar!");
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setShowAddEvent(false);
    } catch {
      toast.error("Failed to add event");
    }
  };

  // Show upcoming one-time events (birthdays, appointments, etc.)
  // plus timed recurring tasks within the next 7 days
  const upcomingEvents = (tasks || [])
    .filter(t => t.is_active !== false)
    .filter(t => t.frequency === "once" || t.scheduled_time?.trim())
    .map(task => {
      const date = getNextOccurrence(task);
      return date ? { task, date } : null;
    })
    .filter(Boolean)
    .sort((a, b) => a.date - b.date)
    .slice(0, 5);

  return (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Calendar className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-slate-800">Upcoming</h3>
        </div>
        <Button
          onClick={() => setShowAddEvent(true)}
          size="sm"
          className="bg-indigo-600 hover:bg-indigo-700 rounded-lg"
        >
          <Plus className="w-4 h-4 mr-1" />
          Add Event
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
        </div>
      ) : upcomingEvents.length === 0 ? (
        <div className="text-center py-8 text-slate-500 text-sm">
          <p>No upcoming events</p>
          <p className="text-xs mt-1">Add an event or save a birthday to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {upcomingEvents.map(({ task, date }) => (
            <div key={task.id} className="border border-slate-200 rounded-lg p-3 hover:bg-slate-50 transition">
              <p className="font-medium text-slate-800 text-sm truncate">{task.name}</p>
              <div className="flex items-center gap-1 mt-1 text-xs text-slate-500">
                <Clock className="w-3.5 h-3.5" />
                <span>
                  {task.scheduled_time?.trim()
                    ? format(date, "MMM d, h:mm a")
                    : format(date, "MMM d")}
                </span>
                {task.category && (
                  <span className="ml-2 capitalize text-slate-400">{task.category}</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <AddEventDialog
        open={showAddEvent}
        onOpenChange={setShowAddEvent}
        onSubmit={handleAddEvent}
      />
    </div>
  );
}
