import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2, Pencil, Loader2, Flag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const categoryColors = {
  health: "bg-rose-50 text-rose-600 border-rose-200",
  work: "bg-blue-50 text-blue-600 border-blue-200",
  learning: "bg-violet-50 text-violet-600 border-violet-200",
  personal: "bg-emerald-50 text-emerald-600 border-emerald-200",
  social: "bg-orange-50 text-orange-600 border-orange-200",
  mindfulness: "bg-teal-50 text-teal-600 border-teal-200",
  other: "bg-slate-50 text-slate-600 border-slate-200",
};

const priorityConfig = {
  urgent: { label: "Urgent", color: "text-red-500", bg: "bg-red-50 border-red-200 text-red-600" },
  high:   { label: "High",   color: "text-orange-500", bg: "bg-orange-50 border-orange-200 text-orange-600" },
  medium: { label: "Medium", color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-200 text-yellow-600" },
  low:    { label: "Low",    color: "text-slate-400", bg: "bg-slate-50 border-slate-200 text-slate-500" },
};

const CATEGORIES = ["health", "work", "learning", "personal", "social", "mindfulness", "other"];
const PRIORITIES = ["urgent", "high", "medium", "low"];

function TodoFormDialog({ open, onOpenChange, onSubmit, item }) {
  const [form, setForm] = useState({
    name: item?.name || "",
    description: item?.description || "",
    priority: item?.priority || "medium",
    category: item?.category || "personal",
    due_date: item?.due_date || "",
  });

  React.useEffect(() => {
    setForm({
      name: item?.name || "",
      description: item?.description || "",
      priority: item?.priority || "medium",
      category: item?.category || "personal",
      due_date: item?.due_date || "",
    });
  }, [item, open]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSubmit(form);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-md">
        <DialogHeader>
          <DialogTitle>{item ? "Edit To-Do" : "New To-Do"}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Task name</label>
            <Input
              autoFocus
              placeholder="What do you need to do?"
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Priority</label>
              <Select value={form.priority} onValueChange={v => setForm(f => ({ ...f, priority: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PRIORITIES.map(p => (
                    <SelectItem key={p} value={p}>{priorityConfig[p].label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="text-sm font-medium text-slate-700 mb-1 block">Category</label>
              <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v }))}>
                <SelectTrigger className="rounded-xl">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => (
                    <SelectItem key={c} value={c} className="capitalize">{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-slate-700 mb-1 block">Due date (optional)</label>
            <Input
              type="date"
              value={form.due_date}
              onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))}
              className="rounded-xl"
            />
          </div>
          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" className="rounded-xl" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button type="submit" className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
              {item ? "Save" : "Add"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function Habits() {
  const [showForm, setShowForm] = useState(false);
  const [editingItem, setEditingItem] = useState(null);
  const [deleteId, setDeleteId] = useState(null);
  const queryClient = useQueryClient();

  const { data: user } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: todos = [], isLoading } = useQuery({
    queryKey: ["todos", user?.email],
    queryFn: () => user?.email ? base44.entities.TodoItem.filter({ created_by: user.email }) : [],
  });

  const createMutation = useMutation({
    mutationFn: (data) => base44.entities.TodoItem.create(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); toast.success("To-do added!"); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); setEditingItem(null); toast.success("Updated!"); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => base44.entities.TodoItem.delete(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["todos"] }); setDeleteId(null); toast.success("Removed."); },
  });

  const handleSubmit = (data) => {
    if (editingItem) {
      updateMutation.mutate({ id: editingItem.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  // Sort: incomplete first by priority, then done at bottom
  const priorityOrder = { urgent: 0, high: 1, medium: 2, low: 3 };
  const pending = todos.filter(t => !t.is_done).sort((a, b) => (priorityOrder[a.priority] ?? 2) - (priorityOrder[b.priority] ?? 2));
  const done = todos.filter(t => t.is_done);

  if (isLoading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-indigo-500" /></div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">To Do List</h1>
          <p className="text-slate-500 mt-1">Your personal to-do items.</p>
        </div>
        <Button onClick={() => { setEditingItem(null); setShowForm(true); }} className="rounded-xl bg-indigo-600 hover:bg-indigo-700">
          <Plus className="w-4 h-4 mr-1" /> New task
        </Button>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {pending.map(item => {
            const pc = priorityConfig[item.priority] || priorityConfig.medium;
            return (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="flex items-center gap-4 p-4 bg-white border border-slate-200 rounded-2xl hover:shadow-md transition-all group"
              >
                <button
                  onClick={() => updateMutation.mutate({ id: item.id, data: { is_done: true, completed_at: new Date().toISOString() } })}
                  className="w-5 h-5 rounded-full border-2 border-slate-300 hover:border-indigo-500 flex items-center justify-center transition-colors flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-slate-800">{item.name}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className={cn("text-xs", pc.bg)}>
                      <Flag className="w-2.5 h-2.5 mr-1" />{pc.label}
                    </Badge>
                    <Badge variant="outline" className={cn("text-xs", categoryColors[item.category])}>
                      {item.category}
                    </Badge>
                    {item.due_date && (
                      <span className="text-xs text-slate-400">Due {item.due_date}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setEditingItem(item); setShowForm(true); }}>
                    <Pencil className="w-4 h-4 text-slate-400" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setDeleteId(item.id)}>
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </Button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {pending.length === 0 && (
          <div className="text-center py-16 text-slate-400">
            <p className="text-lg font-medium">All clear!</p>
            <p className="text-sm mt-1">Add your first to-do item to get started.</p>
          </div>
        )}
      </div>

      <TodoFormDialog
        open={showForm}
        onOpenChange={setShowForm}
        onSubmit={handleSubmit}
        item={editingItem}
      />

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this item?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently remove this to-do item.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-xl bg-red-600 hover:bg-red-700" onClick={() => deleteMutation.mutate(deleteId)}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}