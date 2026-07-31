import { useState, useEffect, useRef, useMemo } from 'react';
import {
  loadGoalsV2, saveGoalsV2, loadLifeAreas, saveLifeAreas,
  loadVisions, saveVisions, loadGoals, loadLongTermGoals,
} from './storage';

// ── Life Areas ──────────────────────────────────────────────────────────────
const DEFAULT_LIFE_AREAS = [
  { id: 'money',  name: 'Money',  icon: '💰', color: '#22c55e' },
  { id: 'health', name: 'Health', icon: '💪', color: '#ef4444' },
  { id: 'skills', name: 'Skills', icon: '🧠', color: '#6366f1' },
  { id: 'people', name: 'People', icon: '👥', color: '#ec4899' },
  { id: 'mind',   name: 'Mind',   icon: '🧘', color: '#8b5cf6' },
  { id: 'play',   name: 'Play',   icon: '🎮', color: '#f59e0b' },
];

const AREA_MAP = {};
DEFAULT_LIFE_AREAS.forEach(a => { AREA_MAP[a.id] = a; });

// ── Helpers ─────────────────────────────────────────────────────────────────
function genId() { return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
function todayStr() { return new Date().toISOString().slice(0, 10); }
function daysBetween(a, b) {
  return Math.round((new Date(b) - new Date(a)) / 86400000);
}
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Progress computations ───────────────────────────────────────────────────
function computeGoalProgress(goal) {
  const { progressType } = goal;
  let actual = 0;

  if (progressType === 'metric') {
    const start = parseFloat(goal.startValue) || 0;
    const current = parseFloat(goal.currentValue) || 0;
    const target = parseFloat(goal.targetValue) || 1;
    const range = target - start;
    if (range === 0) actual = current >= target ? 1 : 0;
    else actual = clamp((current - start) / range, 0, 1);
  } else if (progressType === 'milestone') {
    const ms = goal.milestones || [];
    if (ms.length === 0) actual = 0;
    else actual = ms.filter(m => m.done).length / ms.length;
  } else if (progressType === 'habit') {
    const target = parseFloat(goal.targetValue) || 1;
    const log = goal.progressLog || [];
    // Count entries in current period
    const now = new Date();
    const periodStart = goal.habitPeriod === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      : (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
    const count = log.filter(e => e.date >= periodStart).length;
    actual = clamp(count / target, 0, 1);
  }

  // Expected progress from time
  let expected = 0;
  if (goal.startDate && goal.deadline) {
    const totalDays = daysBetween(goal.startDate, goal.deadline);
    const elapsed = daysBetween(goal.startDate, todayStr());
    if (totalDays > 0) expected = clamp(elapsed / totalDays, 0, 1);
    else expected = 1;
  }

  // Pace status
  const diff = actual - expected;
  let pace;
  if (actual >= 1) pace = 'complete';
  else if (!goal.startDate || !goal.deadline) pace = 'no-deadline';
  else if (diff >= 0.05) pace = 'ahead';
  else if (diff >= -0.05) pace = 'on-track';
  else pace = 'behind';

  // Stale check
  const log = goal.progressLog || [];
  const lastEntry = log.length > 0 ? log[log.length - 1] : null;
  const daysSinceUpdate = lastEntry ? daysBetween(lastEntry.date, todayStr()) : null;
  const stale = daysSinceUpdate !== null && daysSinceUpdate >= 14;

  // Past deadline
  const pastDeadline = goal.deadline && todayStr() > goal.deadline && actual < 1;

  // Streak for habits
  let streak = 0;
  if (progressType === 'habit' && log.length > 0) {
    const sorted = [...log].sort((a, b) => b.date.localeCompare(a.date));
    const today = todayStr();
    let checkDate = today;
    for (const entry of sorted) {
      if (entry.date === checkDate || entry.date === prevDay(checkDate)) {
        streak++;
        checkDate = entry.date;
      } else break;
    }
  }

  return { actual, expected, pace, stale, daysSinceUpdate, pastDeadline, streak };
}

function prevDay(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

const PACE_CONFIG = {
  'ahead':       { label: 'Ahead',    color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  'on-track':    { label: 'On Track', color: '#6366f1', bg: '#eef2ff', border: '#c7d2fe' },
  'behind':      { label: 'Behind',   color: '#ef4444', bg: '#fef2f2', border: '#fecaca' },
  'complete':    { label: 'Complete', color: '#22c55e', bg: '#f0fdf4', border: '#bbf7d0' },
  'no-deadline': { label: 'Active',   color: '#64748b', bg: '#f8fafc', border: '#e2e8f0' },
};

// ── Sparkline (last 8 data points) ──────────────────────────────────────────
function Sparkline({ data, color }) {
  if (!data || data.length < 2) return null;
  const vals = data.slice(-8).map(d => parseFloat(d.value) || 0);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const range = max - min || 1;
  const w = 64, h = 20;
  const points = vals.map((v, i) => {
    const x = (i / (vals.length - 1)) * w;
    const y = h - ((v - min) / range) * (h - 4) - 2;
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width={w} height={h} className="gv2-sparkline">
      <polyline points={points} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Life Snapshot Row ───────────────────────────────────────────────────────
function LifeSnapshot({ areas, onStartCheckin }) {
  return (
    <div className="gv2-snapshot">
      <div className="gv2-snapshot-header">
        <span className="gv2-snapshot-title">Life Snapshot</span>
        <button className="gv2-checkin-btn" onClick={onStartCheckin}>Weekly Check-in</button>
      </div>
      <div className="gv2-snapshot-grid">
        {areas.map(area => {
          const hist = area.ratingHistory || [];
          const current = hist.length > 0 ? hist[hist.length - 1].score : null;
          const prev = hist.length > 1 ? hist[hist.length - 2].score : null;
          const trend = current !== null && prev !== null ? current - prev : 0;
          const areaInfo = AREA_MAP[area.id] || { icon: '📊', color: '#64748b' };
          return (
            <div key={area.id} className="gv2-snapshot-card" style={{ borderColor: areaInfo.color + '40' }}>
              <div className="gv2-snapshot-card-top">
                <span className="gv2-snapshot-icon">{areaInfo.icon}</span>
                <span className="gv2-snapshot-name">{area.name}</span>
              </div>
              {current !== null ? (
                <>
                  <div className="gv2-snapshot-score" style={{ color: areaInfo.color }}>
                    {current}<span className="gv2-snapshot-of">/10</span>
                  </div>
                  <div className="gv2-snapshot-bar-track">
                    <div className="gv2-snapshot-bar-fill" style={{ width: `${current * 10}%`, background: areaInfo.color }} />
                  </div>
                  {trend !== 0 && (
                    <span className={`gv2-snapshot-trend ${trend > 0 ? 'gv2-trend-up' : 'gv2-trend-down'}`}>
                      {trend > 0 ? '↑' : '↓'} {Math.abs(trend)}
                    </span>
                  )}
                </>
              ) : (
                <span className="gv2-snapshot-empty">No rating yet</span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Goal Card ───────────────────────────────────────────────────────────────
function GoalCard({ goal, onUpdate, onDelete, onLogProgress }) {
  const [expanded, setExpanded] = useState(false);
  const prog = useMemo(() => computeGoalProgress(goal), [goal]);
  const area = AREA_MAP[goal.area] || { icon: '📊', name: 'Other', color: '#64748b' };
  const paceConf = PACE_CONFIG[prog.pace] || PACE_CONFIG['no-deadline'];
  const pctActual = Math.round(prog.actual * 100);
  const pctExpected = Math.round(prog.expected * 100);
  const log = goal.progressLog || [];
  const lastEntry = log.length > 0 ? log[log.length - 1] : null;

  const daysLeft = goal.deadline ? daysBetween(todayStr(), goal.deadline) : null;

  // Current / target display
  let valueDisplay = '';
  if (goal.progressType === 'metric') {
    valueDisplay = `${goal.currentValue ?? goal.startValue ?? 0} / ${goal.targetValue ?? '?'} ${goal.unit || ''}`;
  } else if (goal.progressType === 'milestone') {
    const ms = goal.milestones || [];
    valueDisplay = `${ms.filter(m => m.done).length} / ${ms.length} steps`;
  } else if (goal.progressType === 'habit') {
    const now = new Date();
    const periodStart = goal.habitPeriod === 'month'
      ? new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10)
      : (() => { const d = new Date(now); d.setDate(d.getDate() - d.getDay()); return d.toISOString().slice(0, 10); })();
    const count = log.filter(e => e.date >= periodStart).length;
    valueDisplay = `${count} / ${goal.targetValue || '?'} this ${goal.habitPeriod === 'month' ? 'month' : 'week'}`;
    if (prog.streak > 0) valueDisplay += ` (${prog.streak} day streak)`;
  }

  return (
    <div className={`gv2-goal-card ${prog.stale ? 'gv2-goal-stale' : ''} ${prog.pace === 'complete' ? 'gv2-goal-complete' : ''}`}>
      <div className="gv2-goal-card-main" onClick={() => setExpanded(!expanded)}>
        <div className="gv2-goal-top-row">
          <span className="gv2-goal-title">{goal.title}</span>
          <span className="gv2-pace-pill" style={{ color: paceConf.color, background: paceConf.bg, borderColor: paceConf.border }}>
            {paceConf.label}
          </span>
        </div>

        <div className="gv2-goal-meta-row">
          <span className="gv2-area-badge" style={{ color: area.color, background: area.color + '15', borderColor: area.color + '30' }}>
            {area.icon} {area.name}
          </span>
          <span className="gv2-goal-value">{valueDisplay}</span>
        </div>

        {/* Progress bar with pace marker */}
        <div className="gv2-bar-container">
          <div className="gv2-bar-track">
            <div className="gv2-bar-fill" style={{ width: `${pctActual}%`, background: paceConf.color, transition: 'width 0.5s ease' }} />
            {goal.startDate && goal.deadline && prog.pace !== 'complete' && (
              <div className="gv2-bar-expected" style={{ left: `${pctExpected}%` }} title={`Expected: ${pctExpected}%`} />
            )}
          </div>
          <span className="gv2-bar-pct">{pctActual}%</span>
        </div>

        <div className="gv2-goal-footer">
          {goal.deadline && (
            <span className={`gv2-deadline ${daysLeft < 0 ? 'gv2-deadline-overdue' : daysLeft <= 7 ? 'gv2-deadline-soon' : ''}`}>
              {daysLeft < 0 ? `${Math.abs(daysLeft)}d overdue` : daysLeft === 0 ? 'Due today' : `${daysLeft}d left`}
            </span>
          )}
          {lastEntry && (
            <span className="gv2-last-updated">Updated {lastEntry.date}</span>
          )}
          {prog.stale && <span className="gv2-stale-flag">Stale</span>}
          <Sparkline data={log} color={area.color} />
        </div>
      </div>

      <div className="gv2-goal-actions">
        <button className="gv2-log-btn" onClick={e => { e.stopPropagation(); onLogProgress(goal); }} title="Log progress">+</button>
      </div>

      {expanded && (
        <div className="gv2-goal-expanded">
          {/* Milestones list */}
          {goal.progressType === 'milestone' && (
            <div className="gv2-milestones">
              {(goal.milestones || []).map((ms, i) => (
                <label key={i} className="gv2-milestone-item">
                  <input type="checkbox" checked={ms.done}
                    onChange={() => {
                      const updated = [...(goal.milestones || [])];
                      updated[i] = { ...updated[i], done: !updated[i].done };
                      onUpdate({ ...goal, milestones: updated });
                    }} />
                  <span className={ms.done ? 'gv2-ms-done' : ''}>{ms.text}</span>
                </label>
              ))}
            </div>
          )}

          {/* Progress log */}
          {log.length > 0 && (
            <div className="gv2-progress-log">
              <span className="gv2-log-title">Progress Log</span>
              {log.slice(-5).reverse().map((entry, i) => (
                <div key={i} className="gv2-log-entry">
                  <span className="gv2-log-date">{entry.date}</span>
                  <span className="gv2-log-value">{entry.value}{goal.unit ? ` ${goal.unit}` : ''}</span>
                  {entry.note && <span className="gv2-log-note">{entry.note}</span>}
                </div>
              ))}
            </div>
          )}

          {/* Past deadline actions */}
          {prog.pastDeadline && (
            <div className="gv2-overdue-actions">
              <span className="gv2-overdue-msg">This goal is past its deadline.</span>
              <div className="gv2-overdue-btns">
                <button onClick={() => {
                  const newDeadline = new Date(goal.deadline);
                  newDeadline.setDate(newDeadline.getDate() + 30);
                  onUpdate({ ...goal, deadline: newDeadline.toISOString().slice(0, 10) });
                }}>Extend 30d</button>
                <button onClick={() => onUpdate({ ...goal, archived: true })}>Archive</button>
              </div>
            </div>
          )}

          <div className="gv2-goal-edit-actions">
            <button className="gv2-edit-btn" onClick={() => {
              const newTitle = prompt('Goal title:', goal.title);
              if (newTitle && newTitle.trim()) onUpdate({ ...goal, title: newTitle.trim() });
            }}>Edit</button>
            <button className="gv2-delete-btn" onClick={() => {
              if (window.confirm('Delete this goal?')) onDelete(goal.id);
            }}>Delete</button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Vision Card ─────────────────────────────────────────────────────────────
function VisionCard({ vision, goals, onUpdate, onDelete }) {
  const childGoals = goals.filter(g => g.visionId === vision.id && !g.archived);
  const avgProgress = childGoals.length > 0
    ? childGoals.reduce((sum, g) => sum + computeGoalProgress(g).actual, 0) / childGoals.length
    : 0;
  const onTrackCount = childGoals.filter(g => {
    const p = computeGoalProgress(g).pace;
    return p === 'ahead' || p === 'on-track' || p === 'complete';
  }).length;
  const area = AREA_MAP[vision.area] || { icon: '📊', name: 'Other', color: '#64748b' };

  return (
    <div className="gv2-vision-card">
      <div className="gv2-vision-top">
        <span className="gv2-vision-title">{vision.title}</span>
        <span className="gv2-vision-horizon">{vision.horizon}</span>
      </div>
      <div className="gv2-vision-meta">
        <span className="gv2-area-badge" style={{ color: area.color, background: area.color + '15', borderColor: area.color + '30' }}>
          {area.icon} {area.name}
        </span>
        {childGoals.length > 0 ? (
          <span className="gv2-vision-stats">{onTrackCount}/{childGoals.length} on track</span>
        ) : (
          <span className="gv2-vision-no-goals">No active goals</span>
        )}
      </div>
      {childGoals.length > 0 && (
        <div className="gv2-bar-container">
          <div className="gv2-bar-track">
            <div className="gv2-bar-fill" style={{ width: `${Math.round(avgProgress * 100)}%`, background: area.color }} />
          </div>
          <span className="gv2-bar-pct">{Math.round(avgProgress * 100)}%</span>
        </div>
      )}
      <div className="gv2-vision-actions">
        <button className="gv2-edit-btn" onClick={() => {
          const t = prompt('Vision title:', vision.title);
          if (t && t.trim()) onUpdate({ ...vision, title: t.trim() });
        }}>Edit</button>
        <button className="gv2-delete-btn" onClick={() => {
          if (window.confirm('Delete this vision?')) onDelete(vision.id);
        }}>Delete</button>
      </div>
    </div>
  );
}

// ── Add Goal Form ───────────────────────────────────────────────────────────
function AddGoalForm({ onAdd, visions, areas }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('health');
  const [progressType, setProgressType] = useState('metric');
  const [startValue, setStartValue] = useState('');
  const [targetValue, setTargetValue] = useState('');
  const [unit, setUnit] = useState('');
  const [startDate, setStartDate] = useState(todayStr());
  const [deadline, setDeadline] = useState('');
  const [visionId, setVisionId] = useState('');
  const [milestoneText, setMilestoneText] = useState('');
  const [milestones, setMilestones] = useState([]);
  const [habitPeriod, setHabitPeriod] = useState('week');
  const ref = useRef(null);

  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    const goal = {
      id: genId(), title: title.trim(), area, progressType,
      startValue: parseFloat(startValue) || 0,
      currentValue: parseFloat(startValue) || 0,
      targetValue: parseFloat(targetValue) || 0,
      unit: unit.trim(),
      startDate, deadline: deadline || null,
      visionId: visionId || null,
      milestones: progressType === 'milestone' ? milestones : [],
      habitPeriod: progressType === 'habit' ? habitPeriod : null,
      progressLog: [], archived: false,
    };
    onAdd(goal);
    setTitle(''); setStartValue(''); setTargetValue(''); setUnit('');
    setDeadline(''); setVisionId(''); setMilestones([]); setMilestoneText('');
    setOpen(false);
  };

  if (!open) {
    return (
      <button className="gv2-add-btn" onClick={() => setOpen(true)}>
        <span className="gv2-add-icon">+</span> Add a goal
      </button>
    );
  }

  return (
    <div className="gv2-add-form">
      <input ref={ref} className="gv2-add-input" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="What do you want to achieve?" onKeyDown={e => { if (e.key === 'Escape') setOpen(false); }} />

      <div className="gv2-add-row">
        <select className="gv2-add-select" value={area} onChange={e => setArea(e.target.value)}>
          {(areas || DEFAULT_LIFE_AREAS).map(a => (
            <option key={a.id} value={a.id}>{a.icon || ''} {a.name}</option>
          ))}
        </select>
        <select className="gv2-add-select" value={progressType} onChange={e => setProgressType(e.target.value)}>
          <option value="metric">Metric (number)</option>
          <option value="milestone">Milestones (checklist)</option>
          <option value="habit">Habit (recurring)</option>
        </select>
      </div>

      {progressType === 'metric' && (
        <div className="gv2-add-row">
          <input type="number" className="gv2-add-small" placeholder="Start" value={startValue} onChange={e => setStartValue(e.target.value)} />
          <input type="number" className="gv2-add-small" placeholder="Target" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
          <input className="gv2-add-small" placeholder="Unit (kg, EUR...)" value={unit} onChange={e => setUnit(e.target.value)} />
        </div>
      )}

      {progressType === 'milestone' && (
        <div className="gv2-milestone-builder">
          <div className="gv2-add-row">
            <input className="gv2-add-input" placeholder="Add a milestone step..." value={milestoneText}
              onChange={e => setMilestoneText(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && milestoneText.trim()) {
                  setMilestones([...milestones, { text: milestoneText.trim(), done: false }]);
                  setMilestoneText('');
                }
              }} />
          </div>
          {milestones.map((m, i) => (
            <div key={i} className="gv2-ms-preview">
              <span>{i + 1}. {m.text}</span>
              <button onClick={() => setMilestones(milestones.filter((_, j) => j !== i))}>&times;</button>
            </div>
          ))}
        </div>
      )}

      {progressType === 'habit' && (
        <div className="gv2-add-row">
          <input type="number" className="gv2-add-small" placeholder="Target count" value={targetValue} onChange={e => setTargetValue(e.target.value)} />
          <select className="gv2-add-select" value={habitPeriod} onChange={e => setHabitPeriod(e.target.value)}>
            <option value="week">Per week</option>
            <option value="month">Per month</option>
          </select>
          <input className="gv2-add-small" placeholder="Unit (optional)" value={unit} onChange={e => setUnit(e.target.value)} />
        </div>
      )}

      <div className="gv2-add-row">
        <input type="date" className="gv2-add-small" value={startDate} onChange={e => setStartDate(e.target.value)} title="Start date" />
        <input type="date" className="gv2-add-small" value={deadline} onChange={e => setDeadline(e.target.value)} placeholder="Deadline" title="Deadline" />
        {visions.length > 0 && (
          <select className="gv2-add-select" value={visionId} onChange={e => setVisionId(e.target.value)}>
            <option value="">No vision</option>
            {visions.map(v => <option key={v.id} value={v.id}>{v.title}</option>)}
          </select>
        )}
      </div>

      <div className="gv2-add-actions">
        <button className="gv2-cancel-btn" onClick={() => { setOpen(false); setTitle(''); }}>Cancel</button>
        <button className="gv2-submit-btn" onClick={handleSubmit} disabled={!title.trim()}>Add Goal</button>
      </div>
    </div>
  );
}

// ── Add Vision Form ─────────────────────────────────────────────────────────
function AddVisionForm({ onAdd, areas }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [area, setArea] = useState('health');
  const [horizon, setHorizon] = useState('3 years');
  const ref = useRef(null);
  useEffect(() => { if (open && ref.current) ref.current.focus(); }, [open]);

  const handleSubmit = () => {
    if (!title.trim()) return;
    onAdd({ id: genId(), title: title.trim(), area, horizon, goalIds: [] });
    setTitle(''); setOpen(false);
  };

  if (!open) {
    return (
      <button className="gv2-add-btn" onClick={() => setOpen(true)}>
        <span className="gv2-add-icon">+</span> Add a vision
      </button>
    );
  }

  return (
    <div className="gv2-add-form">
      <input ref={ref} className="gv2-add-input" value={title} onChange={e => setTitle(e.target.value)}
        placeholder="Where do you want to be?" onKeyDown={e => { if (e.key === 'Enter' && title.trim()) handleSubmit(); if (e.key === 'Escape') setOpen(false); }} />
      <div className="gv2-add-row">
        <select className="gv2-add-select" value={area} onChange={e => setArea(e.target.value)}>
          {(areas || DEFAULT_LIFE_AREAS).map(a => <option key={a.id} value={a.id}>{a.icon || ''} {a.name}</option>)}
        </select>
        <select className="gv2-add-select" value={horizon} onChange={e => setHorizon(e.target.value)}>
          {['1 year', '3 years', '5 years', '10 years'].map(h => <option key={h} value={h}>{h}</option>)}
        </select>
      </div>
      <div className="gv2-add-actions">
        <button className="gv2-cancel-btn" onClick={() => { setOpen(false); setTitle(''); }}>Cancel</button>
        <button className="gv2-submit-btn" onClick={handleSubmit} disabled={!title.trim()}>Add Vision</button>
      </div>
    </div>
  );
}

// ── Log Progress Modal ──────────────────────────────────────────────────────
function LogProgressModal({ goal, onSave, onClose }) {
  const [value, setValue] = useState(goal.progressType === 'habit' ? '1' : (goal.currentValue ?? ''));
  const [note, setNote] = useState('');
  const ref = useRef(null);
  useEffect(() => { if (ref.current) ref.current.focus(); }, []);

  const handleSave = () => {
    const numVal = parseFloat(value) || 0;
    const entry = { date: todayStr(), value: numVal, note: note.trim() };
    const updatedLog = [...(goal.progressLog || []), entry];
    const updates = { ...goal, progressLog: updatedLog };
    if (goal.progressType === 'metric') {
      updates.currentValue = numVal;
    }
    onSave(updates);
    onClose();
  };

  return (
    <div className="gv2-modal-overlay" onClick={onClose}>
      <div className="gv2-modal" onClick={e => e.stopPropagation()}>
        <h3 className="gv2-modal-title">Log Progress</h3>
        <p className="gv2-modal-subtitle">{goal.title}</p>
        <div className="gv2-modal-field">
          <label>{goal.progressType === 'habit' ? 'Count' : `Current value${goal.unit ? ` (${goal.unit})` : ''}`}</label>
          <input ref={ref} type="number" value={value} onChange={e => setValue(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleSave(); }} />
        </div>
        <div className="gv2-modal-field">
          <label>Note (optional)</label>
          <input value={note} onChange={e => setNote(e.target.value)} placeholder="What happened?" />
        </div>
        <div className="gv2-modal-actions">
          <button className="gv2-cancel-btn" onClick={onClose}>Cancel</button>
          <button className="gv2-submit-btn" onClick={handleSave}>Save</button>
        </div>
      </div>
    </div>
  );
}

// ── Weekly Check-in Flow ────────────────────────────────────────────────────
function CheckinFlow({ areas, goals, onSaveAreas, onSaveGoal, onClose }) {
  const [step, setStep] = useState(0); // 0 = life areas, 1 = goals, 2 = summary
  const [ratings, setRatings] = useState(() => {
    const map = {};
    for (const a of areas) {
      const hist = a.ratingHistory || [];
      map[a.id] = hist.length > 0 ? hist[hist.length - 1].score : 5;
    }
    return map;
  });
  const [goalValues, setGoalValues] = useState(() => {
    const map = {};
    for (const g of goals) {
      if (g.progressType === 'metric') map[g.id] = g.currentValue ?? g.startValue ?? 0;
    }
    return map;
  });

  const activeGoals = goals.filter(g => !g.archived && computeGoalProgress(g).pace !== 'complete');

  const finishCheckin = () => {
    // Save life area ratings
    const today = todayStr();
    const updatedAreas = areas.map(a => ({
      ...a,
      ratingHistory: [...(a.ratingHistory || []), { date: today, score: ratings[a.id] ?? 5 }],
    }));
    onSaveAreas(updatedAreas);

    // Save goal values
    for (const g of activeGoals) {
      if (g.progressType === 'metric' && goalValues[g.id] !== undefined) {
        const newVal = parseFloat(goalValues[g.id]) || 0;
        if (newVal !== (g.currentValue ?? g.startValue ?? 0)) {
          const entry = { date: today, value: newVal, note: 'Weekly check-in' };
          onSaveGoal({ ...g, currentValue: newVal, progressLog: [...(g.progressLog || []), entry] });
        }
      }
    }
    onClose();
  };

  return (
    <div className="gv2-modal-overlay" onClick={onClose}>
      <div className="gv2-modal gv2-checkin-modal" onClick={e => e.stopPropagation()}>
        <h3 className="gv2-modal-title">Weekly Check-in</h3>

        {step === 0 && (
          <div className="gv2-checkin-step">
            <p className="gv2-checkin-prompt">Rate each area of your life right now (1-10)</p>
            {areas.map(a => {
              const info = AREA_MAP[a.id] || { icon: '📊', color: '#64748b' };
              return (
                <div key={a.id} className="gv2-checkin-area">
                  <span className="gv2-checkin-area-label">{info.icon} {a.name}</span>
                  <input type="range" min="1" max="10" value={ratings[a.id] ?? 5}
                    onChange={e => setRatings({ ...ratings, [a.id]: parseInt(e.target.value) })}
                    style={{ accentColor: info.color }} />
                  <span className="gv2-checkin-area-val" style={{ color: info.color }}>{ratings[a.id] ?? 5}</span>
                </div>
              );
            })}
            <div className="gv2-modal-actions">
              <button className="gv2-cancel-btn" onClick={onClose}>Cancel</button>
              <button className="gv2-submit-btn" onClick={() => setStep(1)}>Next</button>
            </div>
          </div>
        )}

        {step === 1 && (
          <div className="gv2-checkin-step">
            <p className="gv2-checkin-prompt">Update your goal progress</p>
            {activeGoals.length === 0 ? (
              <p className="gv2-checkin-no-goals">No active goals to update.</p>
            ) : (
              activeGoals.map(g => {
                if (g.progressType !== 'metric') return (
                  <div key={g.id} className="gv2-checkin-goal">
                    <span className="gv2-checkin-goal-title">{g.title}</span>
                    <span className="gv2-checkin-goal-hint">{Math.round(computeGoalProgress(g).actual * 100)}% — update milestones/habits from goal card</span>
                  </div>
                );
                return (
                  <div key={g.id} className="gv2-checkin-goal">
                    <span className="gv2-checkin-goal-title">{g.title}</span>
                    <div className="gv2-checkin-goal-input">
                      <input type="number" value={goalValues[g.id] ?? ''} onChange={e => setGoalValues({ ...goalValues, [g.id]: e.target.value })} />
                      <span className="gv2-checkin-goal-unit">{g.unit || ''} (target: {g.targetValue})</span>
                    </div>
                  </div>
                );
              })
            )}
            <div className="gv2-modal-actions">
              <button className="gv2-cancel-btn" onClick={() => setStep(0)}>Back</button>
              <button className="gv2-submit-btn" onClick={() => setStep(2)}>Next</button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="gv2-checkin-step">
            <p className="gv2-checkin-prompt">Summary</p>
            <div className="gv2-checkin-summary">
              {areas.map(a => {
                const info = AREA_MAP[a.id] || { icon: '📊', color: '#64748b' };
                const prev = (a.ratingHistory || []).length > 0 ? a.ratingHistory[a.ratingHistory.length - 1].score : null;
                const curr = ratings[a.id] ?? 5;
                const diff = prev !== null ? curr - prev : 0;
                return (
                  <div key={a.id} className="gv2-summary-row">
                    <span>{info.icon} {a.name}</span>
                    <span style={{ color: info.color, fontWeight: 700 }}>{curr}/10</span>
                    {diff !== 0 && <span className={diff > 0 ? 'gv2-trend-up' : 'gv2-trend-down'}>{diff > 0 ? '+' : ''}{diff}</span>}
                  </div>
                );
              })}
            </div>
            <div className="gv2-modal-actions">
              <button className="gv2-cancel-btn" onClick={() => setStep(1)}>Back</button>
              <button className="gv2-submit-btn" onClick={finishCheckin}>Finish Check-in</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main GoalsView ──────────────────────────────────────────────────────────
function GoalsView() {
  const [goals, setGoals] = useState([]);
  const [lifeAreas, setLifeAreas] = useState(null);
  const [visions, setVisions] = useState([]);
  const [activeTab, setActiveTab] = useState('goals');
  const [filterArea, setFilterArea] = useState('all');
  const [filterPace, setFilterPace] = useState('all');
  const [logGoal, setLogGoal] = useState(null);
  const [showCheckin, setShowCheckin] = useState(false);

  // Load data
  useEffect(() => {
    let g = loadGoalsV2();
    let la = loadLifeAreas();
    let v = loadVisions();

    // Migrate from v1 if v2 is empty
    if (g.length === 0) {
      const oldGoals = loadGoals();
      if (oldGoals.length > 0) {
        g = oldGoals.map(old => {
          const areaMap = { financial: 'money', career: 'skills', health: 'health', education: 'skills', personal: 'mind', relationships: 'people', business: 'money' };
          return {
            id: old.id, title: old.text, area: areaMap[old.category] || 'mind',
            progressType: 'metric', startValue: 0,
            currentValue: old.status === 'achieved' ? 100 : old.status === 'in_progress' ? 50 : 0,
            targetValue: 100, unit: '%',
            startDate: todayStr(), deadline: old.deadline || null,
            visionId: null, milestones: [], habitPeriod: null,
            progressLog: old.status !== 'not_started' ? [{ date: todayStr(), value: old.status === 'achieved' ? 100 : 50, note: 'Migrated from v1' }] : [],
            archived: false,
          };
        });
        saveGoalsV2(g);
      }
    }

    if (!la) {
      la = DEFAULT_LIFE_AREAS.map(a => ({ ...a, ratingHistory: [] }));
      saveLifeAreas(la);
    }

    setGoals(g);
    setLifeAreas(la);
    setVisions(v);
  }, []);

  useEffect(() => {
    function handleRefresh() {
      setGoals(loadGoalsV2());
      setLifeAreas(loadLifeAreas());
      setVisions(loadVisions());
    }
    window.addEventListener('daytracker-data-refreshed', handleRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleRefresh);
  }, []);

  const areas = lifeAreas || DEFAULT_LIFE_AREAS.map(a => ({ ...a, ratingHistory: [] }));

  function updateGoals(next) { setGoals(next); saveGoalsV2(next); }
  function updateAreas(next) { setLifeAreas(next); saveLifeAreas(next); }
  function updateVisions(next) { setVisions(next); saveVisions(next); }

  function updateGoal(updated) { updateGoals(goals.map(g => g.id === updated.id ? updated : g)); }
  function deleteGoal(id) { updateGoals(goals.filter(g => g.id !== id)); }
  function addGoal(goal) { updateGoals([...goals, goal]); }
  function addVision(vision) { updateVisions([...visions, vision]); }
  function updateVision(updated) { updateVisions(visions.map(v => v.id === updated.id ? updated : v)); }
  function deleteVision(id) { updateVisions(visions.filter(v => v.id !== id)); }

  // Active (non-archived) goals
  const activeGoals = goals.filter(g => !g.archived);

  // Filtered goals
  const filteredGoals = activeGoals.filter(g => {
    if (filterArea !== 'all' && g.area !== filterArea) return false;
    if (filterPace !== 'all') {
      const pace = computeGoalProgress(g).pace;
      if (filterPace !== pace) return false;
    }
    return true;
  });

  // Stats
  const paceStats = { ahead: 0, 'on-track': 0, behind: 0, complete: 0 };
  for (const g of activeGoals) {
    const pace = computeGoalProgress(g).pace;
    if (pace in paceStats) paceStats[pace]++;
  }

  return (
    <div className="gv2-root">
      {/* Life Snapshot */}
      <LifeSnapshot areas={areas} onStartCheckin={() => setShowCheckin(true)} />

      {/* Stats bar */}
      <div className="gv2-stats-bar">
        <div className="gv2-stat">
          <span className="gv2-stat-num" style={{ color: '#22c55e' }}>{paceStats.ahead}</span>
          <span className="gv2-stat-label">Ahead</span>
        </div>
        <div className="gv2-stat">
          <span className="gv2-stat-num" style={{ color: '#6366f1' }}>{paceStats['on-track']}</span>
          <span className="gv2-stat-label">On Track</span>
        </div>
        <div className="gv2-stat">
          <span className="gv2-stat-num" style={{ color: '#ef4444' }}>{paceStats.behind}</span>
          <span className="gv2-stat-label">Behind</span>
        </div>
        <div className="gv2-stat">
          <span className="gv2-stat-num" style={{ color: '#22c55e' }}>{paceStats.complete}</span>
          <span className="gv2-stat-label">Complete</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="gv2-tabs">
        {['goals', 'visions'].map(tab => (
          <button key={tab} className={`gv2-tab ${activeTab === tab ? 'gv2-tab-active' : ''}`}
            onClick={() => setActiveTab(tab)}>
            {tab === 'goals' ? 'Goals' : 'Visions'}
            <span className="gv2-tab-count">{tab === 'goals' ? activeGoals.length : visions.length}</span>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="gv2-filters">
        <select className="gv2-filter" value={filterArea} onChange={e => setFilterArea(e.target.value)}>
          <option value="all">All Areas</option>
          {areas.map(a => <option key={a.id} value={a.id}>{a.icon || ''} {a.name}</option>)}
        </select>
        {activeTab === 'goals' && (
          <select className="gv2-filter" value={filterPace} onChange={e => setFilterPace(e.target.value)}>
            <option value="all">All Statuses</option>
            {Object.entries(PACE_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
        )}
      </div>

      {/* Goals Tab */}
      {activeTab === 'goals' && (
        <div className="gv2-list">
          {filteredGoals.length === 0 && activeGoals.length > 0 && (
            <div className="gv2-empty">No goals match your filters.</div>
          )}
          {activeGoals.length === 0 && (
            <div className="gv2-empty-state">
              <div className="gv2-empty-icon">🎯</div>
              <p className="gv2-empty-title">No goals yet</p>
              <p className="gv2-empty-desc">Set measurable goals with deadlines. Track progress, see your pace, and stay accountable.</p>
            </div>
          )}
          {filteredGoals.map(goal => (
            <GoalCard key={goal.id} goal={goal} onUpdate={updateGoal} onDelete={deleteGoal}
              onLogProgress={g => setLogGoal(g)} />
          ))}
          <AddGoalForm onAdd={addGoal} visions={visions} areas={areas} />
        </div>
      )}

      {/* Visions Tab */}
      {activeTab === 'visions' && (
        <div className="gv2-list">
          {visions.length === 0 && (
            <div className="gv2-empty-state">
              <div className="gv2-empty-icon">🔭</div>
              <p className="gv2-empty-title">No visions yet</p>
              <p className="gv2-empty-desc">Set long-term visions and link goals to them. See how your daily progress rolls up to the big picture.</p>
            </div>
          )}
          {visions.map(v => (
            <VisionCard key={v.id} vision={v} goals={activeGoals} onUpdate={updateVision} onDelete={deleteVision} />
          ))}
          <AddVisionForm onAdd={addVision} areas={areas} />
        </div>
      )}

      {/* Log Progress Modal */}
      {logGoal && <LogProgressModal goal={logGoal} onSave={updateGoal} onClose={() => setLogGoal(null)} />}

      {/* Check-in Flow */}
      {showCheckin && (
        <CheckinFlow areas={areas} goals={activeGoals}
          onSaveAreas={updateAreas} onSaveGoal={updateGoal}
          onClose={() => setShowCheckin(false)} />
      )}
    </div>
  );
}

export default GoalsView;
