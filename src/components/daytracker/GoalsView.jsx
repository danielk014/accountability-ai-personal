import { useState, useEffect, useRef } from 'react';
import { loadChapters, saveChapters } from './storage';

// ── Helpers ─────────────────────────────────────────────────────────────────
function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }

function daysSince(dateStr) {
  if (!dateStr) return 0;
  return Math.max(0, Math.round((new Date() - new Date(dateStr)) / 86400000));
}

function durationLabel(days) {
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  return rem > 0 ? `${years}y ${rem}mo` : `${years}y`;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

function yearRange(startDate, closedDate) {
  if (!startDate) return '';
  const s = new Date(startDate).getFullYear();
  const e = closedDate ? new Date(closedDate).getFullYear() : 'now';
  return s === e ? `${s}` : `${s}\u2013${e}`;
}

// ── Migration ───────────────────────────────────────────────────────────────
function migrateChapter(ch) {
  return {
    targetEndDate: null,
    mainOutcome: null,
    priorities: null,
    whyItMatters: null,
    goals: [],
    ...ch,
    conditions: (ch.conditions || []).map(c => ({
      text: c.text || '',
      done: !!c.done,
    })),
  };
}

// ── Demo data ───────────────────────────────────────────────────────────────
const DEMO_CHAPTERS = [
  {
    id: genId(), order: 0,
    name: 'Monetize a skill',
    purpose: 'Pick one marketable skill and turn it into income. Doesn\'t matter how much \u2014 the point is proving I can get paid for what I know.',
    mainOutcome: 'Generate consistent income from a skill I own.',
    whyItMatters: 'Without this proof, everything else stays theoretical.',
    priorities: null,
    targetEndDate: '2025-03-15',
    startDate: '2024-01-01', closedDate: '2025-03-15', status: 'closed',
    goals: [],
    conditions: [
      { text: 'Landed first paying client', done: true },
      { text: 'Repeated income 3 months in a row', done: true },
      { text: 'Can explain what I sell in one sentence', done: true },
    ],
  },
  {
    id: genId(), order: 1,
    name: 'Build financial stability',
    purpose: 'Cut lifestyle costs to the bone so every euro earned goes to runway. Freedom comes from needing less, not earning more \u2014 for now.',
    mainOutcome: '6+ months of runway with low monthly burn.',
    whyItMatters: 'Runway is freedom. No runway means forced decisions.',
    priorities: 'Track every expense. Automate savings. Resist lifestyle creep after income spikes.',
    targetEndDate: '2025-12-31',
    startDate: '2025-03-16', closedDate: null, status: 'active',
    goals: [
      { id: genId(), title: 'Reduce monthly burn to under \u20ac1,500', progress: 80, targetDate: '2025-06-30', status: 'active', nextAction: 'Audit subscriptions this week', relatedProject: null, order: 0 },
      { id: genId(), title: 'Save 6 months runway', progress: 40, targetDate: '2025-12-31', status: 'active', nextAction: 'Set up automatic transfer', relatedProject: null, order: 1 },
      { id: genId(), title: 'Build emergency fund', progress: 60, targetDate: '2025-09-30', status: 'active', nextAction: 'Move savings to separate account', relatedProject: null, order: 2 },
    ],
    conditions: [
      { text: 'Monthly burn under \u20ac1,500 for 3 consecutive months', done: true },
      { text: '6 months of runway saved', done: false },
      { text: 'No lifestyle creep after an income spike', done: false },
    ],
  },
  {
    id: genId(), order: 2,
    name: 'Acquire a high-paying skill',
    purpose: 'Go deep on one skill that commands premium rates. Volume of focused practice, not breadth.',
    mainOutcome: 'Earn 2x my starting rate from deliberate skill investment.',
    whyItMatters: 'Leverage comes from being exceptionally good at one thing.',
    priorities: null,
    targetEndDate: null,
    startDate: null, closedDate: null, status: 'future',
    goals: [],
    conditions: [
      { text: '1,000 hours of deliberate practice logged', done: false },
      { text: 'Earning 2x my starting rate', done: false },
      { text: 'Recognized by peers (referrals, testimonials)', done: false },
    ],
  },
  {
    id: genId(), order: 3,
    name: 'Become an experienced operator',
    purpose: 'Run a real operation \u2014 team, clients, systems. Not just a freelancer with a laptop.',
    mainOutcome: 'Revenue from systems, not just personal hours.',
    whyItMatters: 'Operating experience is the bridge between skill and scale.',
    priorities: null,
    targetEndDate: null,
    startDate: null, closedDate: null, status: 'future',
    goals: [],
    conditions: [
      { text: 'Managing at least 2 people', done: false },
      { text: 'Revenue from systems, not just my hours', done: false },
      { text: 'Can step away for 2 weeks without things breaking', done: false },
    ],
  },
  {
    id: genId(), order: 4,
    name: 'Acquire or build a cash-flowing asset',
    purpose: 'Own something that generates income independently. A product, a business, an asset \u2014 not just trading time.',
    mainOutcome: 'Passive or semi-passive income from an owned asset.',
    whyItMatters: 'This is the endgame \u2014 income that doesn\'t require my daily presence.',
    priorities: null,
    targetEndDate: null,
    startDate: null, closedDate: null, status: 'future',
    goals: [],
    conditions: [
      { text: 'Own or co-own a revenue-generating asset', done: false },
      { text: 'Asset produces income for 3+ months without daily work', done: false },
      { text: 'Clear path to scaling or replicating', done: false },
    ],
  },
];

// ── Main component ──────────────────────────────────────────────────────────
function GoalsView() {
  const [chapters, setChapters] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [viewMode, setViewMode] = useState('chapters'); // 'chapters' | 'roadmap'
  const [showManage, setShowManage] = useState(false);
  const [editModal, setEditModal] = useState(null); // chapter object being edited
  const [closePrompt, setClosePrompt] = useState(null);

  useEffect(() => {
    let loaded = loadChapters();
    if (!loaded || loaded.length === 0) {
      loaded = DEMO_CHAPTERS;
      saveChapters(loaded);
    }
    const migrated = loaded.map(migrateChapter);
    // Save if migration added new fields
    if (JSON.stringify(migrated) !== JSON.stringify(loaded)) {
      saveChapters(migrated);
    }
    setChapters(migrated);
    // Select active chapter by default
    const active = migrated.find(c => c.status === 'active');
    if (active) setSelectedId(active.id);
    else if (migrated.length > 0) setSelectedId(migrated[0].id);
  }, []);

  useEffect(() => {
    function handleRefresh() {
      const loaded = loadChapters();
      if (loaded) {
        const migrated = loaded.map(migrateChapter);
        setChapters(migrated);
      }
    }
    window.addEventListener('daytracker-data-refreshed', handleRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleRefresh);
  }, []);

  function save(next) { setChapters(next); saveChapters(next); }

  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const selectedIdx = sorted.findIndex(c => c.id === selectedId);
  const selected = selectedIdx >= 0 ? sorted[selectedIdx] : null;

  function navigateTo(dir) {
    const newIdx = selectedIdx + dir;
    if (newIdx >= 0 && newIdx < sorted.length) {
      setSelectedId(sorted[newIdx].id);
    }
  }

  function toggleCondition(chapterId, condIndex) {
    save(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      const conds = ch.conditions.map((c, i) => i === condIndex ? { ...c, done: !c.done } : c);
      return { ...ch, conditions: conds };
    }));
  }

  function closeChapter(chapterId, nextChapterId) {
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx < 0) return;
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], status: 'closed', closedDate: todayStr() };
    if (nextChapterId) {
      const ni = updated.findIndex(c => c.id === nextChapterId);
      if (ni >= 0) {
        updated[ni] = { ...updated[ni], status: 'active', startDate: todayStr() };
        setSelectedId(nextChapterId);
      }
    }
    save(updated);
    setClosePrompt(null);
  }

  function saveEditModal(updatedChapter) {
    save(chapters.map(c => c.id === updatedChapter.id ? updatedChapter : c));
    setEditModal(null);
  }

  // Goal management
  function updateGoal(chapterId, goalId, updates) {
    save(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      return { ...ch, goals: (ch.goals || []).map(g => g.id === goalId ? { ...g, ...updates } : g) };
    }));
  }

  function addGoal(chapterId, title) {
    save(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      const goals = ch.goals || [];
      const maxOrder = goals.length > 0 ? Math.max(...goals.map(g => g.order)) : -1;
      return {
        ...ch,
        goals: [...goals, {
          id: genId(), title, progress: 0, targetDate: null,
          status: 'active', nextAction: '', relatedProject: null,
          order: maxOrder + 1,
        }],
      };
    }));
  }

  function removeGoal(chapterId, goalId) {
    save(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      return { ...ch, goals: (ch.goals || []).filter(g => g.id !== goalId) };
    }));
  }

  return (
    <div className="ch-root">
      {/* Header */}
      <div className="ch-header">
        <span className="ch-title">Chapters</span>
        <div className="ch-header-actions">
          <button
            className={`ch-view-toggle ${viewMode === 'chapters' ? 'ch-view-toggle-active' : ''}`}
            onClick={() => setViewMode('chapters')}
          >Timeline</button>
          <button
            className={`ch-view-toggle ${viewMode === 'roadmap' ? 'ch-view-toggle-active' : ''}`}
            onClick={() => setViewMode('roadmap')}
          >Roadmap</button>
          <button className="ch-manage-btn" onClick={() => setShowManage(!showManage)}>
            {showManage ? 'Done' : 'Edit'}
          </button>
        </div>
      </div>

      {viewMode === 'chapters' ? (
        <>
          {/* Navigation */}
          <ChapterNavigation
            current={selectedIdx}
            total={sorted.length}
            onPrev={() => navigateTo(-1)}
            onNext={() => navigateTo(1)}
          />

          {/* Timeline + Card layout */}
          <div className="ch-layout">
            {/* Timeline sidebar */}
            <ChapterTimeline
              chapters={sorted}
              selectedId={selectedId}
              onSelect={setSelectedId}
            />

            {/* Card */}
            {selected && (
              <ChapterCard
                key={selected.id}
                chapter={selected}
                index={selectedIdx}
                total={sorted.length}
                onToggleCondition={(ci) => toggleCondition(selected.id, ci)}
                onEdit={() => setEditModal({ ...selected })}
                onClose={() => setClosePrompt(selected.id)}
                onUpdateGoal={(goalId, updates) => updateGoal(selected.id, goalId, updates)}
                onAddGoal={(title) => addGoal(selected.id, title)}
                onRemoveGoal={(goalId) => removeGoal(selected.id, goalId)}
              />
            )}
          </div>
        </>
      ) : (
        <RoadmapView
          chapters={sorted}
          onSelectChapter={(id) => { setSelectedId(id); setViewMode('chapters'); }}
        />
      )}

      {/* Edit Modal */}
      {editModal && (
        <EditModal
          chapter={editModal}
          onSave={saveEditModal}
          onClose={() => setEditModal(null)}
        />
      )}

      {/* Close Chapter Modal */}
      {closePrompt && (() => {
        const ch = chapters.find(c => c.id === closePrompt);
        const futureChapters = sorted.filter(c => c.status === 'future');
        return (
          <CloseChapterModal
            chapter={ch}
            futureChapters={futureChapters}
            onClose={() => setClosePrompt(null)}
            onConfirm={(nextId) => closeChapter(closePrompt, nextId)}
          />
        );
      })()}

      {/* Manage panel */}
      {showManage && (
        <ManagePanel chapters={sorted} onSave={save} />
      )}
    </div>
  );
}

// ── ChapterNavigation ───────────────────────────────────────────────────────
function ChapterNavigation({ current, total, onPrev, onNext }) {
  return (
    <div className="ch-nav">
      <button className="ch-nav-btn" onClick={onPrev} disabled={current <= 0}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
      <span className="ch-nav-label">Chapter {current + 1} of {total}</span>
      <button className="ch-nav-btn" onClick={onNext} disabled={current >= total - 1}>
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M6 4l4 4-4 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
      </button>
    </div>
  );
}

// ── ChapterTimeline ─────────────────────────────────────────────────────────
function ChapterTimeline({ chapters, selectedId, onSelect }) {
  return (
    <div className="ch-timeline">
      {chapters.map((ch, i) => {
        const isClosed = ch.status === 'closed';
        const isActive = ch.status === 'active';
        const isSelected = ch.id === selectedId;
        const isLast = i === chapters.length - 1;

        return (
          <div key={ch.id} className="ch-tl-item">
            <button
              className={`ch-tl-node ${isClosed ? 'ch-tl-done' : isActive ? 'ch-tl-active' : 'ch-tl-future'} ${isSelected ? 'ch-tl-selected' : ''}`}
              onClick={() => onSelect(ch.id)}
              title={ch.name}
            >
              {isClosed && <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2.5 6l2.5 2.5 5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
              {isActive && <span className="ch-tl-pulse" />}
            </button>
            {!isLast && (
              <div className={`ch-tl-line ${isClosed ? 'ch-tl-line-done' : 'ch-tl-line-future'}`} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ChapterCard ─────────────────────────────────────────────────────────────
function ChapterCard({ chapter, index, total, onToggleCondition, onEdit, onClose, onUpdateGoal, onAddGoal, onRemoveGoal }) {
  const ch = chapter;
  const isActive = ch.status === 'active';
  const isClosed = ch.status === 'closed';
  const doneCount = ch.conditions.filter(c => c.done).length;
  const totalCount = ch.conditions.length;
  const allDone = totalCount > 0 && doneCount === totalCount;
  const progressPct = totalCount > 0 ? Math.round((doneCount / totalCount) * 100) : 0;
  const elapsed = isActive ? daysSince(ch.startDate) : (isClosed && ch.startDate ? daysSince(ch.startDate) - daysSince(ch.closedDate) : 0);
  const elapsedFromStart = ch.startDate ? daysSince(ch.startDate) : 0;

  return (
    <div className="ch-card ch-card-enter">
      {/* Card header */}
      <div className="ch-card-header">
        <div className="ch-card-title-row">
          <h2 className="ch-card-name">{ch.name}</h2>
          <span className={`ch-badge ch-badge-${ch.status}`}>
            {ch.status === 'active' ? 'Active' : ch.status === 'closed' ? 'Completed' : 'Upcoming'}
          </span>
        </div>
        <div className="ch-card-meta">
          {ch.startDate && (
            <span className="ch-card-dates">
              {formatDate(ch.startDate)}{ch.closedDate ? ` \u2013 ${formatDate(ch.closedDate)}` : ' \u2013 present'}
            </span>
          )}
          {isActive && ch.startDate && (
            <span className="ch-card-elapsed">{durationLabel(elapsedFromStart)} in</span>
          )}
          {isClosed && ch.startDate && (
            <span className="ch-card-elapsed">{durationLabel(elapsed)} total</span>
          )}
          {!ch.startDate && <span className="ch-card-dates">Not started yet</span>}
        </div>
      </div>

      {/* Description */}
      {ch.purpose && <p className="ch-card-purpose">{ch.purpose}</p>}

      {/* Main outcome */}
      {ch.mainOutcome && (
        <div className="ch-card-field">
          <span className="ch-card-field-label">Primary Outcome</span>
          <p className="ch-card-field-text">{ch.mainOutcome}</p>
        </div>
      )}

      {/* Why it matters */}
      {ch.whyItMatters && (
        <div className="ch-card-field">
          <span className="ch-card-field-label">Why It Matters</span>
          <p className="ch-card-field-text">{ch.whyItMatters}</p>
        </div>
      )}

      {/* Exit Criteria */}
      {ch.conditions.length > 0 && (
        <div className="ch-card-section">
          <div className="ch-card-section-header">
            <span className="ch-card-section-label">Exit Criteria</span>
            <span className="ch-card-section-count">{doneCount}/{totalCount}</span>
          </div>
          <div className="ch-progress-bar-track">
            <div className="ch-progress-bar-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="ch-conditions">
            {ch.conditions.map((cond, ci) => (
              <label key={ci} className="ch-condition">
                <input
                  type="checkbox"
                  checked={cond.done}
                  onChange={() => onToggleCondition(ci)}
                  disabled={isClosed}
                />
                <span className={cond.done ? 'ch-cond-done' : ''}>{cond.text}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Priorities */}
      {ch.priorities && (
        <div className="ch-card-field">
          <span className="ch-card-field-label">Current Priorities</span>
          <p className="ch-card-field-text">{ch.priorities}</p>
        </div>
      )}

      {/* Goals (active chapter only) */}
      {isActive && (
        <GoalsSection
          goals={ch.goals || []}
          chapterId={ch.id}
          onUpdate={onUpdateGoal}
          onAdd={onAddGoal}
          onRemove={onRemoveGoal}
        />
      )}

      {/* Actions */}
      <div className="ch-card-actions">
        <button className="ch-card-edit-btn" onClick={onEdit}>Edit Chapter</button>
        {isActive && allDone && (
          <button className="ch-card-close-btn" onClick={onClose}>
            Close & Move Forward
          </button>
        )}
      </div>
    </div>
  );
}

// ── GoalsSection ────────────────────────────────────────────────────────────
function GoalsSection({ goals, chapterId, onUpdate, onAdd, onRemove }) {
  const [addingGoal, setAddingGoal] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [editingGoalId, setEditingGoalId] = useState(null);
  const addRef = useRef(null);

  useEffect(() => { if (addingGoal && addRef.current) addRef.current.focus(); }, [addingGoal]);

  const sorted = [...goals].sort((a, b) => a.order - b.order);
  const activeGoals = sorted.filter(g => g.status === 'active');
  const completedGoals = sorted.filter(g => g.status === 'completed');

  function handleAdd() {
    if (!newTitle.trim()) return;
    onAdd(newTitle.trim());
    setNewTitle('');
    setAddingGoal(false);
  }

  return (
    <div className="ch-card-section">
      <div className="ch-card-section-header">
        <span className="ch-card-section-label">Goals</span>
        <span className="ch-card-section-count">{completedGoals.length}/{goals.length}</span>
      </div>

      {activeGoals.length === 0 && completedGoals.length === 0 && !addingGoal && (
        <p className="ch-goals-empty">No goals yet. Add one to track your progress.</p>
      )}

      {activeGoals.map(goal => (
        <GoalItem
          key={goal.id}
          goal={goal}
          isEditing={editingGoalId === goal.id}
          onStartEdit={() => setEditingGoalId(goal.id)}
          onStopEdit={() => setEditingGoalId(null)}
          onUpdate={(updates) => onUpdate(goal.id, updates)}
          onRemove={() => onRemove(goal.id)}
        />
      ))}

      {completedGoals.length > 0 && (
        <div className="ch-goals-completed-group">
          <span className="ch-goals-completed-label">Completed ({completedGoals.length})</span>
          {completedGoals.map(goal => (
            <GoalItem
              key={goal.id}
              goal={goal}
              isEditing={editingGoalId === goal.id}
              onStartEdit={() => setEditingGoalId(goal.id)}
              onStopEdit={() => setEditingGoalId(null)}
              onUpdate={(updates) => onUpdate(goal.id, updates)}
              onRemove={() => onRemove(goal.id)}
            />
          ))}
        </div>
      )}

      {addingGoal ? (
        <div className="ch-goal-add-form">
          <input
            ref={addRef}
            className="ch-goal-add-input"
            value={newTitle}
            onChange={e => setNewTitle(e.target.value)}
            placeholder="Goal title..."
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); if (e.key === 'Escape') setAddingGoal(false); }}
          />
          <div className="ch-goal-add-actions">
            <button onClick={handleAdd} className="ch-goal-add-save" disabled={!newTitle.trim()}>Add</button>
            <button onClick={() => { setAddingGoal(false); setNewTitle(''); }} className="ch-goal-add-cancel">Cancel</button>
          </div>
        </div>
      ) : (
        <button className="ch-goal-add-btn" onClick={() => setAddingGoal(true)}>+ Add goal</button>
      )}
    </div>
  );
}

// ── GoalItem ────────────────────────────────────────────────────────────────
function GoalItem({ goal, isEditing, onStartEdit, onStopEdit, onUpdate, onRemove }) {
  const [editTitle, setEditTitle] = useState(goal.title);
  const [editProgress, setEditProgress] = useState(goal.progress);
  const [editNextAction, setEditNextAction] = useState(goal.nextAction || '');
  const isCompleted = goal.status === 'completed';

  function saveEdit() {
    onUpdate({
      title: editTitle.trim() || goal.title,
      progress: editProgress,
      nextAction: editNextAction.trim(),
    });
    onStopEdit();
  }

  function toggleComplete() {
    if (isCompleted) {
      onUpdate({ status: 'active', progress: goal.progress });
    } else {
      onUpdate({ status: 'completed', progress: 100 });
    }
  }

  if (isEditing) {
    return (
      <div className="ch-goal-item ch-goal-editing">
        <input
          className="ch-goal-edit-input"
          value={editTitle}
          onChange={e => setEditTitle(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') onStopEdit(); }}
        />
        <div className="ch-goal-progress-edit">
          <label className="ch-goal-progress-label">Progress: {editProgress}%</label>
          <input
            type="range"
            min="0" max="100" step="5"
            value={editProgress}
            onChange={e => setEditProgress(Number(e.target.value))}
            className="ch-goal-slider"
          />
        </div>
        <input
          className="ch-goal-edit-input"
          value={editNextAction}
          onChange={e => setEditNextAction(e.target.value)}
          placeholder="Next action..."
        />
        <div className="ch-goal-edit-actions">
          <button onClick={saveEdit} className="ch-goal-edit-save">Save</button>
          <button onClick={onStopEdit} className="ch-goal-edit-cancel">Cancel</button>
          <button onClick={onRemove} className="ch-goal-edit-delete">Delete</button>
        </div>
      </div>
    );
  }

  return (
    <div className={`ch-goal-item ${isCompleted ? 'ch-goal-completed' : ''}`} onClick={onStartEdit}>
      <div className="ch-goal-top">
        <button className={`ch-goal-check ${isCompleted ? 'ch-goal-check-done' : ''}`} onClick={e => { e.stopPropagation(); toggleComplete(); }}>
          {isCompleted && <svg width="10" height="10" viewBox="0 0 10 10" fill="none"><path d="M2 5l2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>}
        </button>
        <span className={`ch-goal-title ${isCompleted ? 'ch-goal-title-done' : ''}`}>{goal.title}</span>
      </div>
      {!isCompleted && goal.progress > 0 && (
        <div className="ch-goal-bar-track">
          <div className="ch-goal-bar-fill" style={{ width: `${goal.progress}%` }} />
        </div>
      )}
      {!isCompleted && goal.nextAction && (
        <span className="ch-goal-next">Next: {goal.nextAction}</span>
      )}
    </div>
  );
}

// ── EditModal ───────────────────────────────────────────────────────────────
function EditModal({ chapter, onSave, onClose }) {
  const [name, setName] = useState(chapter.name);
  const [purpose, setPurpose] = useState(chapter.purpose || '');
  const [mainOutcome, setMainOutcome] = useState(chapter.mainOutcome || '');
  const [whyItMatters, setWhyItMatters] = useState(chapter.whyItMatters || '');
  const [priorities, setPriorities] = useState(chapter.priorities || '');
  const [targetEndDate, setTargetEndDate] = useState(chapter.targetEndDate || '');
  const [startDate, setStartDate] = useState(chapter.startDate || '');
  const [conditions, setConditions] = useState(
    chapter.conditions.length > 0 ? chapter.conditions.map(c => ({ ...c })) : [{ text: '', done: false }]
  );

  function handleSave() {
    if (!name.trim()) return;
    const validConds = conditions.filter(c => c.text.trim());
    onSave({
      ...chapter,
      name: name.trim(),
      purpose: purpose.trim() || null,
      mainOutcome: mainOutcome.trim() || null,
      whyItMatters: whyItMatters.trim() || null,
      priorities: priorities.trim() || null,
      targetEndDate: targetEndDate || null,
      startDate: startDate || null,
      conditions: validConds.length > 0 ? validConds : [{ text: 'Define conditions', done: false }],
    });
  }

  function addCondition() {
    if (conditions.length < 8) setConditions([...conditions, { text: '', done: false }]);
  }

  function removeCondition(i) {
    if (conditions.length > 1) setConditions(conditions.filter((_, j) => j !== i));
  }

  function updateCondition(i, text) {
    setConditions(conditions.map((c, j) => j === i ? { ...c, text } : c));
  }

  return (
    <div className="ch-modal-overlay" onClick={onClose}>
      <div className="ch-edit-modal" onClick={e => e.stopPropagation()}>
        <div className="ch-edit-modal-header">
          <h3 className="ch-edit-modal-title">Edit Chapter</h3>
          <button className="ch-edit-modal-close" onClick={onClose}>&times;</button>
        </div>

        <div className="ch-edit-modal-body">
          <div className="ch-edit-field">
            <label className="ch-edit-label">Name</label>
            <input className="ch-edit-input" value={name} onChange={e => setName(e.target.value)} />
          </div>

          <div className="ch-edit-field">
            <label className="ch-edit-label">Purpose / Description</label>
            <textarea className="ch-edit-textarea" value={purpose} onChange={e => setPurpose(e.target.value)} rows={3} />
          </div>

          <div className="ch-edit-field">
            <label className="ch-edit-label">Primary Outcome</label>
            <input className="ch-edit-input" value={mainOutcome} onChange={e => setMainOutcome(e.target.value)} placeholder="What does completing this chapter look like?" />
          </div>

          <div className="ch-edit-field">
            <label className="ch-edit-label">Why It Matters</label>
            <input className="ch-edit-input" value={whyItMatters} onChange={e => setWhyItMatters(e.target.value)} placeholder="Why is this chapter important?" />
          </div>

          <div className="ch-edit-field">
            <label className="ch-edit-label">Current Priorities</label>
            <textarea className="ch-edit-textarea" value={priorities} onChange={e => setPriorities(e.target.value)} rows={2} placeholder="What should you focus on right now?" />
          </div>

          <div className="ch-edit-row">
            <div className="ch-edit-field ch-edit-half">
              <label className="ch-edit-label">Start Date</label>
              <input className="ch-edit-input" type="date" value={startDate} onChange={e => setStartDate(e.target.value)} />
            </div>
            <div className="ch-edit-field ch-edit-half">
              <label className="ch-edit-label">Target End Date</label>
              <input className="ch-edit-input" type="date" value={targetEndDate} onChange={e => setTargetEndDate(e.target.value)} />
            </div>
          </div>

          <div className="ch-edit-field">
            <label className="ch-edit-label">Exit Criteria</label>
            {conditions.map((c, i) => (
              <div key={i} className="ch-edit-cond-row">
                <input
                  className="ch-edit-input"
                  value={c.text}
                  onChange={e => updateCondition(i, e.target.value)}
                  placeholder={`Condition ${i + 1}`}
                />
                {conditions.length > 1 && (
                  <button className="ch-edit-cond-remove" onClick={() => removeCondition(i)}>&times;</button>
                )}
              </div>
            ))}
            {conditions.length < 8 && (
              <button className="ch-edit-cond-add" onClick={addCondition}>+ Add condition</button>
            )}
          </div>
        </div>

        <div className="ch-edit-modal-footer">
          <button className="ch-modal-cancel" onClick={onClose}>Cancel</button>
          <button className="ch-modal-confirm" onClick={handleSave} disabled={!name.trim()}>Save Changes</button>
        </div>
      </div>
    </div>
  );
}

// ── CloseChapterModal ───────────────────────────────────────────────────────
function CloseChapterModal({ chapter, futureChapters, onClose, onConfirm }) {
  const [selectedNext, setSelectedNext] = useState(futureChapters.length > 0 ? futureChapters[0].id : null);

  if (!chapter) return null;

  return (
    <div className="ch-modal-overlay" onClick={onClose}>
      <div className="ch-modal" onClick={e => e.stopPropagation()}>
        <h3 className="ch-modal-title">Close & Move Forward</h3>
        <p className="ch-modal-body">
          <strong>{chapter.name}</strong> \u2014 all exit criteria met. This chapter will be marked as complete.
        </p>
        {futureChapters.length > 0 && (
          <div className="ch-close-next">
            <span className="ch-close-next-label">Activate next chapter:</span>
            <div className="ch-close-next-options">
              {futureChapters.map(fc => (
                <label key={fc.id} className="ch-close-next-option">
                  <input
                    type="radio"
                    name="nextChapter"
                    checked={selectedNext === fc.id}
                    onChange={() => setSelectedNext(fc.id)}
                  />
                  <span>{fc.name}</span>
                </label>
              ))}
            </div>
          </div>
        )}
        <div className="ch-modal-actions">
          <button className="ch-modal-cancel" onClick={onClose}>Not yet</button>
          <button className="ch-modal-confirm" onClick={() => onConfirm(selectedNext)}>Close & move on</button>
        </div>
      </div>
    </div>
  );
}

// ── RoadmapView ─────────────────────────────────────────────────────────────
function RoadmapView({ chapters, onSelectChapter }) {
  const past = chapters.filter(c => c.status === 'closed');
  const present = chapters.filter(c => c.status === 'active');
  const future = chapters.filter(c => c.status === 'future');
  const next = future.length > 0 ? [future[0]] : [];
  const later = future.slice(1);

  const groups = [
    { label: 'Present', items: present, color: '#6366f1' },
    { label: 'Next', items: next, color: '#8b5cf6' },
    { label: 'Later', items: later, color: '#94a3b8' },
    { label: 'Past', items: past, color: '#10b981' },
  ].filter(g => g.items.length > 0);

  return (
    <div className="ch-roadmap">
      {groups.map(group => (
        <div key={group.label} className="ch-roadmap-group">
          <div className="ch-roadmap-group-header">
            <span className="ch-roadmap-group-dot" style={{ background: group.color }} />
            <span className="ch-roadmap-group-label">{group.label}</span>
          </div>
          <div className="ch-roadmap-cards">
            {group.items.map(ch => {
              const doneCount = ch.conditions.filter(c => c.done).length;
              const totalCount = ch.conditions.length;
              return (
                <button key={ch.id} className="ch-roadmap-card" onClick={() => onSelectChapter(ch.id)}>
                  <span className="ch-roadmap-card-name">{ch.name}</span>
                  {ch.mainOutcome && <span className="ch-roadmap-card-outcome">{ch.mainOutcome}</span>}
                  <div className="ch-roadmap-card-footer">
                    {ch.startDate && <span className="ch-roadmap-card-dates">{yearRange(ch.startDate, ch.closedDate)}</span>}
                    <span className={`ch-badge ch-badge-${ch.status} ch-badge-sm`}>
                      {ch.status === 'active' ? 'Active' : ch.status === 'closed' ? 'Done' : 'Upcoming'}
                    </span>
                    {totalCount > 0 && <span className="ch-roadmap-card-progress">{doneCount}/{totalCount}</span>}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// ── ManagePanel ─────────────────────────────────────────────────────────────
function ManagePanel({ chapters, onSave }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPurpose, setNewPurpose] = useState('');
  const [newConditions, setNewConditions] = useState(['']);
  const ref = useRef(null);

  useEffect(() => { if (addOpen && ref.current) ref.current.focus(); }, [addOpen]);

  function addChapter() {
    if (!newName.trim()) return;
    const conds = newConditions.filter(c => c.trim()).map(text => ({ text: text.trim(), done: false }));
    const maxOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order)) : -1;
    const ch = migrateChapter({
      id: genId(), order: maxOrder + 1,
      name: newName.trim(), purpose: newPurpose.trim(),
      startDate: null, closedDate: null, status: 'future',
      conditions: conds.length > 0 ? conds : [{ text: 'Define conditions', done: false }],
    });
    onSave([...chapters, ch]);
    setNewName(''); setNewPurpose(''); setNewConditions(['']); setAddOpen(false);
  }

  function moveChapter(id, dir) {
    const sorted = [...chapters].sort((a, b) => a.order - b.order);
    const idx = sorted.findIndex(c => c.id === id);
    if (idx < 0) return;
    const swapIdx = idx + dir;
    if (swapIdx < 0 || swapIdx >= sorted.length) return;
    const temp = sorted[idx].order;
    sorted[idx] = { ...sorted[idx], order: sorted[swapIdx].order };
    sorted[swapIdx] = { ...sorted[swapIdx], order: temp };
    onSave(sorted);
  }

  function deleteChapter(id) {
    if (!window.confirm('Delete this chapter?')) return;
    onSave(chapters.filter(c => c.id !== id));
  }

  return (
    <div className="ch-manage">
      <div className="ch-manage-header">
        <span className="ch-manage-title">All Chapters</span>
      </div>

      <div className="ch-manage-list">
        {[...chapters].sort((a, b) => a.order - b.order).map((ch, i) => (
          <div key={ch.id} className="ch-manage-item">
            <div className="ch-manage-item-info">
              <span className="ch-manage-order">{i + 1}</span>
              <span className="ch-manage-name">{ch.name}</span>
              <span className={`ch-manage-status ch-manage-status-${ch.status}`}>
                {ch.status === 'active' ? 'now' : ch.status === 'closed' ? 'done' : ''}
              </span>
            </div>
            <div className="ch-manage-item-actions">
              <button onClick={() => moveChapter(ch.id, -1)} disabled={i === 0} title="Move up">&uarr;</button>
              <button onClick={() => moveChapter(ch.id, 1)} disabled={i === chapters.length - 1} title="Move down">&darr;</button>
              <button onClick={() => deleteChapter(ch.id)} className="ch-manage-delete" title="Delete">&times;</button>
            </div>
          </div>
        ))}
      </div>

      {!addOpen ? (
        <button className="ch-add-btn" onClick={() => setAddOpen(true)}>+ Add chapter</button>
      ) : (
        <div className="ch-add-form">
          <input ref={ref} className="ch-manage-input" value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Chapter name" onKeyDown={e => { if (e.key === 'Escape') setAddOpen(false); }} />
          <textarea className="ch-manage-textarea" value={newPurpose} onChange={e => setNewPurpose(e.target.value)}
            placeholder="What is this chapter for?" rows={2} />
          <div className="ch-add-conditions">
            <span className="ch-add-cond-label">It's over when:</span>
            {newConditions.map((c, i) => (
              <div key={i} className="ch-add-cond-row">
                <input className="ch-manage-input" value={c}
                  onChange={e => { const nc = [...newConditions]; nc[i] = e.target.value; setNewConditions(nc); }}
                  placeholder={`Condition ${i + 1}`} />
                {newConditions.length > 1 && (
                  <button className="ch-add-cond-remove" onClick={() => setNewConditions(newConditions.filter((_, j) => j !== i))}>&times;</button>
                )}
              </div>
            ))}
            {newConditions.length < 4 && (
              <button className="ch-add-cond-add" onClick={() => setNewConditions([...newConditions, ''])}>+ condition</button>
            )}
          </div>
          <div className="ch-manage-edit-actions">
            <button onClick={addChapter} className="ch-manage-save" disabled={!newName.trim()}>Add</button>
            <button onClick={() => { setAddOpen(false); setNewName(''); setNewPurpose(''); setNewConditions(['']); }} className="ch-manage-cancel-btn">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

export default GoalsView;
