import { useState, useEffect, useRef } from 'react';
import { supabaseStorage } from '@/api/supabaseStorage';
import { getUserPrefix } from '@/lib/userStore';
import { sendOneOffPrompt } from '@/api/claudeClient';

const STORAGE_KEY_SUFFIX = 'dt_humans_v1';
function getStorageKey() { return `${getUserPrefix()}${STORAGE_KEY_SUFFIX}`; }

function loadPeople() {
  try {
    const raw = supabaseStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

function savePeople(people) {
  supabaseStorage.setItem(getStorageKey(), JSON.stringify(people));
}

const RELATIONSHIP_TYPES = ['friend', 'family', 'coworker', 'manager', 'client', 'mentor', 'partner', 'acquaintance'];
const RELATIONSHIP_COLORS = {
  friend: '#3b82f6', family: '#ec4899', coworker: '#f97316', manager: '#ef4444',
  client: '#eab308', mentor: '#8b5cf6', partner: '#e11d48', acquaintance: '#64748b',
};
const INTERACTION_TYPES = ['meeting', 'call', 'text', 'email', 'hangout', 'work', 'other'];
const INTERACTION_ICONS = {
  meeting: '\u{1F91D}', call: '\u{1F4DE}', text: '\u{1F4AC}', email: '\u{1F4E7}',
  hangout: '\u{1F37B}', work: '\u{1F4BC}', other: '\u{1F4CC}',
};
const SENTIMENT_OPTIONS = ['positive', 'neutral', 'negative', 'mixed'];
const MEMORY_CATEGORIES = ['fact', 'preference', 'story', 'opinion', 'important', 'other'];
const TRUST_DIMENSIONS = [
  { key: 'keepWord', label: 'Keeps Word' },
  { key: 'confidentiality', label: 'Confidentiality' },
  { key: 'financialTrust', label: 'Financial Trust' },
  { key: 'emotionalTrust', label: 'Emotional Trust' },
  { key: 'professionalReliability', label: 'Professional Reliability' },
  { key: 'loyalty', label: 'Loyalty' },
  { key: 'consistency', label: 'Consistency' },
  { key: 'boundaryRespect', label: 'Boundary Respect' },
  { key: 'conflictResolution', label: 'Conflict Resolution' },
];
const GOAL_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'quarterly', 'yearly', 'as-needed'];

function genId() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

function daysSince(dateStr) {
  if (!dateStr) return Infinity;
  const d = new Date(dateStr);
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function healthColor(days) {
  if (days <= 14) return '#22c55e';
  if (days <= 45) return '#eab308';
  return '#ef4444';
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatDateShort(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function createEmptyPerson() {
  return {
    id: genId(), name: '', nickname: '', relationship: 'friend',
    company: '', occupation: '', birthday: '', location: '', contact: '', dateFirstMet: '',
    interactions: [], memories: [], traits: [],
    trust: { keepWord: null, confidentiality: null, financialTrust: null, emotionalTrust: null,
             professionalReliability: null, loyalty: null, consistency: null,
             boundaryRespect: null, conflictResolution: null },
    lessons: [], goals: [],
    aiSummary: '', aiEngagementStrategy: '', aiRiskFlags: [],
    aiLastAnalyzed: null, createdAt: Date.now(), updatedAt: Date.now(),
  };
}

// ─── Collapsible Section ────────────────────────────────────────────────────

function Section({ title, count, defaultOpen = true, children }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="hu-section">
      <button className="hu-section-header" onClick={() => setOpen(!open)}>
        <span className="hu-section-title">{title}{count != null ? ` (${count})` : ''}</span>
        <span className="hu-section-chevron">{open ? '\u25B2' : '\u25BC'}</span>
      </button>
      {open && <div className="hu-section-body">{children}</div>}
    </div>
  );
}

// ─── Person Form Modal ──────────────────────────────────────────────────────

function PersonForm({ person, onSave, onCancel }) {
  const [form, setForm] = useState(() => ({
    name: person?.name || '',
    nickname: person?.nickname || '',
    relationship: person?.relationship || 'friend',
    company: person?.company || '',
    occupation: person?.occupation || '',
    birthday: person?.birthday || '',
    location: person?.location || '',
    contact: person?.contact || '',
    dateFirstMet: person?.dateFirstMet || '',
  }));
  const nameRef = useRef(null);
  useEffect(() => { nameRef.current?.focus(); }, []);

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) return;
    onSave(form);
  }

  const f = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  return (
    <div className="hu-modal-overlay" onClick={onCancel}>
      <div className="hu-modal" onClick={e => e.stopPropagation()}>
        <h3 className="hu-modal-title">{person ? 'Edit Person' : 'Add Person'}</h3>
        <form onSubmit={handleSubmit} className="hu-modal-form">
          <div className="hu-modal-row">
            <div className="hu-modal-field">
              <label className="hu-label">Name *</label>
              <input ref={nameRef} className="hu-input" value={form.name} onChange={e => f('name', e.target.value)} placeholder="Full name" />
            </div>
            <div className="hu-modal-field">
              <label className="hu-label">Nickname</label>
              <input className="hu-input" value={form.nickname} onChange={e => f('nickname', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="hu-modal-row">
            <div className="hu-modal-field">
              <label className="hu-label">Relationship</label>
              <select className="hu-select" value={form.relationship} onChange={e => f('relationship', e.target.value)}>
                {RELATIONSHIP_TYPES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </div>
            <div className="hu-modal-field">
              <label className="hu-label">Company</label>
              <input className="hu-input" value={form.company} onChange={e => f('company', e.target.value)} placeholder="Optional" />
            </div>
          </div>
          <div className="hu-modal-row">
            <div className="hu-modal-field">
              <label className="hu-label">Occupation</label>
              <input className="hu-input" value={form.occupation} onChange={e => f('occupation', e.target.value)} placeholder="Optional" />
            </div>
            <div className="hu-modal-field">
              <label className="hu-label">Birthday</label>
              <input className="hu-input" type="date" value={form.birthday} onChange={e => f('birthday', e.target.value)} />
            </div>
          </div>
          <div className="hu-modal-row">
            <div className="hu-modal-field">
              <label className="hu-label">Location</label>
              <input className="hu-input" value={form.location} onChange={e => f('location', e.target.value)} placeholder="City, Country" />
            </div>
            <div className="hu-modal-field">
              <label className="hu-label">Contact</label>
              <input className="hu-input" value={form.contact} onChange={e => f('contact', e.target.value)} placeholder="Phone, email, etc." />
            </div>
          </div>
          <div className="hu-modal-row">
            <div className="hu-modal-field">
              <label className="hu-label">Date First Met</label>
              <input className="hu-input" type="date" value={form.dateFirstMet} onChange={e => f('dateFirstMet', e.target.value)} />
            </div>
          </div>
          <div className="hu-modal-actions">
            <button type="button" className="btn-cancel" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-save">{person ? 'Save Changes' : 'Add Person'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Main Component ─────────────────────────────────────────────────────────

export default function HumansView() {
  const [people, setPeople] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState(null);
  const [search, setSearch] = useState('');
  const [filterRel, setFilterRel] = useState('All');
  const [sortBy, setSortBy] = useState('lastContact');
  const [mobileShowDetail, setMobileShowDetail] = useState(false);

  // Inline form states
  const [interactionForm, setInteractionForm] = useState({ type: 'meeting', title: '', notes: '', sentiment: 'neutral' });
  const [showInteractionForm, setShowInteractionForm] = useState(false);
  const [memoryForm, setMemoryForm] = useState({ text: '', category: 'fact' });
  const [showMemoryForm, setShowMemoryForm] = useState(false);
  const [traitForm, setTraitForm] = useState({ name: '', value: 50 });
  const [showTraitForm, setShowTraitForm] = useState(false);
  const [lessonForm, setLessonForm] = useState('');
  const [showLessonForm, setShowLessonForm] = useState(false);
  const [goalForm, setGoalForm] = useState({ text: '', frequency: 'monthly' });
  const [showGoalForm, setShowGoalForm] = useState(false);
  const [editingTrustKey, setEditingTrustKey] = useState(null);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => { setPeople(loadPeople()); }, []);

  const selected = people.find(p => p.id === selectedId) || null;

  function save(updated) {
    setPeople(updated);
    savePeople(updated);
  }

  function updatePerson(id, changes) {
    const updated = people.map(p => p.id === id ? { ...p, ...changes, updatedAt: Date.now() } : p);
    save(updated);
  }

  // ─── Person CRUD ────────────────────────────────────────────────────────

  function handleAddPerson(formData) {
    const newPerson = { ...createEmptyPerson(), ...formData };
    const updated = [newPerson, ...people];
    save(updated);
    setSelectedId(newPerson.id);
    setShowForm(false);
    setMobileShowDetail(true);
  }

  function handleEditPerson(formData) {
    updatePerson(editingPerson.id, formData);
    setEditingPerson(null);
    setShowForm(false);
  }

  function handleDeletePerson(id) {
    if (!window.confirm('Delete this person and all their data?')) return;
    const updated = people.filter(p => p.id !== id);
    save(updated);
    if (selectedId === id) { setSelectedId(null); setMobileShowDetail(false); }
  }

  // ─── Interactions ───────────────────────────────────────────────────────

  function handleAddInteraction(e) {
    e.preventDefault();
    if (!interactionForm.title.trim()) return;
    const interaction = {
      id: genId(), date: new Date().toISOString().split('T')[0],
      type: interactionForm.type, title: interactionForm.title,
      notes: interactionForm.notes, sentiment: interactionForm.sentiment,
    };
    updatePerson(selectedId, { interactions: [interaction, ...(selected.interactions || [])] });
    setInteractionForm({ type: 'meeting', title: '', notes: '', sentiment: 'neutral' });
    setShowInteractionForm(false);
  }

  function handleDeleteInteraction(intId) {
    updatePerson(selectedId, { interactions: (selected.interactions || []).filter(i => i.id !== intId) });
  }

  // ─── Memories ───────────────────────────────────────────────────────────

  function handleAddMemory(e) {
    e.preventDefault();
    if (!memoryForm.text.trim()) return;
    const memory = { id: genId(), text: memoryForm.text, category: memoryForm.category, date: new Date().toISOString().split('T')[0] };
    updatePerson(selectedId, { memories: [...(selected.memories || []), memory] });
    setMemoryForm({ text: '', category: 'fact' });
    setShowMemoryForm(false);
  }

  function handleDeleteMemory(memId) {
    updatePerson(selectedId, { memories: (selected.memories || []).filter(m => m.id !== memId) });
  }

  // ─── Traits ─────────────────────────────────────────────────────────────

  function handleAddTrait(e) {
    e.preventDefault();
    if (!traitForm.name.trim()) return;
    const trait = { name: traitForm.name, value: Number(traitForm.value), confidence: 'medium', evidence: '', source: 'manual' };
    updatePerson(selectedId, { traits: [...(selected.traits || []), trait] });
    setTraitForm({ name: '', value: 50 });
    setShowTraitForm(false);
  }

  function handleDeleteTrait(traitName) {
    updatePerson(selectedId, { traits: (selected.traits || []).filter(t => t.name !== traitName) });
  }

  // ─── Trust ──────────────────────────────────────────────────────────────

  function handleTrustChange(key, value) {
    updatePerson(selectedId, { trust: { ...(selected.trust || {}), [key]: Number(value) } });
  }

  // ─── Lessons ────────────────────────────────────────────────────────────

  function handleAddLesson(e) {
    e.preventDefault();
    if (!lessonForm.trim()) return;
    const lesson = { id: genId(), date: new Date().toISOString().split('T')[0], text: lessonForm };
    updatePerson(selectedId, { lessons: [...(selected.lessons || []), lesson] });
    setLessonForm('');
    setShowLessonForm(false);
  }

  function handleDeleteLesson(lessonId) {
    updatePerson(selectedId, { lessons: (selected.lessons || []).filter(l => l.id !== lessonId) });
  }

  // ─── Goals ──────────────────────────────────────────────────────────────

  function handleAddGoal(e) {
    e.preventDefault();
    if (!goalForm.text.trim()) return;
    const goal = { id: genId(), text: goalForm.text, frequency: goalForm.frequency, lastDone: null, status: 'active' };
    updatePerson(selectedId, { goals: [...(selected.goals || []), goal] });
    setGoalForm({ text: '', frequency: 'monthly' });
    setShowGoalForm(false);
  }

  function handleGoalDone(goalId) {
    const goals = (selected.goals || []).map(g => g.id === goalId ? { ...g, lastDone: new Date().toISOString().split('T')[0] } : g);
    updatePerson(selectedId, { goals });
  }

  function handleDeleteGoal(goalId) {
    updatePerson(selectedId, { goals: (selected.goals || []).filter(g => g.id !== goalId) });
  }

  function isGoalOverdue(goal) {
    if (!goal.lastDone || goal.status !== 'active') return false;
    const days = daysSince(goal.lastDone);
    const thresholds = { weekly: 9, biweekly: 18, monthly: 38, quarterly: 100, yearly: 380, 'as-needed': Infinity };
    return days > (thresholds[goal.frequency] || Infinity);
  }

  // ─── AI Analysis ────────────────────────────────────────────────────────

  async function handleAiAnalysis() {
    if (!selected) return;
    setAiLoading(true);
    try {
      const recentInteractions = (selected.interactions || []).slice(0, 20);
      const prompt = `You are a relationship intelligence analyst. Analyze the following person data and return ONLY valid JSON.

Person: ${selected.name}
Relationship: ${selected.relationship}
${selected.occupation ? `Occupation: ${selected.occupation}` : ''}
${selected.company ? `Company: ${selected.company}` : ''}

Recent Interactions (last 20):
${recentInteractions.length > 0 ? recentInteractions.map(i => `- [${i.date}] ${i.type}: ${i.title}${i.notes ? ` — ${i.notes}` : ''} (sentiment: ${i.sentiment})`).join('\n') : 'No interactions logged yet.'}

Memories:
${(selected.memories || []).length > 0 ? (selected.memories || []).map(m => `- [${m.category}] ${m.text}`).join('\n') : 'No memories logged yet.'}

Current Traits:
${(selected.traits || []).length > 0 ? (selected.traits || []).map(t => `- ${t.name}: ${t.value}/100 (source: ${t.source})`).join('\n') : 'No traits set yet.'}

Current Trust Scores:
${TRUST_DIMENSIONS.map(d => `- ${d.label}: ${selected.trust?.[d.key] ?? 'not set'}`).join('\n')}

Lessons Learned:
${(selected.lessons || []).length > 0 ? (selected.lessons || []).map(l => `- ${l.text}`).join('\n') : 'No lessons yet.'}

Return ONLY this JSON format:
{
  "behavioralTraits": [{"name": "trait name", "value": 0-100, "confidence": "high/medium/low", "evidence": "brief evidence"}],
  "trustAssessment": {"keepWord": 0-100, "confidentiality": 0-100, "financialTrust": 0-100, "emotionalTrust": 0-100, "professionalReliability": 0-100, "loyalty": 0-100, "consistency": 0-100, "boundaryRespect": 0-100, "conflictResolution": 0-100},
  "relationshipSummary": "2-3 sentence summary of the relationship dynamics",
  "engagementStrategy": "2-3 sentence strategy for maintaining/improving the relationship",
  "riskFlags": [{"flag": "risk description", "evidence": "what indicates this", "confidence": "high/medium/low"}],
  "lessonsFromPatterns": ["lesson 1", "lesson 2"]
}

Only include trust dimensions where you have evidence. Be honest and analytical, not overly positive. If there's insufficient data, say so in the summary and provide fewer traits/flags.`;

      const raw = await sendOneOffPrompt(prompt);
      const cleaned = raw.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '');
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('No JSON in response');

      let result;
      try {
        result = JSON.parse(match[0]);
      } catch {
        const fixed = match[0].replace(/,\s*([}\]])/g, '$1').replace(/'/g, '"');
        result = JSON.parse(fixed);
      }

      // Merge: keep manual traits, replace AI traits
      const manualTraits = (selected.traits || []).filter(t => t.source === 'manual');
      const aiTraits = (result.behavioralTraits || []).map(t => ({ ...t, source: 'ai' }));

      // Merge trust: only overwrite null values or AI can update
      const mergedTrust = { ...(selected.trust || {}) };
      if (result.trustAssessment) {
        for (const [k, v] of Object.entries(result.trustAssessment)) {
          if (mergedTrust[k] == null) mergedTrust[k] = v;
        }
      }

      // AI-generated lessons
      const existingLessonTexts = new Set((selected.lessons || []).map(l => l.text.toLowerCase()));
      const newLessons = (result.lessonsFromPatterns || [])
        .filter(l => !existingLessonTexts.has(l.toLowerCase()))
        .map(text => ({ id: genId(), date: new Date().toISOString().split('T')[0], text }));

      updatePerson(selectedId, {
        traits: [...manualTraits, ...aiTraits],
        trust: mergedTrust,
        aiSummary: result.relationshipSummary || '',
        aiEngagementStrategy: result.engagementStrategy || '',
        aiRiskFlags: result.riskFlags || [],
        aiLastAnalyzed: new Date().toISOString(),
        lessons: [...(selected.lessons || []), ...newLessons],
      });
    } catch (err) {
      console.error('AI analysis error:', err);
      alert('AI analysis failed: ' + err.message);
    } finally {
      setAiLoading(false);
    }
  }

  // ─── Filtering & Sorting ────────────────────────────────────────────────

  const existingRelTypes = [...new Set(people.map(p => p.relationship))].filter(Boolean);

  const filtered = people.filter(p => {
    if (filterRel !== 'All' && p.relationship !== filterRel) return false;
    if (search) {
      const s = search.toLowerCase();
      return (
        p.name.toLowerCase().includes(s) ||
        (p.nickname || '').toLowerCase().includes(s) ||
        (p.company || '').toLowerCase().includes(s) ||
        (p.memories || []).some(m => m.text.toLowerCase().includes(s)) ||
        (p.interactions || []).some(i => i.title.toLowerCase().includes(s) || (i.notes || '').toLowerCase().includes(s))
      );
    }
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'relationship') return (a.relationship || '').localeCompare(b.relationship || '');
    // lastContact
    const aLast = (a.interactions || [])[0]?.date || '';
    const bLast = (b.interactions || [])[0]?.date || '';
    return bLast.localeCompare(aLast);
  });

  function getLastContactDate(person) {
    return (person.interactions || [])[0]?.date || null;
  }

  function selectPerson(id) {
    setSelectedId(id);
    setMobileShowDetail(true);
    // Reset inline forms
    setShowInteractionForm(false);
    setShowMemoryForm(false);
    setShowTraitForm(false);
    setShowLessonForm(false);
    setShowGoalForm(false);
    setEditingTrustKey(null);
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <div className="hu-container">
      {/* Left Panel: People List */}
      <div className={`hu-list-panel ${mobileShowDetail ? 'hu-hide-mobile' : ''}`}>
        <div className="hu-list-header">
          <div>
            <h2 className="hu-title">People</h2>
            <p className="hu-subtitle">{people.length} person{people.length !== 1 ? 's' : ''} tracked</p>
          </div>
          <button className="hu-add-btn" onClick={() => { setEditingPerson(null); setShowForm(true); }}>+ Add Person</button>
        </div>

        {people.length > 0 && (
          <div className="hu-controls">
            <input className="hu-search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search people..." />
            <div className="hu-filters">
              <button className={`hu-filter-chip ${filterRel === 'All' ? 'active' : ''}`} onClick={() => setFilterRel('All')}>All</button>
              {existingRelTypes.map(r => (
                <button
                  key={r}
                  className={`hu-filter-chip ${filterRel === r ? 'active' : ''}`}
                  onClick={() => setFilterRel(filterRel === r ? 'All' : r)}
                  style={filterRel === r ? { background: (RELATIONSHIP_COLORS[r] || '#64748b') + '1a', borderColor: RELATIONSHIP_COLORS[r] || '#64748b', color: RELATIONSHIP_COLORS[r] || '#64748b' } : {}}
                >
                  {r.charAt(0).toUpperCase() + r.slice(1)}
                </button>
              ))}
            </div>
            <select className="hu-sort-select" value={sortBy} onChange={e => setSortBy(e.target.value)}>
              <option value="lastContact">Last Contact</option>
              <option value="name">Name</option>
              <option value="relationship">Relationship</option>
            </select>
          </div>
        )}

        <div className="hu-people-list">
          {sorted.map(person => {
            const lastContact = getLastContactDate(person);
            const days = daysSince(lastContact);
            const relColor = RELATIONSHIP_COLORS[person.relationship] || '#64748b';
            return (
              <div
                key={person.id}
                className={`hu-person-card ${selectedId === person.id ? 'active' : ''}`}
                onClick={() => selectPerson(person.id)}
              >
                <div className="hu-person-card-left">
                  <div className="hu-person-avatar">{person.name.charAt(0).toUpperCase()}</div>
                  <div>
                    <div className="hu-person-name">{person.name}</div>
                    <span className="hu-person-badge" style={{ background: relColor + '1a', color: relColor, borderColor: relColor + '40' }}>
                      {person.relationship}
                    </span>
                  </div>
                </div>
                <div className="hu-person-card-right">
                  <div className="hu-health-dot" style={{ background: healthColor(days) }} title={lastContact ? `Last contact: ${formatDate(lastContact)}` : 'No contact logged'} />
                  {lastContact && <span className="hu-last-contact">{formatDateShort(lastContact)}</span>}
                </div>
              </div>
            );
          })}
        </div>

        {filtered.length === 0 && people.length > 0 && (
          <div className="hu-empty">No people match your search.</div>
        )}

        {people.length === 0 && !showForm && (
          <div className="hu-empty-start">
            <h3>No people tracked yet</h3>
            <p>Start building your relationship intelligence. Track interactions, behavioral patterns, and insights about the people in your life.</p>
          </div>
        )}
      </div>

      {/* Right Panel: Person Detail */}
      <div className={`hu-detail-panel ${!mobileShowDetail ? 'hu-hide-mobile' : ''}`}>
        {selected ? (
          <div className="hu-detail-content">
            {/* Mobile back button */}
            <button className="hu-back-btn" onClick={() => setMobileShowDetail(false)}>&larr; Back</button>

            {/* Header */}
            <div className="hu-detail-header">
              <div className="hu-detail-header-top">
                <div>
                  <h2 className="hu-detail-name">{selected.name}{selected.nickname ? ` "${selected.nickname}"` : ''}</h2>
                  <span className="hu-person-badge" style={{ background: (RELATIONSHIP_COLORS[selected.relationship] || '#64748b') + '1a', color: RELATIONSHIP_COLORS[selected.relationship] || '#64748b', borderColor: (RELATIONSHIP_COLORS[selected.relationship] || '#64748b') + '40' }}>
                    {selected.relationship}
                  </span>
                </div>
                <button className="hu-edit-btn" onClick={() => { setEditingPerson(selected); setShowForm(true); }}>Edit</button>
              </div>
              <div className="hu-stats-row">
                <span className="hu-stat">{(selected.interactions || []).length} interactions</span>
                <span className="hu-stat">{(selected.memories || []).length} memories</span>
                <span className="hu-stat">{(selected.traits || []).length} traits</span>
                {selected.aiLastAnalyzed && <span className="hu-stat">AI: {formatDateShort(selected.aiLastAnalyzed)}</span>}
              </div>
            </div>

            {/* Quick Info */}
            <Section title="Quick Info" defaultOpen={true}>
              <div className="hu-info-grid">
                {selected.company && <div className="hu-info-item"><span className="hu-info-label">Company</span><span>{selected.company}</span></div>}
                {selected.occupation && <div className="hu-info-item"><span className="hu-info-label">Occupation</span><span>{selected.occupation}</span></div>}
                {selected.birthday && <div className="hu-info-item"><span className="hu-info-label">Birthday</span><span>{formatDate(selected.birthday)}</span></div>}
                {selected.location && <div className="hu-info-item"><span className="hu-info-label">Location</span><span>{selected.location}</span></div>}
                {selected.contact && <div className="hu-info-item"><span className="hu-info-label">Contact</span><span>{selected.contact}</span></div>}
                {selected.dateFirstMet && <div className="hu-info-item"><span className="hu-info-label">First Met</span><span>{formatDate(selected.dateFirstMet)}</span></div>}
                {!selected.company && !selected.occupation && !selected.birthday && !selected.location && !selected.contact && !selected.dateFirstMet && (
                  <p className="hu-muted">No info added yet. Click Edit to add details.</p>
                )}
              </div>
            </Section>

            {/* Behavioral Traits */}
            <Section title="Behavioral Traits" count={(selected.traits || []).length}>
              <div className="hu-traits-list">
                {(selected.traits || []).map((trait, i) => (
                  <div key={i} className="hu-trait-row">
                    <div className="hu-trait-info">
                      <span className="hu-trait-name">{trait.name}</span>
                      {trait.source === 'ai' && <span className="hu-trait-ai-badge">AI</span>}
                      <span className="hu-trait-value">{trait.value}%</span>
                    </div>
                    <div className="hu-trait-bar-bg">
                      <div className="hu-trait-bar-fill" style={{ width: `${trait.value}%` }} />
                    </div>
                    {trait.source === 'manual' && (
                      <button className="hu-inline-delete" onClick={() => handleDeleteTrait(trait.name)} title="Remove">&times;</button>
                    )}
                  </div>
                ))}
              </div>
              {showTraitForm ? (
                <form className="hu-inline-form" onSubmit={handleAddTrait}>
                  <input className="hu-input" value={traitForm.name} onChange={e => setTraitForm(f => ({ ...f, name: e.target.value }))} placeholder="Trait name (e.g. Reliability)" />
                  <div className="hu-slider-row">
                    <input type="range" min="0" max="100" value={traitForm.value} onChange={e => setTraitForm(f => ({ ...f, value: e.target.value }))} />
                    <span>{traitForm.value}%</span>
                  </div>
                  <div className="hu-inline-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowTraitForm(false)}>Cancel</button>
                    <button type="submit" className="btn-save">Add</button>
                  </div>
                </form>
              ) : (
                <div className="hu-inline-add-row">
                  <button className="hu-inline-add-btn" onClick={() => setShowTraitForm(true)}>+ Add Trait</button>
                  <button className="hu-ai-btn" onClick={handleAiAnalysis} disabled={aiLoading}>
                    {aiLoading ? 'Analyzing...' : 'AI Analyze'}
                  </button>
                </div>
              )}
            </Section>

            {/* Trust Dashboard */}
            <Section title="Trust Dashboard">
              <div className="hu-trust-grid">
                {TRUST_DIMENSIONS.map(dim => {
                  const val = selected.trust?.[dim.key];
                  const isEditing = editingTrustKey === dim.key;
                  return (
                    <div key={dim.key} className="hu-trust-card" onClick={() => setEditingTrustKey(isEditing ? null : dim.key)}>
                      <span className="hu-trust-label">{dim.label}</span>
                      {isEditing ? (
                        <div className="hu-trust-edit" onClick={e => e.stopPropagation()}>
                          <input type="range" min="0" max="100" value={val ?? 50} onChange={e => handleTrustChange(dim.key, e.target.value)} />
                          <span className="hu-trust-val">{val ?? 50}</span>
                        </div>
                      ) : (
                        <div className="hu-trust-display">
                          {val != null ? (
                            <>
                              <div className="hu-trust-bar-bg"><div className="hu-trust-bar-fill" style={{ width: `${val}%`, background: val >= 70 ? '#22c55e' : val >= 40 ? '#eab308' : '#ef4444' }} /></div>
                              <span className="hu-trust-val">{val}</span>
                            </>
                          ) : (
                            <span className="hu-muted">Not set</span>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </Section>

            {/* Interaction Timeline */}
            <Section title="Interactions" count={(selected.interactions || []).length}>
              {showInteractionForm ? (
                <form className="hu-inline-form" onSubmit={handleAddInteraction}>
                  <div className="hu-modal-row">
                    <select className="hu-select" value={interactionForm.type} onChange={e => setInteractionForm(f => ({ ...f, type: e.target.value }))}>
                      {INTERACTION_TYPES.map(t => <option key={t} value={t}>{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                    </select>
                    <select className="hu-select" value={interactionForm.sentiment} onChange={e => setInteractionForm(f => ({ ...f, sentiment: e.target.value }))}>
                      {SENTIMENT_OPTIONS.map(s => <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                    </select>
                  </div>
                  <input className="hu-input" value={interactionForm.title} onChange={e => setInteractionForm(f => ({ ...f, title: e.target.value }))} placeholder="What happened?" />
                  <textarea className="hu-input hu-textarea" value={interactionForm.notes} onChange={e => setInteractionForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" rows={2} />
                  <div className="hu-inline-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowInteractionForm(false)}>Cancel</button>
                    <button type="submit" className="btn-save">Log</button>
                  </div>
                </form>
              ) : (
                <button className="hu-inline-add-btn" onClick={() => setShowInteractionForm(true)}>+ Log Interaction</button>
              )}
              <div className="hu-timeline">
                {(selected.interactions || []).map(int => (
                  <div key={int.id} className="hu-timeline-item">
                    <span className="hu-timeline-icon">{INTERACTION_ICONS[int.type] || '\u{1F4CC}'}</span>
                    <div className="hu-timeline-content">
                      <div className="hu-timeline-top">
                        <span className="hu-timeline-title">{int.title}</span>
                        <span className={`hu-sentiment hu-sentiment-${int.sentiment}`}>{int.sentiment}</span>
                      </div>
                      {int.notes && <p className="hu-timeline-notes">{int.notes}</p>}
                      <span className="hu-timeline-date">{formatDate(int.date)}</span>
                    </div>
                    <button className="hu-inline-delete" onClick={() => handleDeleteInteraction(int.id)}>&times;</button>
                  </div>
                ))}
                {(selected.interactions || []).length === 0 && <p className="hu-muted">No interactions logged yet.</p>}
              </div>
            </Section>

            {/* Memories */}
            <Section title="Memories" count={(selected.memories || []).length}>
              {showMemoryForm ? (
                <form className="hu-inline-form" onSubmit={handleAddMemory}>
                  <textarea className="hu-input hu-textarea" value={memoryForm.text} onChange={e => setMemoryForm(f => ({ ...f, text: e.target.value }))} placeholder="Something you want to remember about this person..." rows={2} />
                  <select className="hu-select" value={memoryForm.category} onChange={e => setMemoryForm(f => ({ ...f, category: e.target.value }))}>
                    {MEMORY_CATEGORIES.map(c => <option key={c} value={c}>{c.charAt(0).toUpperCase() + c.slice(1)}</option>)}
                  </select>
                  <div className="hu-inline-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowMemoryForm(false)}>Cancel</button>
                    <button type="submit" className="btn-save">Add</button>
                  </div>
                </form>
              ) : (
                <button className="hu-inline-add-btn" onClick={() => setShowMemoryForm(true)}>+ Add Memory</button>
              )}
              <div className="hu-memories-grid">
                {(selected.memories || []).map(mem => (
                  <div key={mem.id} className="hu-memory-card">
                    <span className="hu-memory-category">{mem.category}</span>
                    <p className="hu-memory-text">{mem.text}</p>
                    <span className="hu-memory-date">{formatDateShort(mem.date)}</span>
                    <button className="hu-inline-delete hu-memory-delete" onClick={() => handleDeleteMemory(mem.id)}>&times;</button>
                  </div>
                ))}
              </div>
              {(selected.memories || []).length === 0 && !showMemoryForm && <p className="hu-muted">No memories added yet.</p>}
            </Section>

            {/* Lessons */}
            <Section title="Lessons Learned" count={(selected.lessons || []).length}>
              {showLessonForm ? (
                <form className="hu-inline-form" onSubmit={handleAddLesson}>
                  <textarea className="hu-input hu-textarea" value={lessonForm} onChange={e => setLessonForm(e.target.value)} placeholder="What have you learned from this relationship?" rows={2} />
                  <div className="hu-inline-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowLessonForm(false)}>Cancel</button>
                    <button type="submit" className="btn-save">Add</button>
                  </div>
                </form>
              ) : (
                <button className="hu-inline-add-btn" onClick={() => setShowLessonForm(true)}>+ Add Lesson</button>
              )}
              <div className="hu-lessons-list">
                {(selected.lessons || []).map(lesson => (
                  <div key={lesson.id} className="hu-lesson-item">
                    <span className="hu-lesson-text">{lesson.text}</span>
                    <span className="hu-lesson-date">{formatDateShort(lesson.date)}</span>
                    <button className="hu-inline-delete" onClick={() => handleDeleteLesson(lesson.id)}>&times;</button>
                  </div>
                ))}
              </div>
              {(selected.lessons || []).length === 0 && !showLessonForm && <p className="hu-muted">No lessons yet.</p>}
            </Section>

            {/* Goals */}
            <Section title="Relationship Goals" count={(selected.goals || []).length}>
              {showGoalForm ? (
                <form className="hu-inline-form" onSubmit={handleAddGoal}>
                  <input className="hu-input" value={goalForm.text} onChange={e => setGoalForm(f => ({ ...f, text: e.target.value }))} placeholder="Goal (e.g. Catch up over coffee)" />
                  <select className="hu-select" value={goalForm.frequency} onChange={e => setGoalForm(f => ({ ...f, frequency: e.target.value }))}>
                    {GOAL_FREQUENCIES.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                  </select>
                  <div className="hu-inline-actions">
                    <button type="button" className="btn-cancel" onClick={() => setShowGoalForm(false)}>Cancel</button>
                    <button type="submit" className="btn-save">Add</button>
                  </div>
                </form>
              ) : (
                <button className="hu-inline-add-btn" onClick={() => setShowGoalForm(true)}>+ Add Goal</button>
              )}
              <div className="hu-goals-grid">
                {(selected.goals || []).map(goal => {
                  const overdue = isGoalOverdue(goal);
                  return (
                    <div key={goal.id} className={`hu-goal-card ${overdue ? 'hu-goal-overdue' : ''}`}>
                      <div className="hu-goal-top">
                        <span className="hu-goal-text">{goal.text}</span>
                        <span className="hu-goal-freq">{goal.frequency}</span>
                      </div>
                      {goal.lastDone && <span className="hu-goal-last">Last: {formatDateShort(goal.lastDone)}</span>}
                      {overdue && <span className="hu-goal-overdue-tag">Overdue</span>}
                      <div className="hu-goal-actions">
                        <button className="hu-goal-done-btn" onClick={() => handleGoalDone(goal.id)}>Mark Done</button>
                        <button className="hu-inline-delete" onClick={() => handleDeleteGoal(goal.id)}>&times;</button>
                      </div>
                    </div>
                  );
                })}
              </div>
              {(selected.goals || []).length === 0 && !showGoalForm && <p className="hu-muted">No goals set yet.</p>}
            </Section>

            {/* AI Analysis */}
            <Section title="AI Analysis" defaultOpen={!!selected.aiSummary}>
              {selected.aiSummary && (
                <div className="hu-ai-section">
                  <div className="hu-ai-block">
                    <h4 className="hu-ai-block-title">Relationship Summary</h4>
                    <p>{selected.aiSummary}</p>
                  </div>
                  {selected.aiEngagementStrategy && (
                    <div className="hu-ai-block">
                      <h4 className="hu-ai-block-title">Engagement Strategy</h4>
                      <p>{selected.aiEngagementStrategy}</p>
                    </div>
                  )}
                  {(selected.aiRiskFlags || []).length > 0 && (
                    <div className="hu-ai-block">
                      <h4 className="hu-ai-block-title">Risk Flags</h4>
                      {selected.aiRiskFlags.map((rf, i) => (
                        <div key={i} className={`hu-risk-flag hu-risk-${rf.confidence}`}>
                          <span className="hu-risk-flag-text">{rf.flag}</span>
                          <span className="hu-risk-evidence">{rf.evidence}</span>
                          <span className="hu-risk-confidence">{rf.confidence} confidence</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {selected.aiLastAnalyzed && (
                    <p className="hu-muted" style={{ marginTop: 8, fontSize: 11 }}>Last analyzed: {formatDate(selected.aiLastAnalyzed)}</p>
                  )}
                </div>
              )}
              {!selected.aiSummary && (
                <p className="hu-muted">No AI analysis yet. Add some interactions and memories, then click "AI Analyze" in the Traits section.</p>
              )}
            </Section>

            {/* Delete Person */}
            <div className="hu-danger-zone">
              <button className="hu-delete-person-btn" onClick={() => handleDeletePerson(selected.id)}>Delete {selected.name}</button>
            </div>
          </div>
        ) : (
          <div className="hu-no-selection">
            <h3>Select a person</h3>
            <p>Choose someone from the list or add a new person to get started.</p>
          </div>
        )}
      </div>

      {/* Modal */}
      {showForm && (
        <PersonForm
          person={editingPerson}
          onSave={editingPerson ? handleEditPerson : handleAddPerson}
          onCancel={() => { setShowForm(false); setEditingPerson(null); }}
        />
      )}
    </div>
  );
}
