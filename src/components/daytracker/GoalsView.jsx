import { useState, useEffect, useRef } from 'react';
import { loadGoals, saveGoals, loadLongTermGoals, saveLongTermGoals } from './storage';

const GOAL_CATEGORIES = {
  financial:     { label: 'Financial',      icon: '💰', color: '#22c55e' },
  career:        { label: 'Career',         icon: '🚀', color: '#6366f1' },
  health:        { label: 'Health',         icon: '💪', color: '#ef4444' },
  education:     { label: 'Education',      icon: '📚', color: '#3b82f6' },
  personal:      { label: 'Personal',       icon: '⭐', color: '#f59e0b' },
  relationships: { label: 'Relationships',  icon: '❤️', color: '#ec4899' },
  business:      { label: 'Business',       icon: '📈', color: '#14b8a6' },
};

const STATUS_CONFIG = {
  not_started: { label: 'Not Started', color: '#94a3b8', bg: '#f1f5f9' },
  in_progress: { label: 'In Progress', color: '#6366f1', bg: '#eef2ff' },
  achieved:    { label: 'Achieved',    color: '#22c55e', bg: '#f0fdf4' },
};

const TIMEFRAMES = {
  '1year':  { label: '1 Year',   short: '1Y',  color: '#3b82f6' },
  '3year':  { label: '3 Years',  short: '3Y',  color: '#8b5cf6' },
  '5year':  { label: '5 Years',  short: '5Y',  color: '#f59e0b' },
  '10year': { label: '10 Years', short: '10Y', color: '#ef4444' },
};

function generateId() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── Goal Card (Current Goals) ───────────────────────────────────────────────

function GoalCard({ goal, onUpdate, onDelete }) {
  const [expanded, setExpanded] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(goal.text);
  const [editNotes, setEditNotes] = useState(goal.notes || '');
  const inputRef = useRef(null);

  const cat = GOAL_CATEGORIES[goal.category] || GOAL_CATEGORIES.personal;
  const st = STATUS_CONFIG[goal.status] || STATUS_CONFIG.in_progress;

  const daysLeft = goal.deadline ? (() => {
    const today = new Date(); today.setHours(0,0,0,0);
    const due = new Date(goal.deadline);
    const diff = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
    if (diff < 0) return { text: `${Math.abs(diff)}d overdue`, cls: 'goal-deadline-overdue' };
    if (diff === 0) return { text: 'Due today', cls: 'goal-deadline-today' };
    if (diff <= 7) return { text: `${diff}d left`, cls: 'goal-deadline-soon' };
    return { text: `${diff}d left`, cls: 'goal-deadline-normal' };
  })() : null;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const saveEdit = () => {
    if (!editText.trim()) return;
    onUpdate({ ...goal, text: editText.trim(), notes: editNotes });
    setEditing(false);
  };

  const cycleStatus = () => {
    const order = ['not_started', 'in_progress', 'achieved'];
    const next = order[(order.indexOf(goal.status) + 1) % order.length];
    onUpdate({ ...goal, status: next });
  };

  return (
    <div className={`goal-card ${goal.status === 'achieved' ? 'goal-card-achieved' : ''}`}>
      <div className="goal-card-header" onClick={() => setExpanded(!expanded)}>
        <button
          className="goal-status-btn"
          onClick={e => { e.stopPropagation(); cycleStatus(); }}
          style={{ background: st.bg, color: st.color, borderColor: st.color + '40' }}
          title={`Status: ${st.label} (click to change)`}
        >
          {goal.status === 'achieved' ? '✓' : goal.status === 'in_progress' ? '◐' : '○'}
        </button>

        <div className="goal-card-body">
          {editing ? (
            <input
              ref={inputRef}
              className="goal-edit-input"
              value={editText}
              onChange={e => setEditText(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
              onBlur={saveEdit}
              onClick={e => e.stopPropagation()}
            />
          ) : (
            <span className={`goal-card-text ${goal.status === 'achieved' ? 'goal-text-achieved' : ''}`}>
              {goal.text}
            </span>
          )}

          <div className="goal-card-meta">
            <span className="goal-category-badge" style={{ color: cat.color, background: cat.color + '15', borderColor: cat.color + '30' }}>
              {cat.icon} {cat.label}
            </span>
            {daysLeft && (
              <span className={`goal-deadline-badge ${daysLeft.cls}`}>
                {daysLeft.text}
              </span>
            )}
          </div>
        </div>

        <div className="goal-card-actions" onClick={e => e.stopPropagation()}>
          <button className="goal-action-btn" onClick={() => setEditing(true)} title="Edit">✎</button>
          <button className="goal-action-btn goal-action-delete" onClick={() => { if (window.confirm('Are you sure you want to delete this goal?')) onDelete(goal.id); }} title="Delete">&times;</button>
        </div>
      </div>

      {expanded && (
        <div className="goal-card-expanded">
          <div className="goal-expanded-row">
            <label className="goal-expanded-label">Category</label>
            <div className="goal-category-picker">
              {Object.entries(GOAL_CATEGORIES).map(([key, c]) => (
                <button
                  key={key}
                  className={`goal-cat-option ${goal.category === key ? 'goal-cat-active' : ''}`}
                  style={goal.category === key ? { background: c.color + '18', borderColor: c.color + '50', color: c.color } : {}}
                  onClick={() => onUpdate({ ...goal, category: key })}
                  title={c.label}
                >
                  {c.icon}
                </button>
              ))}
            </div>
          </div>

          <div className="goal-expanded-row">
            <label className="goal-expanded-label">Status</label>
            <div className="goal-status-picker">
              {Object.entries(STATUS_CONFIG).map(([key, s]) => (
                <button
                  key={key}
                  className={`goal-status-option ${goal.status === key ? 'goal-status-active' : ''}`}
                  style={goal.status === key ? { background: s.bg, color: s.color, borderColor: s.color + '40' } : {}}
                  onClick={() => onUpdate({ ...goal, status: key })}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          <div className="goal-expanded-row">
            <label className="goal-expanded-label">Deadline</label>
            <input
              type="date"
              className="goal-date-input"
              value={goal.deadline || ''}
              onChange={e => onUpdate({ ...goal, deadline: e.target.value || null })}
            />
            {goal.deadline && (
              <button className="goal-clear-date" onClick={() => onUpdate({ ...goal, deadline: null })}>Clear</button>
            )}
          </div>

          <div className="goal-expanded-row">
            <label className="goal-expanded-label">Notes</label>
            <textarea
              className="goal-notes-input"
              value={editNotes}
              onChange={e => setEditNotes(e.target.value)}
              onBlur={() => onUpdate({ ...goal, notes: editNotes })}
              placeholder="Why does this goal matter? What steps are you taking?"
              rows={3}
            />
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Long Term Vision Card ───────────────────────────────────────────────────

function VisionCard({ goal, onUpdate, onDelete }) {
  const [editing, setEditing] = useState(false);
  const [editText, setEditText] = useState(goal.text);
  const inputRef = useRef(null);
  const tf = TIMEFRAMES[goal.timeframe] || TIMEFRAMES['5year'];
  const cat = GOAL_CATEGORIES[goal.category] || GOAL_CATEGORIES.personal;

  useEffect(() => {
    if (editing && inputRef.current) inputRef.current.focus();
  }, [editing]);

  const saveEdit = () => {
    if (!editText.trim()) return;
    onUpdate({ ...goal, text: editText.trim() });
    setEditing(false);
  };

  return (
    <div className="vision-card">
      <div className="vision-card-left">
        <span className="vision-timeframe" style={{ background: tf.color + '15', color: tf.color, borderColor: tf.color + '40' }}>
          {tf.short}
        </span>
      </div>
      <div className="vision-card-body">
        {editing ? (
          <input
            ref={inputRef}
            className="goal-edit-input"
            value={editText}
            onChange={e => setEditText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditing(false); }}
            onBlur={saveEdit}
          />
        ) : (
          <span className="vision-card-text" onDoubleClick={() => setEditing(true)}>
            {goal.text}
          </span>
        )}
        <div className="vision-card-meta">
          <span className="goal-category-badge" style={{ color: cat.color, background: cat.color + '15', borderColor: cat.color + '30' }}>
            {cat.icon} {cat.label}
          </span>
          <div className="vision-meta-actions">
            <select
              className="vision-tf-select"
              value={goal.timeframe}
              onChange={e => onUpdate({ ...goal, timeframe: e.target.value })}
            >
              {Object.entries(TIMEFRAMES).map(([k, v]) => (
                <option key={k} value={k}>{v.label}</option>
              ))}
            </select>
            <select
              className="vision-cat-select"
              value={goal.category}
              onChange={e => onUpdate({ ...goal, category: e.target.value })}
            >
              {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
                <option key={k} value={k}>{v.icon} {v.label}</option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <div className="goal-card-actions">
        <button className="goal-action-btn" onClick={() => setEditing(true)} title="Edit">✎</button>
        <button className="goal-action-btn goal-action-delete" onClick={() => { if (window.confirm('Are you sure you want to delete this goal?')) onDelete(goal.id); }} title="Delete">&times;</button>
      </div>
    </div>
  );
}

// ─── Add Goal Form ───────────────────────────────────────────────────────────

function AddGoalForm({ onAdd, type }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [category, setCategory] = useState('personal');
  const [deadline, setDeadline] = useState('');
  const [timeframe, setTimeframe] = useState('5year');
  const inputRef = useRef(null);

  useEffect(() => {
    if (open && inputRef.current) inputRef.current.focus();
  }, [open]);

  const handleSubmit = () => {
    if (!text.trim()) return;
    if (type === 'current') {
      onAdd({
        id: generateId(),
        text: text.trim(),
        status: 'not_started',
        category,
        deadline: deadline || null,
        notes: '',
      });
    } else {
      onAdd({
        id: generateId(),
        text: text.trim(),
        timeframe,
        category,
      });
    }
    setText('');
    setDeadline('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="goal-add-btn" onClick={() => setOpen(true)}>
        <span className="goal-add-icon">+</span>
        {type === 'current' ? 'Add a goal' : 'Add to your vision'}
      </button>
    );
  }

  return (
    <div className="goal-add-form">
      <input
        ref={inputRef}
        className="goal-add-input"
        value={text}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && text.trim()) handleSubmit(); if (e.key === 'Escape') setOpen(false); }}
        placeholder={type === 'current' ? 'What do you want to achieve?' : 'Where do you want to be?'}
      />
      <div className="goal-add-options">
        <select className="goal-add-select" value={category} onChange={e => setCategory(e.target.value)}>
          {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>
        {type === 'current' ? (
          <input type="date" className="goal-date-input" value={deadline} onChange={e => setDeadline(e.target.value)} />
        ) : (
          <select className="goal-add-select" value={timeframe} onChange={e => setTimeframe(e.target.value)}>
            {Object.entries(TIMEFRAMES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
      </div>
      <div className="goal-add-actions">
        <button className="goal-add-cancel" onClick={() => { setOpen(false); setText(''); }}>Cancel</button>
        <button className="goal-add-submit" onClick={handleSubmit} disabled={!text.trim()}>Add Goal</button>
      </div>
    </div>
  );
}

// ─── Main GoalsView ──────────────────────────────────────────────────────────

function GoalsView() {
  const [goals, setGoals] = useState([]);
  const [longTermGoals, setLongTermGoals] = useState([]);
  const [activeTab, setActiveTab] = useState('current');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterTimeframe, setFilterTimeframe] = useState('all');

  useEffect(() => {
    setGoals(loadGoals());
    setLongTermGoals(loadLongTermGoals());
  }, []);

  useEffect(() => {
    function handleRefresh() {
      setGoals(loadGoals());
      setLongTermGoals(loadLongTermGoals());
    }
    window.addEventListener('daytracker-data-refreshed', handleRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleRefresh);
  }, []);

  function updateGoals(next) { setGoals(next); saveGoals(next); }
  function updateLongTerm(next) { setLongTermGoals(next); saveLongTermGoals(next); }

  function updateGoal(updated) {
    updateGoals(goals.map(g => g.id === updated.id ? updated : g));
  }
  function deleteGoal(id) {
    updateGoals(goals.filter(g => g.id !== id));
  }
  function addGoal(goal) {
    updateGoals([...goals, goal]);
  }

  function updateVision(updated) {
    updateLongTerm(longTermGoals.map(g => g.id === updated.id ? updated : g));
  }
  function deleteVision(id) {
    updateLongTerm(longTermGoals.filter(g => g.id !== id));
  }
  function addVision(goal) {
    updateLongTerm([...longTermGoals, goal]);
  }

  // Stats
  const achieved = goals.filter(g => g.status === 'achieved').length;
  const inProgress = goals.filter(g => g.status === 'in_progress').length;
  const notStarted = goals.filter(g => g.status === 'not_started').length;

  // Filtered goals
  const filteredGoals = goals.filter(g => {
    if (filterCategory !== 'all' && g.category !== filterCategory) return false;
    if (filterStatus !== 'all' && g.status !== filterStatus) return false;
    return true;
  });

  const filteredVisions = longTermGoals.filter(g => {
    if (filterCategory !== 'all' && g.category !== filterCategory) return false;
    if (filterTimeframe !== 'all' && g.timeframe !== filterTimeframe) return false;
    return true;
  });

  // Group visions by timeframe
  const visionsByTimeframe = {};
  for (const tf of Object.keys(TIMEFRAMES)) {
    const items = filteredVisions.filter(g => g.timeframe === tf);
    if (items.length > 0) visionsByTimeframe[tf] = items;
  }

  return (
    <div className="goals-view">
      {/* Stats bar */}
      <div className="goals-stats-bar">
        <div className="goals-stat">
          <span className="goals-stat-num" style={{ color: '#6366f1' }}>{inProgress}</span>
          <span className="goals-stat-label">In Progress</span>
        </div>
        <div className="goals-stat">
          <span className="goals-stat-num" style={{ color: '#22c55e' }}>{achieved}</span>
          <span className="goals-stat-label">Achieved</span>
        </div>
        <div className="goals-stat">
          <span className="goals-stat-num" style={{ color: '#94a3b8' }}>{notStarted}</span>
          <span className="goals-stat-label">Not Started</span>
        </div>
        <div className="goals-stat">
          <span className="goals-stat-num" style={{ color: '#f59e0b' }}>{longTermGoals.length}</span>
          <span className="goals-stat-label">Visions</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="goals-tabs">
        <button
          className={`goals-tab ${activeTab === 'current' ? 'goals-tab-active' : ''}`}
          onClick={() => setActiveTab('current')}
        >
          Current Goals
          {goals.length > 0 && <span className="goals-tab-count">{goals.length}</span>}
        </button>
        <button
          className={`goals-tab ${activeTab === 'vision' ? 'goals-tab-active' : ''}`}
          onClick={() => setActiveTab('vision')}
        >
          Long-Term Vision
          {longTermGoals.length > 0 && <span className="goals-tab-count">{longTermGoals.length}</span>}
        </button>
      </div>

      {/* Filters */}
      <div className="goals-filters">
        <select
          className="goals-filter-select"
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="all">All Categories</option>
          {Object.entries(GOAL_CATEGORIES).map(([k, v]) => (
            <option key={k} value={k}>{v.icon} {v.label}</option>
          ))}
        </select>

        {activeTab === 'current' && (
          <select
            className="goals-filter-select"
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value)}
          >
            <option value="all">All Statuses</option>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}

        {activeTab === 'vision' && (
          <select
            className="goals-filter-select"
            value={filterTimeframe}
            onChange={e => setFilterTimeframe(e.target.value)}
          >
            <option value="all">All Timeframes</option>
            {Object.entries(TIMEFRAMES).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        )}
      </div>

      {/* Current Goals Tab */}
      {activeTab === 'current' && (
        <div className="goals-list">
          {filteredGoals.length === 0 && goals.length > 0 && (
            <div className="goals-empty">No goals match your filters.</div>
          )}
          {goals.length === 0 && (
            <div className="goals-empty-state">
              <div className="goals-empty-icon">🎯</div>
              <p className="goals-empty-title">No goals yet</p>
              <p className="goals-empty-desc">Set specific, measurable goals for this week or month. Track your progress and stay accountable.</p>
            </div>
          )}
          {filteredGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onUpdate={updateGoal} onDelete={deleteGoal} />
          ))}
          <AddGoalForm onAdd={addGoal} type="current" />
        </div>
      )}

      {/* Long-Term Vision Tab */}
      {activeTab === 'vision' && (
        <div className="goals-list">
          {filteredVisions.length === 0 && longTermGoals.length > 0 && (
            <div className="goals-empty">No visions match your filters.</div>
          )}
          {longTermGoals.length === 0 && (
            <div className="goals-empty-state">
              <div className="goals-empty-icon">🔭</div>
              <p className="goals-empty-title">No long-term vision yet</p>
              <p className="goals-empty-desc">Where do you want to be in 1, 3, 5, 10 years? The coach uses these to show you whether your daily actions match your trajectory.</p>
            </div>
          )}
          {Object.entries(visionsByTimeframe).map(([tf, items]) => {
            const tfConfig = TIMEFRAMES[tf];
            return (
              <div key={tf} className="vision-group">
                <div className="vision-group-header">
                  <span className="vision-group-dot" style={{ background: tfConfig.color }} />
                  <span className="vision-group-label">{tfConfig.label}</span>
                  <span className="vision-group-count">{items.length}</span>
                </div>
                {items.map(goal => (
                  <VisionCard key={goal.id} goal={goal} onUpdate={updateVision} onDelete={deleteVision} />
                ))}
              </div>
            );
          })}
          <AddGoalForm onAdd={addVision} type="vision" />
        </div>
      )}
    </div>
  );
}

export default GoalsView;
