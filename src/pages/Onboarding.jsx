import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, Check, Sparkles, Globe, Bot, CalendarDays, MessageCircle, Plus } from "lucide-react";
import { createPageUrl } from "../utils";
import { useNavigate } from "react-router-dom";

const TIMEZONES = [
  // Americas
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Anchorage",
  "Pacific/Honolulu",
  "America/Sao_Paulo",
  "America/Argentina/Buenos_Aires",
  "America/Bogota",
  "America/Mexico_City",
  "America/Toronto",
  "America/Vancouver",
  // Europe
  "Europe/London",
  "Europe/Berlin",
  "Europe/Moscow",
  "Europe/Istanbul",
  // Africa & Middle East
  "Africa/Cairo",
  "Asia/Dubai",
  // Asia
  "Asia/Kolkata",
  "Asia/Dhaka",
  "Asia/Bangkok",
  "Asia/Singapore",
  "Asia/Hong_Kong",
  "Asia/Shanghai",
  "Asia/Tokyo",
  "Asia/Seoul",
  // Pacific
  "Australia/Sydney",
  "Australia/Brisbane",
  "Pacific/Auckland",
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

const PERSONALITY_PRESETS = [
  {
    label: "Supportive Coach",
    value: "Be warm and encouraging, like a personal coach who celebrates my wins and gently pushes me when I need it. Use positive reinforcement and practical advice.",
  },
  {
    label: "Direct Mentor",
    value: "Be direct and honest. Skip the fluff and give me clear, actionable advice. Call me out when I'm making excuses — I can handle it.",
  },
  {
    label: "Friendly Companion",
    value: "Talk to me like a close friend — casual, fun, and real. Keep things light but still help me stay on track.",
  },
  {
    label: "Calm & Analytical",
    value: "Be thoughtful and measured. Help me think through problems logically, weigh trade-offs, and make good decisions without emotional pressure.",
  },
];

const TOTAL_STEPS = 3;

function StepHeader({ icon: Icon, color, title, subtitle }) {
  return (
    <div className="flex items-start gap-4 mb-6">
      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${color}`}>
        <Icon className="w-5 h-5" />
      </div>
      <div>
        <h2 className="text-xl font-bold text-slate-900">{title}</h2>
        <p className="text-sm text-slate-500 mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [userName, setUserName] = useState("");

  // Step 1 — Timezone (snap to list if browser timezone isn't in it)
  const [timezone, setTimezone] = useState(() => {
    try {
      const detected = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
      return TIMEZONES.includes(detected) ? detected : "America/New_York";
    } catch { return "America/New_York"; }
  });

  // Step 2 — AI personality
  const [aiPersonality, setAiPersonality] = useState("");
  const [customMode, setCustomMode] = useState(false);

  useEffect(() => {
    base44.auth.me()
      .then(u => setUserName(u.full_name || u.email?.split("@")[0] || "there"))
      .catch(() => {});
  }, []);

  const handleSelectPreset = (preset) => {
    setAiPersonality(preset.value);
    setCustomMode(false);
  };

  const handleComplete = async () => {
    setLoading(true);
    setError("");
    try {
      const user = await base44.auth.me();
      const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });

      const data = {
        timezone,
        ai_personality: aiPersonality,
      };

      if (profiles.length > 0) {
        await base44.entities.UserProfile.update(profiles[0].id, data);
      } else {
        await base44.entities.UserProfile.create(data);
      }

      navigate(createPageUrl("Dashboard"), { replace: true });
    } catch (err) {
      setError("Something went wrong saving your profile. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const canAdvance = () => {
    if (step === 1) return !!timezone;
    if (step === 2) return true; // personality is optional
    if (step === 3) return true; // people is optional
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 to-violet-50 flex items-center justify-center p-4">
      <div className="w-full max-w-lg">

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -16 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-10"
        >
          <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center mx-auto mb-4 shadow-lg overflow-hidden">
            <img
              src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png"
              alt="Accountable"
              className="w-10 h-10 object-contain"
              onError={e => { e.target.style.display = "none"; }}
            />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">
            {step === 1 ? `Hey${userName ? `, ${userName}` : ""}! 👋` : "Almost there!"}
          </h1>
          <p className="text-slate-500 mt-1 text-sm">
            {step === 1
              ? "Let's get you set up in just a few steps"
              : step === 2
              ? "Customize how your AI assistant talks to you"
              : "Tell us about the people in your life"}
          </p>
        </motion.div>

        {/* Progress bar */}
        <div className="flex gap-1.5 mb-7">
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <div
              key={i}
              className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                i + 1 <= step ? "bg-indigo-600" : "bg-slate-200"
              }`}
            />
          ))}
        </div>

        {/* Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={step}
            initial={{ opacity: 0, x: 24 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 }}
            transition={{ duration: 0.2 }}
            className="bg-white rounded-2xl shadow-lg p-7 mb-5"
          >

            {/* ── Step 1: Timezone ── */}
            {step === 1 && (
              <div className="space-y-5">
                <StepHeader
                  icon={Globe}
                  color="bg-indigo-100 text-indigo-600"
                  title="Your timezone"
                  subtitle="Used for reminders, scheduling, and daily summaries"
                />
                <div className="space-y-2">
                  <Label>Select your timezone</Label>
                  <Select value={timezone} onValueChange={setTimezone}>
                    <SelectTrigger className="rounded-xl h-11">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TIMEZONES.map(tz => (
                        <SelectItem key={tz} value={tz}>{tz.replace(/_/g, " ")}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}

            {/* ── Step 2: AI Personality ── */}
            {step === 2 && (
              <div className="space-y-4">
                <StepHeader
                  icon={Bot}
                  color="bg-amber-100 text-amber-600"
                  title="AI personality"
                  subtitle="How would you like your AI assistant to communicate with you?"
                />

                {/* Preset cards */}
                {!customMode && (
                  <div className="grid grid-cols-2 gap-2">
                    {PERSONALITY_PRESETS.map(preset => (
                      <button
                        key={preset.label}
                        onClick={() => handleSelectPreset(preset)}
                        className={`text-left px-3 py-3 rounded-xl border-2 transition-all text-xs font-medium ${
                          aiPersonality === preset.value
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 hover:border-indigo-300 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        {preset.label}
                        {aiPersonality === preset.value && (
                          <Check className="w-3 h-3 inline ml-1 text-indigo-600" />
                        )}
                        <p className="text-slate-400 font-normal mt-1 line-clamp-2 leading-relaxed">
                          {preset.value.substring(0, 60)}…
                        </p>
                      </button>
                    ))}
                  </div>
                )}

                {/* Custom textarea */}
                {customMode ? (
                  <div className="space-y-2">
                    <Textarea
                      value={aiPersonality}
                      onChange={e => setAiPersonality(e.target.value)}
                      placeholder="e.g. Be like a supportive best friend who celebrates my wins and gently pushes me when I need it..."
                      className="rounded-xl bg-slate-50 border-slate-200 resize-none h-28 text-sm"
                    />
                    <button
                      onClick={() => setCustomMode(false)}
                      className="text-xs text-slate-400 hover:text-slate-600 transition"
                    >
                      ← Back to presets
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => { setAiPersonality(""); setCustomMode(true); }}
                    className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                  >
                    <Sparkles className="w-3.5 h-3.5" /> Write a custom personality instead
                  </button>
                )}

                <p className="text-xs text-slate-400 text-center">
                  You can always change this later in the chat sidebar
                </p>
              </div>
            )}

            {/* ── Step 3: Schedule intro ── */}
            {step === 3 && (
              <div className="space-y-4">
                <StepHeader
                  icon={CalendarDays}
                  color="bg-emerald-100 text-emerald-600"
                  title="Your schedule is ready"
                  subtitle="Start building your day — add your first task to the schedule"
                />

                {/* Mini schedule preview */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl overflow-hidden">
                  {/* Header */}
                  <div className="flex items-center justify-between px-4 py-2.5 bg-white border-b border-slate-100">
                    <span className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Today</span>
                    <span className="text-xs text-slate-400">
                      {new Date().toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })}
                    </span>
                  </div>
                  {/* Time slots — empty state */}
                  {["8 AM", "9 AM", "10 AM", "11 AM"].map((t, i) => (
                    <div key={t} className={`flex items-center gap-3 px-4 py-2.5 border-b border-slate-100 last:border-0 ${i === 1 ? "bg-indigo-50/50" : ""}`}>
                      <span className="text-xs text-slate-400 w-12 flex-shrink-0">{t}</span>
                      {i === 1 ? (
                        <div className="flex-1 h-7 rounded-lg border-2 border-dashed border-indigo-300 flex items-center justify-center">
                          <span className="text-xs text-indigo-400 flex items-center gap-1">
                            <Plus className="w-3 h-3" /> Add your first task here
                          </span>
                        </div>
                      ) : (
                        <div className="flex-1 h-px bg-slate-100" />
                      )}
                    </div>
                  ))}
                </div>

                {/* Two ways to add tasks */}
                <div className="grid grid-cols-2 gap-3">
                  <a
                    href={createPageUrl("Calendar")}
                    className="flex flex-col items-center gap-2 p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl hover:bg-emerald-100 transition text-center"
                  >
                    <div className="w-9 h-9 rounded-xl bg-emerald-100 flex items-center justify-center">
                      <CalendarDays className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Open Schedule</p>
                      <p className="text-xs text-slate-500 mt-0.5">Drag & drop tasks into your day</p>
                    </div>
                  </a>

                  <div className="flex flex-col items-center gap-2 p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl text-center">
                    <div className="w-9 h-9 rounded-xl bg-indigo-100 flex items-center justify-center">
                      <MessageCircle className="w-5 h-5 text-indigo-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">Use the AI chat</p>
                      <p className="text-xs text-slate-500 mt-0.5">Tap the bubble in the bottom-right</p>
                    </div>
                  </div>
                </div>

                {/* Example prompts */}
                <div className="bg-slate-900 rounded-xl px-4 py-3 space-y-1.5">
                  <p className="text-xs text-slate-400 mb-2">Try saying to the AI:</p>
                  {[
                    '"Add a gym session at 7am every morning"',
                    '"Remind me to hydrate every day at noon"',
                    '"Schedule deep work from 9–11am on weekdays"',
                  ].map((ex) => (
                    <p key={ex} className="text-xs text-emerald-400 font-mono">{ex}</p>
                  ))}
                </div>

                {error && (
                  <div className="px-4 py-2.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-600 font-medium">
                    {error}
                  </div>
                )}
              </div>
            )}

          </motion.div>
        </AnimatePresence>

        {/* Navigation */}
        <div className="flex gap-3">
          {step > 1 && (
            <Button
              onClick={() => setStep(s => s - 1)}
              variant="outline"
              className="flex-1 rounded-xl h-11"
              disabled={loading}
            >
              Back
            </Button>
          )}
          <Button
            onClick={step === TOTAL_STEPS ? handleComplete : () => setStep(s => s + 1)}
            disabled={!canAdvance() || loading}
            className="flex-1 rounded-xl h-11 bg-indigo-600 hover:bg-indigo-700 text-white"
          >
            {loading ? (
              "Saving..."
            ) : step === TOTAL_STEPS ? (
              <>
                <Check className="w-4 h-4 mr-2" />
                Let's go!
              </>
            ) : (
              <>
                Next
                <ArrowRight className="w-4 h-4 ml-2" />
              </>
            )}
          </Button>
        </div>

        <p className="text-center text-xs text-slate-400 mt-4">
          Step {step} of {TOTAL_STEPS}
        </p>
      </div>
    </div>
  );
}
