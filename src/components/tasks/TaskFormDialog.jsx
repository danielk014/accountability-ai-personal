import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";

import TimePickerInput from "./TimePickerInput";

const CATEGORIES = [
  { value: "health", label: "Health & Fitness" },
  { value: "work", label: "Work" },
  { value: "learning", label: "Learning" },
  { value: "personal", label: "Personal" },
  { value: "social", label: "Social" },
  { value: "mindfulness", label: "Mindfulness" },
  { value: "other", label: "Other" },
];

const FREQUENCIES = [
  { value: "once", label: "One time (specific date)" },
  { value: "daily", label: "Every day" },
  { value: "weekdays", label: "Weekdays" },
  { value: "weekends", label: "Weekends" },
  { value: "weekly", label: "Once a week" },
  { value: "biweekly", label: "Once every 2 weeks" },
  { value: "monthly", label: "Monthly" },
  { value: "monday", label: "Monday" },
  { value: "tuesday", label: "Tuesday" },
  { value: "wednesday", label: "Wednesday" },
  { value: "thursday", label: "Thursday" },
  { value: "friday", label: "Friday" },
  { value: "saturday", label: "Saturday" },
  { value: "sunday", label: "Sunday" },
];

export default function TaskFormDialog({ open, onOpenChange, onSubmit, task, defaultDate }) {
  const today = defaultDate || new Date().toISOString().split("T")[0];
  const [formData, setFormData] = useState(task || {
    name: "",
    description: "",
    scheduled_time: "",
    scheduled_date: today,
    frequency: "once",
    category: "personal",
    reminder_enabled: false,
    reminder_time: "",
    reminder_days: [],
    reminder_type: "in_app",
  });

  // Reset form when dialog opens
  React.useEffect(() => {
    if (open) {
      setFormData(task || {
        name: "",
        description: "",
        scheduled_time: "",
        scheduled_date: defaultDate || new Date().toISOString().split("T")[0],
        frequency: "once",
        category: "personal",
        reminder_enabled: false,
        reminder_time: "",
        reminder_days: [],
        reminder_type: "in_app",
      });
    }
  }, [open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!formData.name.trim()) return;
    const submitData = {
      ...formData,
      // Explicitly null out scheduled_time if empty so it's never saved as ""
      scheduled_time: formData.scheduled_time && formData.scheduled_time.trim() !== "" ? formData.scheduled_time : null,
      scheduled_date: formData.frequency === "once" ? formData.scheduled_date : null,
      is_active: true,
      streak: task?.streak || 0,
      best_streak: task?.best_streak || 0,
      total_completions: task?.total_completions || 0,
    };
    onSubmit(submitData);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            {task ? "Edit habit" : "New habit"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">What habit or task?</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="e.g. Morning meditation, Read 20 pages"
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Category</Label>
              <Select value={formData.category} onValueChange={(v) => setFormData({ ...formData, category: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Frequency</Label>
              <Select value={formData.frequency} onValueChange={(v) => setFormData({ ...formData, frequency: v })}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {FREQUENCIES.map(f => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {formData.frequency === "once" && (
            <div className="space-y-2">
              <Label htmlFor="date">Date</Label>
              <Input
                id="date"
                type="date"
                value={formData.scheduled_date || ""}
                onChange={(e) => setFormData({ ...formData, scheduled_date: e.target.value })}
                className="rounded-xl"
              />
            </div>
          )}
          <div className="space-y-2">
            <Label>Scheduled time (optional)</Label>
            <TimePickerInput
              value={formData.scheduled_time}
              onChange={(time) => setFormData({ ...formData, scheduled_time: time })}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Notes (optional)</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Any details or motivation..."
              className="rounded-xl h-20"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-xl">
              Cancel
            </Button>
            <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {task ? "Update" : "Add habit"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}