import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Dumbbell, Briefcase, BookOpen, User, Users, Brain, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
  health: { icon: Dumbbell, color: "text-rose-500", bg: "bg-rose-50", border: "border-rose-200" },
  work: { icon: Briefcase, color: "text-blue-500", bg: "bg-blue-50", border: "border-blue-200" },
  learning: { icon: BookOpen, color: "text-violet-500", bg: "bg-violet-50", border: "border-violet-200" },
  personal: { icon: User, color: "text-emerald-500", bg: "bg-emerald-50", border: "border-emerald-200" },
  social: { icon: Users, color: "text-orange-500", bg: "bg-orange-50", border: "border-orange-200" },
  mindfulness: { icon: Brain, color: "text-teal-500", bg: "bg-teal-50", border: "border-teal-200" },
  other: { icon: MoreHorizontal, color: "text-slate-500", bg: "bg-slate-50", border: "border-slate-200" },
};

export default function TaskCard({ task, isCompleted, onToggle, onDelete, isUpcoming }) {
  const config = categoryConfig[task.category] || categoryConfig.other;
  const Icon = config.icon;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 cursor-pointer",
        isCompleted
          ? "bg-slate-50/60 border-slate-200"
          : isUpcoming
          ? "bg-amber-50 border-amber-300 shadow-md shadow-amber-100/60"
          : "bg-white border-slate-200 hover:border-indigo-300 hover:shadow-md hover:shadow-indigo-100/50"
      )}
      onClick={() => onToggle(task)}
    >
      {/* Completion checkbox */}
      <motion.div
        whileTap={{ scale: 0.85 }}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300",
          isCompleted
            ? "bg-emerald-500 border-emerald-500"
            : "border-slate-300 group-hover:border-indigo-400"
        )}
      >
        <AnimatePresence>
          {isCompleted && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 15 }}
            >
              <Check className="w-5 h-5 text-white" strokeWidth={3} />
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Category icon */}
      <div className={cn("flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center", config.bg)}>
        <Icon className={cn("w-5 h-5", config.color)} />
      </div>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold text-sm transition-all",
          isCompleted ? "text-slate-400 line-through" : "text-slate-800"
        )}>
          {task.name}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.scheduled_time && (
            <span className={cn("flex items-center gap-1 text-xs", isUpcoming ? "text-amber-600 font-medium" : "text-slate-400")}>
              <Clock className="w-3 h-3" />
              {task.scheduled_time}
            </span>
          )}
          {isUpcoming && (
            <span className="flex items-center gap-1 text-xs font-semibold text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse inline-block" />
              Starting soon
            </span>
          )}
          <span className={cn("text-xs capitalize", config.color)}>{task.frequency}</span>
        </div>
      </div>

      {/* Delete button */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task); }}
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-2 rounded-xl hover:bg-red-50 text-slate-300 hover:text-red-500 transition-all"
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}