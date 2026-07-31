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

function yearRange(startDate, closedDate) {
  if (!startDate) return '';
  const s = new Date(startDate).getFullYear();
  const e = closedDate ? new Date(closedDate).getFullYear() : 'now';
  return s === e ? `${s}` : `${s}–${e}`;
}

// ── Demo data ───────────────────────────────────────────────────────────────
const DEMO_CHAPTERS = [
  {
    id: genId(), order: 0,
    name: 'Monetize a skill',
    purpose: 'Pick one marketable skill and turn it into income. Doesn\'t matter how much — the point is proving I can get paid for what I know.',
    startDate: '2024-01-01', closedDate: '2025-03-15', status: 'closed',
    conditions: [
      { text: 'Landed first paying client', done: true },
      { text: 'Repeated income 3 months in a row', done: true },
      { text: 'Can explain what I sell in one sentence', done: true },
    ],
  },
  {
    id: genId(), order: 1,
    name: 'Live cheaply, stack runway',
    purpose: 'Cut lifestyle costs to the bone so every euro earned goes to runway. Freedom comes from needing less, not earning more — for now.',
    startDate: '2025-03-16', closedDate: null, status: 'active',
    conditions: [
      { text: 'Monthly burn under €1,500 for 3 consecutive months', done: true },
      { text: '6 months of runway saved', done: false },
      { text: 'No lifestyle creep after an income spike', done: false },
    ],
  },
  {
    id: genId(), order: 2,
    name: 'Accumulate a high-paying skill',
    purpose: 'Go deep on one skill that commands premium rates. Volume of focused practice, not breadth.',
    startDate: null, closedDate: null, status: 'future',
    conditions: [
      { text: '1,000 hours of deliberate practice logged', done: false },
      { text: 'Earning 2x my starting rate', done: false },
      { text: 'Recognized by peers (referrals, testimonials)', done: false },
    ],
  },
  {
    id: genId(), order: 3,
    name: 'Become an experienced operator',
    purpose: 'Run a real operation — team, clients, systems. Not just a freelancer with a laptop.',
    startDate: null, closedDate: null, status: 'future',
    conditions: [
      { text: 'Managing at least 2 people', done: false },
      { text: 'Revenue from systems, not just my hours', done: false },
      { text: 'Can step away for 2 weeks without things breaking', done: false },
    ],
  },
];

// ── Main component ──────────────────────────────────────────────────────────
function GoalsView() {
  const [chapters, setChapters] = useState([]);
  const [showManage, setShowManage] = useState(false);
  const [closePrompt, setClosePrompt] = useState(null); // chapter id being closed

  useEffect(() => {
    let loaded = loadChapters();
    if (!loaded || loaded.length === 0) {
      loaded = DEMO_CHAPTERS;
      saveChapters(loaded);
    }
    setChapters(loaded);
  }, []);

  useEffect(() => {
    function handleRefresh() {
      const loaded = loadChapters();
      if (loaded) setChapters(loaded);
    }
    window.addEventListener('daytracker-data-refreshed', handleRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleRefresh);
  }, []);

  function save(next) { setChapters(next); saveChapters(next); }

  function toggleCondition(chapterId, condIndex) {
    save(chapters.map(ch => {
      if (ch.id !== chapterId) return ch;
      const conds = ch.conditions.map((c, i) => i === condIndex ? { ...c, done: !c.done } : c);
      return { ...ch, conditions: conds };
    }));
  }

  function closeChapter(chapterId) {
    const idx = chapters.findIndex(c => c.id === chapterId);
    if (idx < 0) return;
    const updated = [...chapters];
    updated[idx] = { ...updated[idx], status: 'closed', closedDate: todayStr() };
    // Activate next future chapter
    const nextFuture = updated.find(c => c.status === 'future');
    if (nextFuture) {
      const ni = updated.indexOf(nextFuture);
      updated[ni] = { ...nextFuture, status: 'active', startDate: todayStr() };
    }
    save(updated);
    setClosePrompt(null);
  }

  // Sort by order
  const sorted = [...chapters].sort((a, b) => a.order - b.order);
  const activeChapter = sorted.find(c => c.status === 'active');

  return (
    <div className="ch-root">
      {/* Header */}
      <div className="ch-header">
        <span className="ch-title">Chapters</span>
        <button className="ch-manage-btn" onClick={() => setShowManage(!showManage)}>
          {showManage ? 'Done' : 'Edit'}
        </button>
      </div>

      {/* The path */}
      <div className="ch-path">
        {sorted.map((ch, i) => {
          const isActive = ch.status === 'active';
          const isClosed = ch.status === 'closed';
          const isFuture = ch.status === 'future';
          const doneCount = ch.conditions.filter(c => c.done).length;
          const totalCount = ch.conditions.length;
          const allDone = totalCount > 0 && doneCount === totalCount;
          const elapsed = isActive ? daysSince(ch.startDate) : 0;
          const nextIdx = i + 1 < sorted.length ? i + 1 : -1;
          const isLast = i === sorted.length - 1;

          return (
            <div key={ch.id} className={`ch-step ${isActive ? 'ch-step-active' : ''} ${isClosed ? 'ch-step-closed' : ''} ${isFuture ? 'ch-step-future' : ''}`}>
              {/* Connector line */}
              {i > 0 && <div className={`ch-connector ${isClosed ? 'ch-connector-done' : isFuture ? 'ch-connector-future' : 'ch-connector-active'}`} />}

              {/* Node dot */}
              <div className="ch-node-row">
                <div className={`ch-node ${isClosed ? 'ch-node-done' : isActive ? 'ch-node-active' : 'ch-node-future'}`}>
                  {isClosed ? '✓' : isActive ? '' : ''}
                </div>
                <div className="ch-node-info">
                  {/* Closed chapter: single dim line */}
                  {isClosed && (
                    <div className="ch-closed-line">
                      <span className="ch-closed-name">{ch.name}</span>
                      <span className="ch-closed-years">{yearRange(ch.startDate, ch.closedDate)}</span>
                    </div>
                  )}

                  {/* Future chapter: dim label */}
                  {isFuture && (
                    <div className="ch-future-line">
                      <span className="ch-future-name">{ch.name}</span>
                      <span className="ch-future-label">{sorted.filter(c => c.status === 'future').indexOf(ch) === 0 ? 'next' : 'later'}</span>
                    </div>
                  )}

                  {/* Active chapter: the open card */}
                  {isActive && (
                    <div className="ch-active-card">
                      <div className="ch-active-header">
                        <div className="ch-active-title-row">
                          <span className="ch-active-name">{ch.name}</span>
                          <span className="ch-you-are-here">you are here</span>
                        </div>
                        <span className="ch-elapsed">{durationLabel(elapsed)} in this chapter</span>
                      </div>

                      {ch.purpose && (
                        <p className="ch-purpose">{ch.purpose}</p>
                      )}

                      <div className="ch-conditions">
                        <span className="ch-conditions-label">It's over when:</span>
                        {ch.conditions.map((cond, ci) => (
                          <label key={ci} className="ch-condition">
                            <input type="checkbox" checked={cond.done} onChange={() => toggleCondition(ch.id, ci)} />
                            <span className={cond.done ? 'ch-cond-done' : ''}>{cond.text}</span>
                          </label>
                        ))}
                      </div>

                      <div className="ch-progress-row">
                        <span className="ch-progress-text">{doneCount} of {totalCount}</span>
                        <div className="ch-progress-dots">
                          {ch.conditions.map((c, ci) => (
                            <div key={ci} className={`ch-dot ${c.done ? 'ch-dot-done' : 'ch-dot-empty'}`} />
                          ))}
                        </div>
                      </div>

                      {allDone && (
                        <button className="ch-close-btn" onClick={() => setClosePrompt(ch.id)}>
                          Close this chapter
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom connector for non-last items */}
              {!isLast && isActive && <div className="ch-connector ch-connector-future" />}
            </div>
          );
        })}
      </div>

      {/* Close chapter confirmation */}
      {closePrompt && (() => {
        const ch = chapters.find(c => c.id === closePrompt);
        const nextFuture = sorted.find(c => c.status === 'future');
        return (
          <div className="ch-modal-overlay" onClick={() => setClosePrompt(null)}>
            <div className="ch-modal" onClick={e => e.stopPropagation()}>
              <h3 className="ch-modal-title">Close this chapter?</h3>
              <p className="ch-modal-body">
                <strong>{ch?.name}</strong> — all conditions met. This chapter will be marked as complete
                {nextFuture ? <> and <strong>{nextFuture.name}</strong> becomes your active chapter.</> : '.'}
              </p>
              <div className="ch-modal-actions">
                <button className="ch-modal-cancel" onClick={() => setClosePrompt(null)}>Not yet</button>
                <button className="ch-modal-confirm" onClick={() => closeChapter(closePrompt)}>Close & move on</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Manage panel (add/reorder/edit) */}
      {showManage && (
        <ManagePanel chapters={sorted} onSave={save} />
      )}
    </div>
  );
}

// ── Manage Panel (behind a tap) ─────────────────────────────────────────────
function ManagePanel({ chapters, onSave }) {
  const [addOpen, setAddOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [newPurpose, setNewPurpose] = useState('');
  const [newConditions, setNewConditions] = useState(['']);
  const [editId, setEditId] = useState(null);
  const [editName, setEditName] = useState('');
  const [editPurpose, setEditPurpose] = useState('');
  const ref = useRef(null);

  useEffect(() => { if (addOpen && ref.current) ref.current.focus(); }, [addOpen]);

  function addChapter() {
    if (!newName.trim()) return;
    const conds = newConditions.filter(c => c.trim()).map(text => ({ text: text.trim(), done: false }));
    const maxOrder = chapters.length > 0 ? Math.max(...chapters.map(c => c.order)) : -1;
    const ch = {
      id: genId(), order: maxOrder + 1,
      name: newName.trim(), purpose: newPurpose.trim(),
      startDate: null, closedDate: null, status: 'future',
      conditions: conds.length > 0 ? conds : [{ text: 'Define conditions', done: false }],
    };
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

  function startEdit(ch) {
    setEditId(ch.id);
    setEditName(ch.name);
    setEditPurpose(ch.purpose || '');
  }

  function saveEdit() {
    if (!editName.trim()) return;
    onSave(chapters.map(c => c.id === editId ? { ...c, name: editName.trim(), purpose: editPurpose.trim() } : c));
    setEditId(null);
  }

  return (
    <div className="ch-manage">
      <div className="ch-manage-header">
        <span className="ch-manage-title">All Chapters</span>
      </div>

      <div className="ch-manage-list">
        {[...chapters].sort((a, b) => a.order - b.order).map((ch, i) => (
          <div key={ch.id} className="ch-manage-item">
            {editId === ch.id ? (
              <div className="ch-manage-edit">
                <input className="ch-manage-input" value={editName} onChange={e => setEditName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(); if (e.key === 'Escape') setEditId(null); }} />
                <textarea className="ch-manage-textarea" value={editPurpose} onChange={e => setEditPurpose(e.target.value)}
                  placeholder="What is this chapter for?" rows={2} />
                <div className="ch-manage-edit-actions">
                  <button onClick={saveEdit} className="ch-manage-save">Save</button>
                  <button onClick={() => setEditId(null)} className="ch-manage-cancel-btn">Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <div className="ch-manage-item-info">
                  <span className="ch-manage-order">{i + 1}</span>
                  <span className={`ch-manage-name ${ch.status === 'closed' ? 'ch-manage-closed' : ''}`}>{ch.name}</span>
                  <span className={`ch-manage-status ch-manage-status-${ch.status}`}>
                    {ch.status === 'active' ? 'now' : ch.status === 'closed' ? 'done' : ''}
                  </span>
                </div>
                <div className="ch-manage-item-actions">
                  <button onClick={() => moveChapter(ch.id, -1)} disabled={i === 0} title="Move up">↑</button>
                  <button onClick={() => moveChapter(ch.id, 1)} disabled={i === chapters.length - 1} title="Move down">↓</button>
                  <button onClick={() => startEdit(ch)} title="Edit">✎</button>
                  <button onClick={() => deleteChapter(ch.id)} className="ch-manage-delete" title="Delete">×</button>
                </div>
              </>
            )}
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
                  <button className="ch-add-cond-remove" onClick={() => setNewConditions(newConditions.filter((_, j) => j !== i))}>×</button>
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
