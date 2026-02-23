import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, X, Brain } from "lucide-react";
import { toast } from "sonner";

export default function AboutMePanel() {
  const [input, setInput] = useState("");
  const queryClient = useQueryClient();

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile"],
    queryFn: () => base44.entities.UserProfile.list(),
  });
  const profile = profiles[0];
  const notes = profile?.about_me_notes || [];

  const saveMutation = useMutation({
    mutationFn: async (updatedNotes) => {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, { about_me_notes: updatedNotes });
      } else {
        await base44.entities.UserProfile.create({ about_me_notes: updatedNotes });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    },
  });

  const handleAdd = () => {
    const trimmed = input.trim();
    if (!trimmed) return;
    saveMutation.mutate([...notes, trimmed]);
    setInput("");
    toast.success("Saved! Your AI will use this to personalize check-ins.");
  };

  const handleDelete = (idx) => {
    saveMutation.mutate(notes.filter((_, i) => i !== idx));
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleAdd();
    }
  };

  return (
    <div className="border-b border-slate-100 bg-white px-4 py-3">
      <div className="max-w-3xl mx-auto">
        <div className="flex items-center gap-2 mb-2">
          <div className="w-6 h-6 rounded-md bg-violet-100 flex items-center justify-center flex-shrink-0">
            <Brain className="w-3.5 h-3.5 text-violet-600" />
          </div>
          <span className="text-xs font-semibold text-slate-700">About Me</span>
          <span className="text-xs text-slate-400">· your AI uses these to personalize everything</span>
        </div>

        {/* Notes pills */}
        {notes.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-2">
            {notes.map((note, i) => (
              <span
                key={i}
                className="inline-flex items-center gap-1.5 bg-slate-50 border border-slate-200 text-slate-600 text-xs rounded-full px-3 py-1 group"
              >
                {note}
                <button
                  onClick={() => handleDelete(i)}
                  className="opacity-0 group-hover:opacity-60 hover:!opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="flex gap-2">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="e.g. I'm trying to lose 20kg, I work 9-5, mornings are tough for me..."
            className="flex-1 text-xs rounded-xl border border-slate-200 px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder:text-slate-300"
          />
          <button
            onClick={handleAdd}
            disabled={!input.trim()}
            className="px-2.5 py-1.5 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}