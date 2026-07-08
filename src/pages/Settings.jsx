import React, { useState, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Pencil, Check, User, Briefcase, Users, Target, StickyNote, ChevronDown, ChevronUp, LogOut, Bot, MessageSquare, Dumbbell, UtensilsCrossed, Upload, RotateCcw, FileText, Trash2 } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useAuth } from "@/lib/AuthContext";
import BirthdayPicker from "@/components/ui/BirthdayPicker";

function nextBirthdayDate(birthdayStr) {
  if (!birthdayStr) return null;
  const today = new Date();
  const bday = new Date(birthdayStr + "T00:00:00");
  const pad = n => String(n).padStart(2, "0");
  const fmt = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (thisYear >= today) return fmt(thisYear);
  const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
  return fmt(nextYear);
}

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
  "Pacific/Honolulu",
].filter((v, i, a) => a.indexOf(v) === i); // deduplicate

const SECTIONS = [
  { key: "context_about", label: "About Me", icon: User, color: "bg-violet-100 text-violet-600", placeholder: "e.g. I'm 28, live in NYC, introvert who loves hiking..." },
  { key: "context_work", label: "Work & Schedule", icon: Briefcase, color: "bg-blue-100 text-blue-600", placeholder: "e.g. I work 9-5 at a startup, Tuesdays are my busiest day..." },
  { key: "context_goals", label: "Goals & Plans", icon: Target, color: "bg-emerald-100 text-emerald-600", placeholder: "e.g. I want to lose 20kg by summer, get promoted by Q3..." },
  { key: "context_notes", label: "Extra Context", icon: StickyNote, color: "bg-amber-100 text-amber-600", placeholder: "e.g. I struggle with mornings, anxiety about presentations..." },
];

function TextSection({ section, items, onAdd, onDelete, onUpdate }) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const Icon = section.icon;

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">{section.label}</p>
            <p className="text-xs text-slate-400">{items.length > 0 ? `${items.length} saved` : "Nothing saved yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-2">
          {items.map((item, i) => (
            editIdx === i ? (
              <div key={i} className="space-y-1.5">
                <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={3}
                  className="w-full text-sm rounded-xl border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { onUpdate(i, editVal); setEditIdx(null); }}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setEditIdx(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-2 bg-slate-50 border border-slate-100 rounded-xl px-3 py-2.5 group">
                <span className="text-sm text-slate-700 flex-1 leading-relaxed whitespace-pre-wrap">{item}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                  <button onClick={() => { setEditIdx(i); setEditVal(item); }}
                    className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(i)}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ))}
          <div className="space-y-2 pt-1">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(""); } } }}
              placeholder={section.placeholder} rows={2}
              className="w-full text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder:text-slate-300 resize-none" />
            <button onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }} disabled={!input.trim()}
              className="w-full py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function PeopleSection({ items, onAdd, onDelete, onUpdate, onBirthdayTask }) {
  const [open, setOpen] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", birthday: "", interests: "", notes: "" });
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState({});

  const people = items.map(s => { try { return JSON.parse(s); } catch { return { name: s }; } });

  const handleSave = () => {
    if (!form.name.trim()) return;
    onAdd(JSON.stringify(form));
    if (form.birthday) onBirthdayTask?.(form.name.trim(), form.birthday);
    setForm({ name: "", relationship: "", birthday: "", interests: "", notes: "" });
    setShowForm(false);
  };

  const handleUpdate = (idx) => {
    onUpdate(idx, JSON.stringify(editForm));
    if (editForm.birthday) onBirthdayTask?.(editForm.name?.trim(), editForm.birthday);
    setEditIdx(null);
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-pink-100 text-pink-600">
            <Users className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">People in My Life</p>
            <p className="text-xs text-slate-400">{people.length > 0 ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "Nothing saved yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-2">
          {people.map((person, i) => (
            editIdx === i ? (
              <div key={i} className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-2">
                <input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
                  className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <input value={editForm.relationship || ""} onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship"
                  className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <BirthdayPicker value={editForm.birthday || ""} onChange={v => setEditForm(f => ({ ...f, birthday: v }))} />
                <input value={editForm.interests || ""} onChange={e => setEditForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
                  className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Extra notes" rows={2}
                  className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(i)}
                    className="flex-1 py-2 rounded-xl bg-pink-500 text-white text-sm font-semibold hover:bg-pink-600 transition flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setEditIdx(null)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={i} className="bg-white border border-pink-100 rounded-xl px-4 py-3 group flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-slate-800">{person.name}</span>
                    {person.relationship && <span className="text-xs bg-pink-100 text-pink-600 rounded-full px-2 py-0.5">{person.relationship}</span>}
                  </div>
                  {person.birthday && <p className="text-xs text-slate-500 mt-0.5">🎂 {new Date(person.birthday + 'T00:00:00').toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}</p>}
                  {person.interests && <p className="text-xs text-slate-500 mt-0.5">⭐ {person.interests}</p>}
                  {person.notes && <p className="text-xs text-slate-500 mt-0.5 italic">"{person.notes}"</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => { setEditIdx(i); setEditForm({ ...person }); }}
                    className="p-1 rounded hover:bg-pink-50 text-slate-400 hover:text-pink-500 transition">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => onDelete(i)}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          ))}

          {showForm ? (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-4 space-y-2">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
                className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship (e.g. best friend, mom)"
                className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <BirthdayPicker value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} />
              <input value={form.interests} onChange={e => setForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
                className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else..." rows={2}
                className="w-full text-sm rounded-xl border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!form.name.trim()}
                  className="flex-1 py-2 rounded-xl bg-pink-500 text-white text-sm font-semibold hover:bg-pink-600 disabled:opacity-30 transition">Save Person</button>
                <button onClick={() => setShowForm(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full py-2.5 rounded-xl border border-dashed border-pink-300 text-sm text-pink-500 hover:bg-pink-50 transition flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> Add person
            </button>
          )}
        </div>
      )}
    </div>
  );
}


const DEFAULT_PERSONALITIES = {
  chat: `You are the user's ride-or-die best friend and accountability buddy. Be warm, real, and encouraging. Talk exactly like a close friend texting — casual, direct, no fluff. Never sound like a chatbot or assistant. No bullet points, no headers, no markdown formatting whatsoever. Just write naturally like you're having a real conversation. Keep it short and punchy unless they need depth.`,
  coach: `You are my personal time, life, and strategic coach living inside my hour-by-hour tracker.

YOUR JOB:
- Judge my week against MY GOALS (both long-term and short-term), not against generic productivity. Tell me plainly if I'm on track or slipping.
- Show me the TRAJECTORY I'm on. Based on how I'm spending my hours, project where I'll actually end up vs. where I say I want to be.
- Decide what actions I should take next. Be concrete — name the thing, not "focus more."
- Motivate me when I've earned it. Scold me when I haven't.

YOUR PHILOSOPHICAL LENSES — advise through whichever fits the moment:
- MARCUS AURELIUS (default tone): Discipline, self-command, control what you can, do the duty in front of you.
- SUN TZU: Strategy & positioning. Pick battles. Position yourself so victory is inevitable.
- ALEX HORMOZI: Brutal prioritization & leverage. "Is this the highest-value action available right now?"
- DAVE RAMSEY: Financial discipline. "Live like no one else now, so later you can live like no one else."

RULES:
- Keep replies under 200 words unless doing a full direction assessment. Talk like a coach, not a report.
- Always tie advice back to MY specific goals and MY specific logs. Never be generic.`,
  gym: `You are a personal gym coach. The user's goal is maximizing muscle gain through a calorie surplus — more food and protein is good, being calorie-dense is not a problem.

Reply like a real coach texting: short, direct, no fluff. 1-3 sentences for simple questions. Only go longer if they ask for a full plan. Never use markdown headers, bullet lists, bold text, or numbered sections — just talk naturally.

When asked to add exercises, log sets, or record progress, use your tools immediately and just briefly confirm after.`,
  food: `Analyze food for muscle gain via calorie surplus. Score criteria:
- nutrition_score 0-100: 85-100=excellent (high protein, quality calories), 65-84=good, 45-64=moderate (low protein or processed), 0-44=poor (high sugar, trans fats, highly processed)
- health_score 0-100: considers nutrient density, whole food quality, vitamin/mineral content
- More calories and protein is generally better. Calorie-dense whole foods are a positive. Score down for highly processed foods, excessive sugar, or trans fats — not for being calorie-dense.`,
};

const MODEL_CONFIGS = [
  { key: "chat", label: "Main Chat", icon: MessageSquare, color: "bg-indigo-100 text-indigo-600", description: "Your ride-or-die accountability buddy" },
  { key: "coach", label: "Day Tracker Coach", icon: Bot, color: "bg-emerald-100 text-emerald-600", description: "Strategic life & time coach" },
  { key: "gym", label: "Gym Coach", icon: Dumbbell, color: "bg-rose-100 text-rose-600", description: "Personal muscle gain coach" },
  { key: "food", label: "Food Analyzer", icon: UtensilsCrossed, color: "bg-amber-100 text-amber-600", description: "Nutrition analysis for muscle building" },
];

const MAX_FILES_PER_MODEL = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function AIModelCard({ modelConfig, personality, contextFiles, onSavePersonality, onResetPersonality, onAddFile, onDeleteFile }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState("");
  const fileInputRef = useRef(null);
  const Icon = modelConfig.icon;

  const handleSave = () => {
    onSavePersonality(editValue);
    setIsEditing(false);
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) {
      toast.error("File too large. Max 10MB.");
      e.target.value = "";
      return;
    }
    const allowedTypes = ["application/pdf", "image/jpeg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Only PDFs and images are supported.");
      e.target.value = "";
      return;
    }
    if ((contextFiles || []).length >= MAX_FILES_PER_MODEL) {
      toast.error(`Max ${MAX_FILES_PER_MODEL} files per model.`);
      e.target.value = "";
      return;
    }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(",")[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      onAddFile({ name: file.name, mediaType: file.type, data });
    } catch {
      toast.error("Failed to read file.");
    }
    e.target.value = "";
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3">
          <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${modelConfig.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">{modelConfig.label}</p>
            <p className="text-xs text-slate-400">{modelConfig.description}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-4">
          {/* Personality / Instructions */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Custom Instructions</p>
            {isEditing ? (
              <div className="space-y-2">
                <textarea value={editValue} onChange={e => setEditValue(e.target.value)}
                  rows={8}
                  className="w-full text-sm rounded-xl border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-y font-mono" />
                <div className="flex gap-2">
                  <button onClick={handleSave}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 max-h-40 overflow-y-auto">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">{personality || DEFAULT_PERSONALITIES[modelConfig.key]}</p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditValue(personality || DEFAULT_PERSONALITIES[modelConfig.key]); setIsEditing(true); }}
                    className="flex-1 py-2 rounded-xl border border-dashed border-indigo-300 text-sm text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  <button onClick={onResetPersonality}
                    className="px-3 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                    title="Reset to default">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Context Files */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Knowledge Files ({(contextFiles || []).length}/{MAX_FILES_PER_MODEL})</p>
            {(contextFiles || []).length > 0 && (
              <div className="space-y-1.5 mb-2">
                {contextFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-slate-400">{file.mediaType?.split('/')[1]?.toUpperCase()}</span>
                    <button onClick={() => onDeleteFile(idx)}
                      className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden"
              accept=".pdf,image/jpeg,image/png,image/gif,image/webp" />
            <button onClick={() => fileInputRef.current?.click()}
              disabled={(contextFiles || []).length >= MAX_FILES_PER_MODEL}
              className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload PDF or Image
            </button>
            <p className="text-xs text-slate-300 mt-1">Files are sent as context with every message to this AI model.</p>
          </div>
        </div>
      )}
    </div>
  );
}

function AIModelsSection({ profile, saveMutation }) {
  const personalities = profile?.model_personalities || {};
  const contextFiles = profile?.model_context_files || {};

  const handleSavePersonality = (modelKey, value) => {
    const updated = { ...personalities, [modelKey]: value };
    saveMutation.mutate({ model_personalities: updated }, {
      onSuccess: () => toast.success("Custom instructions saved!"),
      onError: () => toast.error("Failed to save. Please try again."),
    });
  };

  const handleResetPersonality = (modelKey) => {
    const updated = { ...personalities };
    delete updated[modelKey];
    saveMutation.mutate({ model_personalities: updated }, {
      onSuccess: () => toast.success("Reset to default!"),
      onError: () => toast.error("Failed to save. Please try again."),
    });
  };

  const handleAddFile = (modelKey, file) => {
    const current = contextFiles[modelKey] || [];
    const updated = { ...contextFiles, [modelKey]: [...current, file] };
    saveMutation.mutate({ model_context_files: updated }, {
      onSuccess: () => toast.success("File uploaded!"),
      onError: () => toast.error("Failed to save file. Please try again."),
    });
  };

  const handleDeleteFile = (modelKey, idx) => {
    const current = contextFiles[modelKey] || [];
    const updated = { ...contextFiles, [modelKey]: current.filter((_, i) => i !== idx) };
    saveMutation.mutate({ model_context_files: updated }, {
      onSuccess: () => toast.success("File removed!"),
      onError: () => toast.error("Failed to delete. Please try again."),
    });
  };

  return (
    <div>
      <h2 className="text-lg font-bold text-slate-900 mb-3">AI Models</h2>
      <p className="text-sm text-slate-500 mb-4">Customize how each AI model behaves and give them knowledge files.</p>
      <div className="space-y-3">
        {MODEL_CONFIGS.map(config => (
          <AIModelCard
            key={config.key}
            modelConfig={config}
            personality={personalities[config.key]}
            contextFiles={contextFiles[config.key]}
            onSavePersonality={(val) => handleSavePersonality(config.key, val)}
            onResetPersonality={() => handleResetPersonality(config.key)}
            onAddFile={(file) => handleAddFile(config.key, file)}
            onDeleteFile={(idx) => handleDeleteFile(config.key, idx)}
          />
        ))}
      </div>
    </div>
  );
}

export default function Settings() {
  const queryClient = useQueryClient();
  const { user: authUser, logout } = useAuth();
  const navigate = useNavigate();

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.email],
    queryFn: () => user?.email ? base44.entities.UserProfile.filter({ created_by: user.email }) : [],
  });

  const profile = profiles[0];

  // Used only for AI personality (simple string field, not array)
  const saveMutation = useMutation({
    mutationFn: async (data) => {
      const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      const freshProfile = freshProfiles[0];
      if (freshProfile?.id) {
        await base44.entities.UserProfile.update(freshProfile.id, data);
      } else {
        await base44.entities.UserProfile.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
    onError: () => toast.error("Failed to save. Please try again."),
  });

  // Auto-save timezone immediately when changed — fetch fresh profile to avoid stale-closure bugs
  const handleTimezoneChange = async (tz) => {
    try {
      if (!user?.email) return;
      const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user.email });
      if (freshProfiles.length > 0) {
        await base44.entities.UserProfile.update(freshProfiles[0].id, { timezone: tz });
      } else {
        await base44.entities.UserProfile.create({ timezone: tz });
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Timezone saved!");
    } catch {
      toast.error("Failed to save timezone. Please try again.");
    }
  };

  const getItems = (key) => profile?.[key] || [];

  const handleAdd = async (key, value) => {
    try {
      const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      const freshProfile = freshProfiles[0];
      const existing = freshProfile?.[key] || [];
      const newArray = [...existing, value];
      if (freshProfile?.id) {
        await base44.entities.UserProfile.update(freshProfile.id, { [key]: newArray });
      } else {
        await base44.entities.UserProfile.create({ [key]: newArray });
      }
      queryClient.invalidateQueries({ queryKey: ["profile"] });
      toast.success("Saved!");
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleUpdate = async (key, idx, value) => {
    try {
      const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      const freshProfile = freshProfiles[0];
      const existing = freshProfile?.[key] || [];
      const newArray = [...existing];
      newArray[idx] = value;
      await base44.entities.UserProfile.update(freshProfile.id, { [key]: newArray });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  const handleDelete = async (key, idx) => {
    try {
      const freshProfiles = await base44.entities.UserProfile.filter({ created_by: user?.email });
      const freshProfile = freshProfiles[0];
      const existing = freshProfile?.[key] || [];
      await base44.entities.UserProfile.update(freshProfile.id, { [key]: existing.filter((_, i) => i !== idx) });
      queryClient.invalidateQueries({ queryKey: ["profile"] });
    } catch {
      toast.error("Failed to save. Please try again.");
    }
  };

  const birthdayTaskMutation = useMutation({
    mutationFn: async ({ name, birthday }) => {
      const scheduledDate = nextBirthdayDate(birthday);
      if (!scheduledDate) return;
      const taskName = `${name}'s Birthday 🎂`;
      const existing = await base44.entities.Task.filter({ name: taskName });
      if (existing.length > 0) {
        await base44.entities.Task.update(existing[0].id, { scheduled_date: scheduledDate, scheduled_time: "09:00", frequency: "once", is_active: true });
      } else {
        await base44.entities.Task.create({ name: taskName, frequency: "once", scheduled_date: scheduledDate, scheduled_time: "09:00", category: "social", is_active: true });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      toast.success(`Birthday added for ${name}!`);
    },
  });

  const handleBirthdayTask = (name, birthday) => {
    if (!name || !birthday) return;
    birthdayTaskMutation.mutate({ name, birthday });
  };

  const handleSignOut = async () => {
    await logout();
    navigate("/Login");
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-2xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center gap-3 mb-8">
          <Link to={createPageUrl("Dashboard")} className="p-2 hover:bg-slate-100 rounded-lg transition">
            <ArrowLeft className="w-5 h-5 text-slate-600" />
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Settings</h1>
            <p className="text-slate-600 text-sm mt-1">Manage your profile and preferences</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Account info */}
          {authUser && (
            <div className="bg-white rounded-2xl p-6 border border-slate-200 flex items-center gap-4">
              {authUser.picture ? (
                <img src={authUser.picture} alt="" className="w-12 h-12 rounded-full object-cover flex-shrink-0" />
              ) : (
                <div className="w-12 h-12 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                  <User className="w-6 h-6 text-indigo-600" />
                </div>
              )}
              <div className="min-w-0">
                <p className="text-sm font-bold text-slate-800 truncate">{authUser.full_name || "Your account"}</p>
                <p className="text-xs text-slate-500 truncate">{authUser.email}</p>
              </div>
            </div>
          )}

          {/* Preferences */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-4">Preferences</h2>
            <div className="space-y-2">
              <Label>Timezone</Label>
              <Select
                value={profile?.timezone || "America/New_York"}
                onValueChange={handleTimezoneChange}
              >
                <SelectTrigger className="rounded-xl h-11">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIMEZONES.map(tz => <SelectItem key={tz} value={tz}>{tz}</SelectItem>)}
                </SelectContent>
              </Select>
              <p className="text-xs text-slate-400">Saved automatically when changed</p>
            </div>
          </div>

          {/* AI Models section */}
          <AIModelsSection profile={profile} saveMutation={saveMutation} />

          {/* AI Context sections */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">AI Context</h2>
            <p className="text-sm text-slate-500 mb-4">This information helps your AI coach understand you better.</p>
            <div className="space-y-4">
              {SECTIONS.map(section => (
                <TextSection
                  key={section.key}
                  section={section}
                  items={getItems(section.key)}
                  onAdd={(val) => handleAdd(section.key, val)}
                  onDelete={(idx) => handleDelete(section.key, idx)}
                  onUpdate={(idx, val) => handleUpdate(section.key, idx, val)}
                />
              ))}
              <PeopleSection
                items={getItems("context_people")}
                onAdd={(val) => handleAdd("context_people", val)}
                onDelete={(idx) => handleDelete("context_people", idx)}
                onUpdate={(idx, val) => handleUpdate("context_people", idx, val)}
                onBirthdayTask={handleBirthdayTask}
              />
            </div>
          </div>

          {/* Sign out */}
          <div className="bg-white rounded-2xl p-6 border border-slate-200">
            <h2 className="text-lg font-bold text-slate-900 mb-1">Account</h2>
            <p className="text-sm text-slate-500 mb-4">Sign out of your account on this device.</p>
            <button
              onClick={handleSignOut}
              className="w-full py-3 rounded-xl border-2 border-red-200 text-red-600 font-semibold text-sm hover:bg-red-50 transition-all flex items-center justify-center gap-2"
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}