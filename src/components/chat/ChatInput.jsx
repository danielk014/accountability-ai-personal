import React, { useState, useRef } from "react";
import { Send, Loader2, Lightbulb, Moon, Paperclip, X, FileText, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { sendOneOffPrompt } from "@/api/claudeClient";
import { toast } from "sonner";

const MAX_FILE_BYTES = 20 * 1024 * 1024; // 20 MB

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      // Strip "data:<type>;base64," prefix
      const base64 = dataUrl.split(",")[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function ChatInput({ onSend, isLoading, onCoachingClick, compact = false }) {
  const [message, setMessage] = useState("");
  const [attachments, setAttachments] = useState([]);
  const [loadingCoaching, setLoadingCoaching] = useState(false);
  const [loadingSleep, setLoadingSleep] = useState(false);
  const fileInputRef = useRef(null);
  const textareaRef = useRef(null);

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks", user?.email],
    queryFn: () => user?.email ? base44.entities.Task.filter({ created_by: user.email }) : [],
  });

  const { data: completions = [] } = useQuery({
    queryKey: ["completions", user?.email],
    queryFn: () => user?.email ? base44.entities.TaskCompletion.filter({ created_by: user.email }, "-completed_date", 500) : [],
  });

  const { data: sleep = [] } = useQuery({
    queryKey: ["sleep", user?.email],
    queryFn: () => user?.email ? base44.entities.Sleep.filter({ created_by: user.email }, "-date", 100) : [],
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.email],
    queryFn: () => user?.email ? base44.entities.UserProfile.filter({ created_by: user.email }) : [],
  });

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        toast.error(`${file.name} is too large (max 20 MB)`);
        continue;
      }

      const isImage = file.type.startsWith("image/");
      const isPdf = file.type === "application/pdf";

      if (!isImage && !isPdf) {
        toast.error(`${file.name}: only images and PDFs are supported`);
        continue;
      }

      try {
        const data = await readFileAsBase64(file);
        const preview = isImage ? URL.createObjectURL(file) : null;
        setAttachments(prev => [...prev, {
          name: file.name,
          mediaType: file.type,
          isImage,
          data,
          preview,
        }]);
      } catch {
        toast.error(`Failed to read ${file.name}`);
      }
    }

    e.target.value = "";
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => {
      const att = prev[idx];
      if (att?.preview) URL.revokeObjectURL(att.preview);
      return prev.filter((_, i) => i !== idx);
    });
  };

  const handleCoaching = async () => {
    setLoadingCoaching(true);
    try {
      // Build per-task completion time patterns
      const taskTimePatterns = tasks.map(t => {
        const taskCompletions = completions.filter(c => c.task_id === t.id);
        const timedCompletions = taskCompletions.filter(c => c.completed_at);
        const hours = timedCompletions.map(c => parseInt(c.completed_at.split(":")[0])).filter(h => !isNaN(h));
        const avgHour = hours.length > 0 ? Math.round(hours.reduce((a, b) => a + b, 0) / hours.length) : null;
        const mostCommonHour = hours.length > 0
          ? Object.entries(hours.reduce((acc, h) => { acc[h] = (acc[h] || 0) + 1; return acc; }, {}))
              .sort((a, b) => b[1] - a[1])[0][0]
          : null;
        return {
          name: t.name,
          category: t.category,
          scheduledTime: t.scheduled_time || null,
          totalCompletions: taskCompletions.length,
          streak: t.streak || 0,
          avgCompletionHour: avgHour,
          peakCompletionHour: mostCommonHour ? parseInt(mostCommonHour) : null,
          completionRate: ((taskCompletions.length / Math.max(30, 1)) * 100).toFixed(0),
        };
      });

      // Sleep vs next-day productivity correlation
      const completionsByDate = {};
      completions.forEach(c => {
        completionsByDate[c.completed_date] = (completionsByDate[c.completed_date] || 0) + 1;
      });
      const sleepProductivity = sleep.slice(0, 30).map(s => {
        const nextDay = new Date(s.date);
        nextDay.setDate(nextDay.getDate() + 1);
        const nextDateStr = nextDay.toISOString().split("T")[0];
        return { date: s.date, hours: s.hours, nextDayTasks: completionsByDate[nextDateStr] || 0 };
      });
      const avgSleep = sleep.length > 0
        ? (sleep.reduce((sum, s) => sum + s.hours, 0) / sleep.length).toFixed(1)
        : null;
      const goodSleepAvgTasks = sleepProductivity.filter(s => s.hours >= 7).length > 0
        ? (sleepProductivity.filter(s => s.hours >= 7).reduce((sum, s) => sum + s.nextDayTasks, 0) / sleepProductivity.filter(s => s.hours >= 7).length).toFixed(1)
        : null;
      const poorSleepAvgTasks = sleepProductivity.filter(s => s.hours < 7).length > 0
        ? (sleepProductivity.filter(s => s.hours < 7).reduce((sum, s) => sum + s.nextDayTasks, 0) / sleepProductivity.filter(s => s.hours < 7).length).toFixed(1)
        : null;

      // Overall completion hour distribution
      const completionsByHour = {};
      completions.forEach(c => {
        if (c.completed_at) {
          const h = parseInt(c.completed_at.split(":")[0]);
          if (!isNaN(h)) completionsByHour[h] = (completionsByHour[h] || 0) + 1;
        }
      });
      const peakHours = Object.entries(completionsByHour)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([h, count]) => `${h}:00 (${count} completions)`);

      const prompt = `You are a smart habit intelligence system. Your job is to analyze when this person ACTUALLY does their habits vs when they think they will, cross-reference it with their sleep and energy data, and give them genuinely intelligent recommendations for smarter reminder timing — not generic advice, real data-driven insight.

**Habit Completion Timing Patterns:**
${taskTimePatterns.length > 0 ? taskTimePatterns.map(t => {
  const scheduledVsActual = t.scheduledTime && t.peakCompletionHour !== null
    ? ` | Scheduled: ${t.scheduledTime} → Actually done most at: ${t.peakCompletionHour}:00`
    : t.peakCompletionHour !== null
    ? ` | No set time → Actually done most at: ${t.peakCompletionHour}:00`
    : ` | No completion time data yet`;
  return `- **${t.name}** (${t.category}): ${t.totalCompletions} completions${scheduledVsActual} | Streak: ${t.streak} days`;
}).join("\n") : "- No habits tracked yet"}

**Peak Productivity Windows (all habits combined):**
${peakHours.length > 0 ? peakHours.join(", ") : "Not enough timed data yet"}

**Sleep → Next-Day Productivity Correlation:**
- Average sleep: ${avgSleep ?? "not tracked"} hrs
- After 7+ hrs sleep: avg ${goodSleepAvgTasks ?? "N/A"} habits completed next day
- After under 7 hrs: avg ${poorSleepAvgTasks ?? "N/A"} habits completed next day
- Sleep nights tracked: ${sleep.length}

${profile?.[0]?.context_about?.length > 0 ? `**User Context:**\n${profile[0].context_about.join("\n")}` : ""}

Your job is Reminder Intelligence — instead of fixed reminder times, learn from this data and recommend when reminders should actually fire:

1. **Timing Mismatches**: For each habit that has both a scheduled time AND actual completion data, call out the gap. If they scheduled something at 7am but always do it at 10am, that's a mismatch — flag it specifically.
2. **Sleep-Adjusted Scheduling**: Based on the sleep/productivity correlation, identify what their productive window looks like after good vs bad sleep. When should their reminders shift based on how last night went?
3. **Smarter Reminder Times**: Give a concrete recommended reminder time for each habit, based purely on when they've historically completed it — not when they said they would.
4. **The One Blind Spot**: What pattern in this data are they probably not aware of? Call out one non-obvious insight (e.g. "You complete 80% of tasks before noon but have three habits scheduled after 6pm").
5. **This Week's Adjustment**: One immediate, specific change to their reminder schedule that would have the biggest impact on consistency.

Be specific. Use their actual numbers. Keep it tight — no filler.`;

      const response = await sendOneOffPrompt(prompt);
      onCoachingClick(response);
    } catch (error) {
      console.error("Error generating coaching:", error);
    } finally {
      setLoadingCoaching(false);
    }
  };

  const handleSleepAnalysis = async () => {
    setLoadingSleep(true);
    try {
      const completionsByDate = {};
      completions.forEach(c => {
        completionsByDate[c.completed_date] = (completionsByDate[c.completed_date] || 0) + 1;
      });
      const completionsByHour = {};
      completions.forEach(c => {
        if (c.completed_at) {
          const hour = parseInt(c.completed_at.split(":")[0]);
          if (!isNaN(hour)) completionsByHour[hour] = (completionsByHour[hour] || 0) + 1;
        }
      });
      const sleepCorrelation = sleep.map(s => ({
        date: s.date, hours: s.hours,
        tasksNextDay: completionsByDate[s.date] || 0,
      }));
      const goodSleepDays = sleepCorrelation.filter(s => s.hours >= 7);
      const poorSleepDays2 = sleepCorrelation.filter(s => s.hours < 7);
      const avgTasksGoodSleep = goodSleepDays.length > 0
        ? (goodSleepDays.reduce((sum, s) => sum + s.tasksNextDay, 0) / goodSleepDays.length).toFixed(1) : null;
      const avgTasksPoorSleep = poorSleepDays2.length > 0
        ? (poorSleepDays2.reduce((sum, s) => sum + s.tasksNextDay, 0) / poorSleepDays2.length).toFixed(1) : null;
      const peakHours = Object.entries(completionsByHour)
        .sort((a, b) => b[1] - a[1]).slice(0, 3)
        .map(([h, count]) => `${h}:00 (${count} completions)`);

      const prompt = `You are analyzing this person's sleep and productivity data to find patterns. Be conversational, clear, and specific. Use their actual numbers.

**Sleep Data (${sleep.length} nights tracked):**
${sleep.length > 0 ? sleep.slice(0, 14).map(s => `- ${s.date}: ${s.hours}h sleep`).join("\n") : "No sleep data recorded"}

**Task Completion Data (${completions.length} total completions):**
- Completions by date: ${Object.entries(completionsByDate).slice(0, 10).map(([d, c]) => `${d}: ${c} tasks`).join(", ") || "None"}
- Peak productivity hours: ${peakHours.length > 0 ? peakHours.join(", ") : "Not enough time-stamped data"}

**Sleep vs Productivity Correlation:**
- Nights with 7+ hours sleep: ${goodSleepDays.length} nights → avg ${avgTasksGoodSleep ?? "N/A"} tasks completed that day
- Nights with under 7 hours sleep: ${poorSleepDays2.length} nights → avg ${avgTasksPoorSleep ?? "N/A"} tasks completed that day

**Important:** If there are fewer than 5 data points for EITHER sleep OR task completions, your ENTIRE response must be exactly: "I don't got enough data yet. Keep logging your sleep and completing tasks for at least a week and I'll be able to spot real patterns for you."

Otherwise, analyze:
1. **Sleep-Productivity Link**: Does more sleep = more tasks done? By how much?
2. **Peak Energy Windows**: When are they most productive based on completion timestamps?
3. **Key Recommendation**: One specific, actionable change based on the data.

Keep it short, punchy, and data-driven.`;

      const response = await sendOneOffPrompt(prompt);
      onCoachingClick(response);
    } catch (error) {
      console.error("Error generating sleep analysis:", error);
    } finally {
      setLoadingSleep(false);
    }
  };

  const handleSend = () => {
    if ((!message.trim() && attachments.length === 0) || isLoading) return;
    onSend(message.trim(), attachments);
    setMessage("");
    setAttachments([]);
    if (textareaRef.current) textareaRef.current.style.height = "44px";
  };

  const anythingLoading = isLoading || loadingCoaching || loadingSleep;

  return (
    <TooltipProvider>
      <div className={compact ? "" : "border-t border-slate-200 bg-white px-4 py-3"}>

        {/* Attachment preview strip */}
        {attachments.length > 0 && (
          <div className={`flex flex-wrap gap-2 mb-2 ${compact ? "" : "max-w-3xl mx-auto"}`}>
            {attachments.map((att, i) => (
              <div
                key={i}
                className="flex items-center gap-1.5 bg-slate-100 border border-slate-200 rounded-lg pl-2 pr-1 py-1 max-w-[200px]"
              >
                {att.isImage && att.preview ? (
                  <img src={att.preview} alt="" className="w-5 h-5 rounded object-cover flex-shrink-0" />
                ) : att.isImage ? (
                  <Image className="w-4 h-4 text-indigo-500 flex-shrink-0" />
                ) : (
                  <FileText className="w-4 h-4 text-red-500 flex-shrink-0" />
                )}
                <span className="text-xs text-slate-700 truncate">{att.name}</span>
                <button
                  onClick={() => removeAttachment(i)}
                  className="flex-shrink-0 p-0.5 rounded hover:bg-slate-200 text-slate-400 hover:text-slate-600 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className={`flex items-end gap-2 ${compact ? "" : "max-w-3xl mx-auto"}`}>
          {/* AI Habit Coach */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleCoaching}
                disabled={anythingLoading}
                variant="outline"
                className="rounded-xl h-11 w-11 p-0 flex-shrink-0 border-slate-200 hover:bg-amber-50 hover:border-amber-300"
              >
                {loadingCoaching ? (
                  <Loader2 className="w-4 h-4 animate-spin text-amber-600" />
                ) : (
                  <Lightbulb className="w-4 h-4 text-amber-600" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[200px]">
              <p className="font-medium">Reminder Intelligence</p>
              <p className="text-xs text-slate-300 mt-0.5">Learns when you actually do your habits vs when you planned to, cross-referenced with your sleep data to suggest smarter reminder times</p>
            </TooltipContent>
          </Tooltip>

          {/* Sleep Analysis */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={handleSleepAnalysis}
                disabled={anythingLoading}
                variant="outline"
                className="rounded-xl h-11 w-11 p-0 flex-shrink-0 border-slate-200 hover:bg-indigo-50 hover:border-indigo-300"
              >
                {loadingSleep ? (
                  <Loader2 className="w-4 h-4 animate-spin text-indigo-500" />
                ) : (
                  <Moon className="w-4 h-4 text-indigo-500" />
                )}
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-[180px]">
              <p className="font-medium">Sleep & Energy Analysis</p>
              <p className="text-xs text-slate-300 mt-0.5">See how your sleep affects productivity, find your peak energy hours, and get data-backed sleep recommendations</p>
            </TooltipContent>
          </Tooltip>

          {/* Attach file */}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                onClick={() => fileInputRef.current?.click()}
                disabled={anythingLoading}
                variant="outline"
                className="rounded-xl h-11 w-11 p-0 flex-shrink-0 border-slate-200 hover:bg-slate-50"
              >
                <Paperclip className="w-4 h-4 text-slate-500" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="top">
              <p className="font-medium">Attach file</p>
              <p className="text-xs text-slate-300 mt-0.5">Images or PDFs (max 20 MB)</p>
            </TooltipContent>
          </Tooltip>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.pdf"
            multiple
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Text area */}
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={attachments.length ? "Add a message about this file..." : "Tell me about your goals..."}
            rows={1}
            className={cn(
              "flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm",
              "focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-300",
              "placeholder:text-slate-400 transition-all"
            )}
            style={{ height: "44px", maxHeight: "120px", minHeight: "44px" }}
            onInput={(e) => {
              e.target.style.height = "44px";
              e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px";
            }}
          />

          {/* Send */}
          <Button
            onClick={handleSend}
            disabled={(!message.trim() && attachments.length === 0) || isLoading}
            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 h-11 w-11 p-0 flex-shrink-0"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </Button>
        </div>
      </div>
    </TooltipProvider>
  );
}
