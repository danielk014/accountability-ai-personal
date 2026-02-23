import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Plus, X, Pencil, Check, Sparkles, User, Briefcase, Users, Target, StickyNote, ChevronDown, ChevronUp, LogOut } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { createPageUrl } from "../utils";
import { useAuth } from "@/lib/AuthContext";
import BirthdayPicker from "@/components/ui/BirthdayPicker";

function nextBirthdayDate(birthdayStr) {
  if (!birthdayStr) return null;
  const today = new Date();
  const bday = new Date(birthdayStr + "T00:00:00");
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (thisYear >= today) return thisYear.toISOString().split("T")[0];
  const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
  return nextYear.toISOString().split("T")[0];
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


function PersonalitySection({ profile, saveMutation }) {
  const [open, setOpen] = useState(true);
  const [input, setInput] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const currentPersonality = profile?.ai_personality || "";

  const handleSave = () => {
    if (!input.trim()) return;
    saveMutation.mutate({ ai_personality: input.trim() }, {
      onSuccess: () => {
        setIsEditing(false);
        toast.success("AI personality updated!");
      },
      onError: () => toast.error("Failed to save. Please try again."),
    });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">AI Personality</p>
            <p className="text-xs text-slate-400">{currentPersonality ? "Custom set" : "Not set yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </button>
      {open && (
        <div className="px-6 pb-5 space-y-2">
          {!isEditing && currentPersonality && (
            <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 group">
              <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{currentPersonality}</p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                <button onClick={() => { setInput(currentPersonality); setIsEditing(true); }}
                  className="p-1 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition"><Pencil className="w-3.5 h-3.5" /></button>
                <button onClick={() => { saveMutation.mutate({ ai_personality: "" }, { onSuccess: () => toast.success("Cleared!") }); }}
                  className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"><X className="w-3.5 h-3.5" /></button>
              </div>
            </div>
          )}
          {isEditing ? (
            <div className="space-y-2">
              <textarea value={input} onChange={e => setInput(e.target.value)}
                placeholder="Describe how the AI should behave. E.g. 'Be like a supportive best friend who celebrates my wins and gently pushes me when I need it'"
                rows={4}
                className="w-full text-sm rounded-xl border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!input.trim()}
                  className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 disabled:opacity-30 transition flex items-center justify-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setIsEditing(false)}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => { setInput(currentPersonality); setIsEditing(true); }}
              className="w-full py-2.5 rounded-xl border border-dashed border-indigo-300 text-sm text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center gap-1.5">
              <Plus className="w-4 h-4" /> {currentPersonality ? "Edit" : "Add personality"} description
            </button>
          )}
        </div>
      )}
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

  const saveMutation = useMutation({
    mutationFn: async (data) => {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, data);
      } else {
        await base44.entities.UserProfile.create(data);
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
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

  const handleAdd = (key, value) => {
    saveMutation.mutate({ [key]: [...getItems(key), value] });
    toast.success("Saved!");
  };

  const handleUpdate = (key, idx, value) => {
    const arr = [...getItems(key)];
    arr[idx] = value;
    saveMutation.mutate({ [key]: arr });
  };

  const handleDelete = (key, idx) => {
    saveMutation.mutate({ [key]: getItems(key).filter((_, i) => i !== idx) });
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
      toast.success(`Birthday added to calendar for ${name}!`);
    },
  });

  const handleBirthdayTask = (name, birthday) => {
    if (!name || !birthday) return;
    birthdayTaskMutation.mutate({ name, birthday });
  };

  const handleSignOut = () => {
    logout();
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

          {/* AI Context sections */}
          <div>
            <h2 className="text-lg font-bold text-slate-900 mb-3">AI Context</h2>
            <p className="text-sm text-slate-500 mb-4">This information helps your AI coach understand you better.</p>
            <div className="space-y-4">
              <PersonalitySection profile={profile} saveMutation={saveMutation} />
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