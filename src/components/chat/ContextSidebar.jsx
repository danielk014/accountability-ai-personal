import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { Plus, X, Brain, ChevronDown, ChevronUp, User, Briefcase, Users, Target, StickyNote, ChevronLeft, ChevronRight, Pencil, Check, Sparkles, Bell } from "lucide-react";
import RemindersPanel from "@/components/chat/RemindersPanel";
import BirthdayPicker from "@/components/ui/BirthdayPicker";
import { toast } from "sonner";

// Returns the next occurrence of a birthday (YYYY-MM-DD) as a task scheduled_date
function nextBirthdayDate(birthdayStr) {
  if (!birthdayStr) return null;
  const today = new Date();
  const bday = new Date(birthdayStr + "T00:00:00");
  const thisYear = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
  if (thisYear >= today) return thisYear.toISOString().split("T")[0];
  const nextYear = new Date(today.getFullYear() + 1, bday.getMonth(), bday.getDate());
  return nextYear.toISOString().split("T")[0];
}

const SECTIONS = [
  { key: "context_about", label: "About Me", icon: User, color: "bg-violet-100 text-violet-600", placeholder: "e.g. I'm 28, live in NYC, introvert who loves hiking..." },
  { key: "context_work", label: "Work & Schedule", icon: Briefcase, color: "bg-blue-100 text-blue-600", placeholder: "e.g. I work 9-5 at a startup, Tuesdays are my busiest day..." },
  { key: "context_people", label: "People in My Life", icon: Users, color: "bg-pink-100 text-pink-600", placeholder: null },
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
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
        <div className="flex items-center gap-2.5">
          <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
            <Icon className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-700">{section.label}</p>
            <p className="text-xs text-slate-400">{items.length > 0 ? `${items.length} saved` : "Nothing saved yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {items.map((item, i) => (
            editIdx === i ? (
              <div key={i} className="space-y-1.5">
                <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={3}
                  className="w-full text-xs rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => { onUpdate(i, editVal); setEditIdx(null); }}
                    className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditIdx(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={i} className="flex items-start gap-1.5 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 group">
                <span className="text-xs text-slate-700 flex-1 leading-relaxed whitespace-pre-wrap">{item}</span>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 mt-0.5">
                  <button onClick={() => { setEditIdx(i); setEditVal(item); }}
                    className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => onDelete(i)}
                    className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          ))}
          <div className="space-y-1.5">
            <textarea value={input} onChange={e => setInput(e.target.value)}
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(""); } } }}
              placeholder={section.placeholder} rows={3}
              className="w-full text-xs rounded-lg border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder:text-slate-300 resize-none" />
            <button onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }} disabled={!input.trim()}
              className="w-full py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-1">
              <Plus className="w-3.5 h-3.5" /> Save
            </button>
          </div>
        </div>
      )}
    </div>
  );
}


function PersonalitySection({ profile, saveMutation, queryClient }) {
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

  const handleEdit = () => {
    setInput(currentPersonality);
    setIsEditing(true);
  };

  return (
    <div className="border-b border-slate-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-amber-100 text-amber-600">
            <Sparkles className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-700">AI Personality</p>
            <p className="text-xs text-slate-400">{currentPersonality ? "Custom set" : "Not set yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {!isEditing && currentPersonality && (
            <div className="bg-slate-50 border border-slate-100 rounded-lg px-3 py-2 group">
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-wrap">{currentPersonality}</p>
              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity mt-2">
                <button
                  onClick={handleEdit}
                  className="p-0.5 rounded hover:bg-indigo-50 text-slate-400 hover:text-indigo-500 transition"
                >
                  <Pencil className="w-3 h-3" />
                </button>
                <button
                  onClick={() => saveMutation.mutate({ ai_personality: "" }, { onSuccess: () => toast.success("Cleared!") })}
                  className="p-0.5 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            </div>
          )}

          {isEditing ? (
            <div className="space-y-1.5">
              <textarea
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Describe how the AI should behave. E.g. 'Be like a supportive best friend who celebrates my wins and gently pushes me when I need it'"
                rows={4}
                className="w-full text-xs rounded-lg border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={handleSave}
                  disabled={!input.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 disabled:opacity-30 transition flex items-center justify-center gap-1"
                >
                  <Check className="w-3 h-3" /> Save
                </button>
                <button
                  onClick={() => setIsEditing(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              onClick={handleEdit}
              className="w-full py-2 rounded-lg border border-dashed border-indigo-300 text-xs text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> {currentPersonality ? "Edit" : "Add personality"} description
            </button>
          )}
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

  // people stored as JSON strings in context_people array
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
    <div className="border-b border-slate-100 last:border-0">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-pink-100 text-pink-600">
            <Users className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-700">People in My Life</p>
            <p className="text-xs text-slate-400">{people.length > 0 ? `${people.length} ${people.length === 1 ? "person" : "people"}` : "Nothing saved yet"}</p>
          </div>
        </div>
        {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          {people.map((person, i) => (
            editIdx === i ? (
              <div key={i} className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-1.5">
                <input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
                  className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <input value={editForm.relationship || ""} onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship"
                  className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <BirthdayPicker value={editForm.birthday || ""} onChange={v => setEditForm(f => ({ ...f, birthday: v }))} />
                <input value={editForm.interests || ""} onChange={e => setEditForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
                  className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
                <textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Extra notes" rows={2}
                  className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
                <div className="flex gap-2">
                  <button onClick={() => handleUpdate(i)}
                    className="flex-1 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-semibold hover:bg-pink-600 transition flex items-center justify-center gap-1">
                    <Check className="w-3 h-3" /> Save
                  </button>
                  <button onClick={() => setEditIdx(null)}
                    className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div key={i} className="bg-white border border-pink-100 rounded-xl px-3 py-2.5 group flex items-start justify-between gap-2">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-slate-800">{person.name}</span>
                    {person.relationship && <span className="text-xs bg-pink-100 text-pink-600 rounded-full px-2 py-0.5">{person.relationship}</span>}
                  </div>
                  {person.birthday && <p className="text-xs text-slate-500 mt-0.5">🎂 {person.birthday}</p>}
                  {person.interests && <p className="text-xs text-slate-500 mt-0.5">⭐ {person.interests}</p>}
                  {person.notes && <p className="text-xs text-slate-500 mt-0.5 italic">"{person.notes}"</p>}
                </div>
                <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                  <button onClick={() => { setEditIdx(i); setEditForm({ ...person }); }}
                    className="p-1 rounded hover:bg-pink-50 text-slate-400 hover:text-pink-500 transition">
                    <Pencil className="w-3 h-3" />
                  </button>
                  <button onClick={() => onDelete(i)}
                    className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            )
          ))}

          {showForm ? (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-1.5">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
                className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship (e.g. best friend, mom)"
                className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <BirthdayPicker value={form.birthday} onChange={v => setForm(f => ({ ...f, birthday: v }))} />
              <input value={form.interests} onChange={e => setForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
                className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else..." rows={2}
                className="w-full text-xs rounded-lg border border-pink-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
              <div className="flex gap-2">
                <button onClick={handleSave} disabled={!form.name.trim()}
                  className="flex-1 py-1.5 rounded-lg bg-pink-500 text-white text-xs font-semibold hover:bg-pink-600 disabled:opacity-30 transition">Save Person</button>
                <button onClick={() => setShowForm(false)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowForm(true)}
              className="w-full py-2 rounded-lg border border-dashed border-pink-300 text-xs text-pink-500 hover:bg-pink-50 transition flex items-center justify-center gap-1.5">
              <Plus className="w-3.5 h-3.5" /> Add person
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default function ContextSidebar() {
  const queryClient = useQueryClient();
  const [collapsed, setCollapsed] = useState(true);
  const [activeTab, setActiveTab] = useState('context'); // 'context' | 'reminders'

  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: profiles = [] } = useQuery({
    queryKey: ["profile", user?.email],
    queryFn: () => user?.email ? base44.entities.UserProfile.filter({ created_by: user.email }) : [],
  });
  const profile = profiles[0];

  const getItems = (key) => profile?.[key] || [];

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
      // Check if a birthday task for this person already exists and update it
      const existing = await base44.entities.Task.filter({ name: taskName });
      if (existing.length > 0) {
        await base44.entities.Task.update(existing[0].id, { scheduled_date: scheduledDate, scheduled_time: "09:00", frequency: "once", is_active: true });
      } else {
        await base44.entities.Task.create({ name: taskName, frequency: "once", scheduled_date: scheduledDate, scheduled_time: "09:00", category: "social", is_active: true });
      }
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    },
  });

  const handleBirthdayTask = (name, birthday) => {
    if (!name || !birthday) return;
    birthdayTaskMutation.mutate({ name, birthday });
  };

  const totalNotes = SECTIONS.reduce((sum, s) => sum + getItems(s.key).length, 0);

  return (
    <div className={`relative flex-shrink-0 h-full flex transition-all duration-300 ${collapsed ? "w-10" : "w-80"}`}>
      {/* Toggle button */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute -left-3 top-1/2 -translate-y-1/2 z-10 w-6 h-6 rounded-full bg-white border border-slate-200 shadow flex items-center justify-center hover:bg-slate-50 transition"
      >
        {collapsed
          ? <ChevronLeft className="w-3.5 h-3.5 text-slate-500" />
          : <ChevronRight className="w-3.5 h-3.5 text-slate-500" />}
      </button>

      {/* Collapsed strip */}
      {collapsed && (
        <div className="w-10 h-full bg-white border-l border-slate-200 flex flex-col items-center pt-4 gap-3">
          <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-600" />
          </div>
          {totalNotes > 0 && <span className="text-xs font-bold text-violet-600">{totalNotes}</span>}
        </div>
      )}

      {/* Expanded panel */}
      {!collapsed && (
        <div className="flex flex-col bg-white border-l border-slate-200 overflow-hidden w-full">
          {/* Tab bar */}
          <div className="flex border-b border-slate-100 flex-shrink-0">
            <button
              onClick={() => setActiveTab('context')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                activeTab === 'context'
                  ? 'text-violet-600 border-b-2 border-violet-500 bg-violet-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Brain className="w-3.5 h-3.5" /> Context
            </button>
            <button
              onClick={() => setActiveTab('reminders')}
              className={`flex-1 flex items-center justify-center gap-1.5 py-3 text-xs font-semibold transition-colors ${
                activeTab === 'reminders'
                  ? 'text-indigo-600 border-b-2 border-indigo-500 bg-indigo-50/50'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <Bell className="w-3.5 h-3.5" /> Reminders
            </button>
          </div>

          {activeTab === 'context' ? (
            <div className="flex-1 overflow-y-auto">
              {/* Personality Section */}
              <PersonalitySection profile={profile} saveMutation={saveMutation} />

              {SECTIONS.map((section) =>
                section.key === "context_people" ? (
                  <PeopleSection
                    key="context_people"
                    items={getItems("context_people")}
                    onAdd={(val) => handleAdd("context_people", val)}
                    onDelete={(idx) => handleDelete("context_people", idx)}
                    onUpdate={(idx, val) => handleUpdate("context_people", idx, val)}
                    onBirthdayTask={handleBirthdayTask}
                  />
                ) : (
                  <TextSection
                    key={section.key}
                    section={section}
                    items={getItems(section.key)}
                    onAdd={(text) => handleAdd(section.key, text)}
                    onDelete={(idx) => handleDelete(section.key, idx)}
                    onUpdate={(idx, text) => handleUpdate(section.key, idx, text)}
                  />
                )
              )}
            </div>
          ) : (
            <RemindersPanel />
          )}
        </div>
      )}
    </div>
  );
}