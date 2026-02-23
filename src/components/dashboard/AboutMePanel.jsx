import React, { useState } from "react";
import { base44 } from "@/api/base44Client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, X, Brain, ChevronDown, ChevronUp, User, Briefcase, Users, Target, StickyNote, Pencil, Check } from "lucide-react";
import { toast } from "sonner";

const SECTIONS = [
  { key: "about", label: "About Me", icon: User, color: "bg-violet-100 text-violet-600", placeholder: "e.g. I'm 28, live in NYC, introvert who loves hiking..." },
  { key: "work", label: "Work & Schedule", icon: Briefcase, color: "bg-blue-100 text-blue-600", placeholder: "e.g. I work 9-5 at a startup, Tuesdays are my busiest day..." },
  { key: "people", label: "People in My Life", icon: Users, color: "bg-pink-100 text-pink-600", placeholder: null },
  { key: "goals", label: "Goals & Plans", icon: Target, color: "bg-emerald-100 text-emerald-600", placeholder: "e.g. I want to lose 20kg by summer, get promoted by Q3..." },
  { key: "notes", label: "Extra Context", icon: StickyNote, color: "bg-amber-100 text-amber-600", placeholder: "e.g. I struggle with mornings, anxiety about presentations..." },
];

function TextSubsection({ section, items, onAdd, onDelete, onUpdate }) {
  const [input, setInput] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const Icon = section.icon;

  return (
    <div className="space-y-2">
      {items.map((item, i) => (
        <div key={i}>
          {editIdx === i ? (
            <div className="space-y-1.5">
              <textarea value={editVal} onChange={e => setEditVal(e.target.value)} rows={3}
                className="w-full text-sm rounded-xl border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-none" />
              <div className="flex gap-2">
                <button onClick={() => { onUpdate(i, editVal); setEditIdx(null); }}
                  className="px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-xs font-semibold hover:bg-indigo-700 transition flex items-center gap-1">
                  <Check className="w-3.5 h-3.5" /> Save
                </button>
                <button onClick={() => setEditIdx(null)}
                  className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2 bg-slate-50 rounded-xl px-3 py-2.5 group">
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
          )}
        </div>
      ))}
      <div className="flex gap-2">
        <input value={input} onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (input.trim()) { onAdd(input.trim()); setInput(""); } } }}
          placeholder={section.placeholder}
          className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white placeholder:text-slate-300" />
        <button onClick={() => { if (input.trim()) { onAdd(input.trim()); setInput(""); } }} disabled={!input.trim()}
          className="px-3 py-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition">
          <Plus className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function PersonSubsection({ people, onAdd, onDelete, onUpdate }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: "", relationship: "", birthday: "", interests: "", notes: "" });
  const [editIdx, setEditIdx] = useState(null);
  const [editForm, setEditForm] = useState({});

  const handleSave = () => {
    if (!form.name.trim()) return;
    onAdd({ ...form });
    setForm({ name: "", relationship: "", birthday: "", interests: "", notes: "" });
    setShowForm(false);
  };

  return (
    <div className="space-y-2">
      {people.map((person, i) => (
        <div key={i}>
          {editIdx === i ? (
            <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-2">
              <input value={editForm.name || ""} onChange={e => setEditForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
                className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <input value={editForm.relationship || ""} onChange={e => setEditForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship"
                className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <input value={editForm.birthday || ""} onChange={e => setEditForm(f => ({ ...f, birthday: e.target.value }))} placeholder="Birthday"
                className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <input value={editForm.interests || ""} onChange={e => setEditForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
                className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
              <textarea value={editForm.notes || ""} onChange={e => setEditForm(f => ({ ...f, notes: e.target.value }))} placeholder="Extra notes" rows={2}
                className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
              <div className="flex gap-2">
                <button onClick={() => { onUpdate(i, editForm); setEditIdx(null); }}
                  className="flex-1 py-2 rounded-lg bg-pink-500 text-white text-sm font-semibold hover:bg-pink-600 transition flex items-center justify-center gap-1">
                  <Check className="w-4 h-4" /> Save
                </button>
                <button onClick={() => setEditIdx(null)}
                  className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-pink-100 rounded-xl px-3 py-2.5 group flex items-start justify-between gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-slate-800">{person.name}</span>
                  {person.relationship && <span className="text-xs bg-pink-100 text-pink-600 rounded-full px-2 py-0.5">{person.relationship}</span>}
                </div>
                {person.birthday && <p className="text-xs text-slate-500 mt-1">🎂 {person.birthday}</p>}
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
          )}
        </div>
      ))}
      {showForm ? (
        <div className="bg-pink-50 border border-pink-200 rounded-xl p-3 space-y-2">
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Name *"
            className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
          <input value={form.relationship} onChange={e => setForm(f => ({ ...f, relationship: e.target.value }))} placeholder="Relationship (e.g. best friend, mom)"
            className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
          <input value={form.birthday} onChange={e => setForm(f => ({ ...f, birthday: e.target.value }))} placeholder="Birthday (e.g. March 15)"
            className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
          <input value={form.interests} onChange={e => setForm(f => ({ ...f, interests: e.target.value }))} placeholder="Interests"
            className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white" />
          <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Anything else..." rows={2}
            className="w-full text-sm rounded-lg border border-pink-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-pink-300 bg-white resize-none" />
          <div className="flex gap-2">
            <button onClick={handleSave} disabled={!form.name.trim()}
              className="flex-1 py-2 rounded-lg bg-pink-500 text-white text-sm font-semibold hover:bg-pink-600 disabled:opacity-30 transition">
              Save Person
            </button>
            <button onClick={() => setShowForm(false)}
              className="px-3 py-2 rounded-lg border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
          </div>
        </div>
      ) : (
        <button onClick={() => setShowForm(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-pink-300 text-sm text-pink-500 hover:bg-pink-50 transition flex items-center justify-center gap-1.5">
          <Plus className="w-4 h-4" /> Add person
        </button>
      )}
    </div>
  );
}

export default function AboutMePanel({ profile }) {
  const [expanded, setExpanded] = useState(false);
  const [openSection, setOpenSection] = useState(null);
  const queryClient = useQueryClient();

  const rawNotes = profile?.about_me_notes || [];
  const structured = (() => {
    if (Array.isArray(rawNotes)) {
      return { about: [], work: [], people: [], goals: [], notes: rawNotes };
    }
    return rawNotes;
  })();

  const structuredWithPeople = {
    ...structured,
    people: (structured.people || []).map(p =>
      typeof p === "string" ? { name: p, relationship: "", birthday: "", interests: "", notes: "" } : p
    ),
  };

  const totalItems = SECTIONS.reduce((sum, s) => sum + (structuredWithPeople[s.key] || []).length, 0);

  const saveMutation = useMutation({
    mutationFn: async (updated) => {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, { about_me_notes: updated });
      } else {
        await base44.entities.UserProfile.create({ about_me_notes: updated });
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["profile"] }),
  });

  const handleAddText = (key, text) => {
    saveMutation.mutate({ ...structuredWithPeople, [key]: [...(structuredWithPeople[key] || []), text] });
    toast.success("Saved!");
  };
  const handleUpdateText = (key, idx, text) => {
    const arr = [...(structuredWithPeople[key] || [])];
    arr[idx] = text;
    saveMutation.mutate({ ...structuredWithPeople, [key]: arr });
    toast.success("Updated!");
  };
  const handleDeleteText = (key, idx) => {
    saveMutation.mutate({ ...structuredWithPeople, [key]: (structuredWithPeople[key] || []).filter((_, i) => i !== idx) });
  };
  const handleAddPerson = (person) => {
    saveMutation.mutate({ ...structuredWithPeople, people: [...structuredWithPeople.people, person] });
    toast.success("Person saved!");
  };
  const handleUpdatePerson = (idx, person) => {
    const arr = [...structuredWithPeople.people]; arr[idx] = person;
    saveMutation.mutate({ ...structuredWithPeople, people: arr });
    toast.success("Updated!");
  };
  const handleDeletePerson = (idx) => {
    saveMutation.mutate({ ...structuredWithPeople, people: structuredWithPeople.people.filter((_, i) => i !== idx) });
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden mb-6">
      <button onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Brain className="w-4 h-4 text-violet-600" />
          </div>
          <div className="text-left">
            <p className="text-sm font-semibold text-slate-800">My Context for AI</p>
            <p className="text-xs text-slate-400">
              {totalItems > 0 ? `${totalItems} saved · AI uses all of this` : "Help your AI truly know you"}
            </p>
          </div>
        </div>
        {expanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
      </button>

      {expanded && (
        <div className="border-t border-slate-100 divide-y divide-slate-100">
          {SECTIONS.map(section => {
            const Icon = section.icon;
            const items = structuredWithPeople[section.key] || [];
            const isOpen = openSection === section.key;
            return (
              <div key={section.key}>
                <button onClick={() => setOpenSection(isOpen ? null : section.key)}
                  className="w-full flex items-center justify-between px-5 py-3 hover:bg-slate-50 transition">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${section.color}`}>
                      <Icon className="w-4 h-4" />
                    </div>
                    <div className="text-left">
                      <p className="text-sm font-medium text-slate-700">{section.label}</p>
                      {items.length > 0 && (
                        <p className="text-xs text-slate-400">{items.length} saved</p>
                      )}
                    </div>
                  </div>
                  {isOpen ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
                </button>
                {isOpen && (
                  <div className="px-5 pb-4">
                    {section.key === "people" ? (
                      <PersonSubsection
                        people={items}
                        onAdd={handleAddPerson}
                        onDelete={handleDeletePerson}
                        onUpdate={handleUpdatePerson}
                      />
                    ) : (
                      <TextSubsection
                        section={section}
                        items={items}
                        onAdd={(text) => handleAddText(section.key, text)}
                        onDelete={(idx) => handleDeleteText(section.key, idx)}
                        onUpdate={(idx, text) => handleUpdateText(section.key, idx, text)}
                      />
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}