import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Check, Clock, Dumbbell, Briefcase, BookOpen, User, Users, Brain, MoreHorizontal, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

const categoryConfig = {
  health: { icon: Dumbbell, color: "text-[#FF3B30]", bg: "bg-[#FF3B30]/[0.08]", border: "border-[#FF3B30]/20" },
  work: { icon: Briefcase, color: "text-[#007AFF]", bg: "bg-[#007AFF]/[0.08]", border: "border-[#007AFF]/20" },
  learning: { icon: BookOpen, color: "text-[#AF52DE]", bg: "bg-[#AF52DE]/[0.08]", border: "border-[#AF52DE]/20" },
  personal: { icon: User, color: "text-[#34C759]", bg: "bg-[#34C759]/[0.08]", border: "border-[#34C759]/20" },
  social: { icon: Users, color: "text-[#FF9500]", bg: "bg-[#FF9500]/[0.08]", border: "border-[#FF9500]/20" },
  mindfulness: { icon: Brain, color: "text-[#5AC8FA]", bg: "bg-[#5AC8FA]/[0.08]", border: "border-[#5AC8FA]/20" },
  other: { icon: MoreHorizontal, color: "text-[#86868b]", bg: "bg-[#86868b]/[0.08]", border: "border-[#86868b]/20" },
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
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={cn(
        "group relative flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)] cursor-pointer",
        isCompleted
          ? "bg-[hsl(220,14%,97%)]/60 border-[hsl(220,13%,93%)]"
          : isUpcoming
          ? "bg-[#FF9500]/[0.04] border-[#FF9500]/30 shadow-sm shadow-[#FF9500]/[0.06]"
          : "bg-white border-[hsl(220,13%,93%)] hover:border-[hsl(211,100%,80%)] hover:shadow-md hover:shadow-black/[0.04]"
      )}
      onClick={() => onToggle(task)}
    >
      {/* Completion checkbox */}
      <motion.div
        whileTap={{ scale: 0.85 }}
        className={cn(
          "flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center border-2 transition-all duration-300 ease-[cubic-bezier(0.25,0.1,0.25,1)]",
          isCompleted
            ? "bg-[#34C759] border-[#34C759]"
            : "border-[hsl(220,13%,85%)] group-hover:border-[hsl(211,100%,65%)]"
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
        <Icon className={cn("w-5 h-5", config.color)} strokeWidth={1.8} />
      </div>

      {/* Task info */}
      <div className="flex-1 min-w-0">
        <p className={cn(
          "font-semibold text-sm transition-all",
          isCompleted ? "text-[hsl(220,9%,60%)] line-through" : "text-[hsl(220,13%,10%)]"
        )}>
          {task.name}
        </p>
        <div className="flex items-center gap-3 mt-1 flex-wrap">
          {task.scheduled_time && (
            <span className={cn("flex items-center gap-1 text-xs", isUpcoming ? "text-[#FF9500] font-medium" : "text-[hsl(220,9%,55%)]")}>
              <Clock className="w-3 h-3" />
              {task.scheduled_time}
            </span>
          )}
          {isUpcoming && (
            <span className="flex items-center gap-1 text-xs font-semibold text-[#FF9500] bg-[#FF9500]/[0.08] px-2 py-0.5 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-[#FF9500] animate-pulse inline-block" />
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
          className="opacity-0 group-hover:opacity-100 flex-shrink-0 p-2 rounded-xl hover:bg-[#FF3B30]/[0.06] text-[hsl(220,9%,70%)] hover:text-[#FF3B30] transition-all duration-200"
          title="Delete task"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </motion.div>
  );
}
