import { useState, useEffect, useRef, useCallback } from 'react';
import {
  getDateStr,
  loadDailyTasks, saveDailyTasks,
  loadRecurringTasks, saveRecurringTasks,
  loadBlocks, saveBlocks
} from './storage';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const TASK_COLORS = ['#f1f5f9', '#d4edda', '#cce5ff', '#fff3cd', '#f8d7da', '#e2d9f3'];
const BLOCK_COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316'];
const ACTUAL_COLOR = '#64748b';
const ROW_HEIGHT = 48;
const LONG_PRESS_MS = 300;

function formatHour(h) {
  if (h === 0) return '12 AM';
  if (h < 12) return `${h} AM`;
  if (h === 12) return '12 PM';
  return `${h - 12} PM`;
}

function getY(e) {
  if (e.touches && e.touches.length > 0) return e.touches[0].clientY;
  if (e.changedTouches && e.changedTouches.length > 0) return e.changedTouches[0].clientY;
  return e.clientY;
}

function DailyView({ overrideDate }) {
  const today = getDateStr();
  const [date, setDate] = useState(overrideDate || today);
  const [tasks, setTasks] = useState([]);
  const [recurringTasks, setRecurringTasks] = useState([]);
  const [blocks, setBlocks] = useState([]);
  const [showAddTask, setShowAddTask] = useState(false);
  const [newTaskText, setNewTaskText] = useState('');
  const [newTaskColor, setNewTaskColor] = useState(TASK_COLORS[0]);
  const [newTaskRecurring, setNewTaskRecurring] = useState(false);
  const [editingBlock, setEditingBlock] = useState(null);
  const [addingAtHour, setAddingAtHour] = useState(null);
  const [newBlockText, setNewBlockText] = useState('');

  const [touchDraggingTask, setTouchDraggingTask] = useState(null);
  const [touchDragHour, setTouchDragHour] = useState(null);
  const [ghostPos, setGhostPos] = useState(null);
  const [draggingTask, setDraggingTask] = useState(null);
  const [dropHour, setDropHour] = useState(null);

  const currentRef = useRef(null);
  const taskInputRef = useRef(null);
  const blockInputRef = useRef(null);
  const scheduleRef = useRef(null);
  const longPressTimer = useRef(null);
  const touchStartPos = useRef(null);

  useEffect(() => {
    if (overrideDate) setDate(overrideDate);
  }, [overrideDate]);

  useEffect(() => {
    setTasks(loadDailyTasks(date));
    setRecurringTasks(loadRecurringTasks());
    setBlocks(loadBlocks(date));
  }, [date]);

  // Re-load data when another device syncs changes via Supabase realtime
  useEffect(() => {
    function handleDataRefresh() {
      setTasks(loadDailyTasks(date));
      setRecurringTasks(loadRecurringTasks());
      setBlocks(loadBlocks(date));
    }
    window.addEventListener('daytracker-data-refreshed', handleDataRefresh);
    return () => window.removeEventListener('daytracker-data-refreshed', handleDataRefresh);
  }, [date]);

  useEffect(() => {
    if (date === today && currentRef.current) {
      currentRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [date, today]);

  const currentHour = date === today ? new Date().getHours() : -1;

  function shiftDate(days) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(getDateStr(d));
  }

  function formatDate(dateStr) {
    const d = new Date(dateStr + 'T12:00:00');
    const opts = { weekday: 'long', month: 'long', day: 'numeric' };
    const label = d.toLocaleDateString('en-US', opts);
    return dateStr === today ? `${label} (Today)` : label;
  }

  const allTasks = [
    ...tasks,
    ...recurringTasks.filter(rt => !tasks.some(t => t.recurringId === rt.id)).map(rt => ({
      ...rt,
      recurringId: rt.id,
      isRecurring: true,
    }))
  ];

  function addTask() {
    if (!newTaskText.trim()) return;
    if (newTaskRecurring) {
      const newRecurring = { id: Date.now(), text: newTaskText.trim(), done: false, color: newTaskColor };
      const updated = [...recurringTasks, newRecurring];
      setRecurringTasks(updated);
      saveRecurringTasks(updated);
    } else {
      const updated = [...tasks, { id: Date.now(), text: newTaskText.trim(), done: false, color: newTaskColor }];
      setTasks(updated);
      saveDailyTasks(date, updated);
    }
    setNewTaskText('');
    setNewTaskColor(TASK_COLORS[0]);
    setNewTaskRecurring(false);
    setShowAddTask(false);
  }

  function toggleTask(task) {
    if (task.isRecurring) {
      const dailyVersion = { ...task, id: Date.now(), recurringId: task.recurringId || task.id, done: !task.done };
      const updated = [...tasks, dailyVersion];
      setTasks(updated);
      saveDailyTasks(date, updated);
    } else {
      const updated = tasks.map(t => t.id === task.id ? { ...t, done: !t.done } : t);
      setTasks(updated);
      saveDailyTasks(date, updated);
    }
  }

  const [confirmDeleteId, setConfirmDeleteId] = useState(null);
  const confirmTimerRef = useRef(null);

  function removeTask(task) {
    const taskKey = task.recurringId || task.id;
    if (confirmDeleteId !== taskKey) {
      setConfirmDeleteId(taskKey);
      clearTimeout(confirmTimerRef.current);
      confirmTimerRef.current = setTimeout(() => setConfirmDeleteId(null), 3000);
      return;
    }
    clearTimeout(confirmTimerRef.current);
    setConfirmDeleteId(null);
    if (task.isRecurring) {
      const updated = recurringTasks.filter(t => t.id !== (task.recurringId || task.id));
      setRecurringTasks(updated);
      saveRecurringTasks(updated);
    } else {
      const updated = tasks.filter(t => t.id !== task.id);
      setTasks(updated);
      saveDailyTasks(date, updated);
    }
  }

  function updateBlocks(newBlocks) {
    setBlocks(newBlocks);
    saveBlocks(date, newBlocks);
  }

  function removeBlock(blockId) {
    updateBlocks(blocks.filter(b => b.id !== blockId));
    setEditingBlock(null);
  }

  function handleHourClick(hour) {
    if (touchDraggingTask) return;
    const hasBlock = blocks.some(b => hour >= b.startHour && hour < b.endHour);
    if (hasBlock) return;
    setAddingAtHour(hour);
    setNewBlockText('');
    setTimeout(() => blockInputRef.current?.focus(), 50);
  }

  function addBlockAtHour() {
    if (!newBlockText.trim() || addingAtHour === null) return;
    const newBlock = {
      id: Date.now(),
      text: newBlockText.trim(),
      startHour: addingAtHour,
      endHour: Math.min(addingAtHour + 1, 24),
      color: ACTUAL_COLOR,
      type: 'actual',
    };
    updateBlocks([...blocks, newBlock]);
    setAddingAtHour(null);
    setNewBlockText('');
  }

  function dropTaskAtHour(task, hour) {
    const colorIdx = blocks.length % BLOCK_COLORS.length;
    const newBlock = {
      id: Date.now(),
      text: task.text,
      startHour: hour,
      endHour: Math.min(hour + 1, 24),
      color: task.color && task.color !== '#1a1a1a'
        ? task.color
        : BLOCK_COLORS[colorIdx],
      type: 'planned',
    };
    updateBlocks([...blocks, newBlock]);
  }

  function getHourFromY(clientY) {
    if (!scheduleRef.current) return null;
    const rect = scheduleRef.current.getBoundingClientRect();
    const y = clientY - rect.top + scheduleRef.current.scrollTop;
    const hour = Math.floor(y / ROW_HEIGHT);
    return Math.max(0, Math.min(23, hour));
  }

  function handleTaskTouchStart(e, task) {
    const y = getY(e);
    const x = e.touches[0].clientX;
    touchStartPos.current = { x, y };

    longPressTimer.current = setTimeout(() => {
      setTouchDraggingTask(task);
      setGhostPos({ x, y });
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_PRESS_MS);
  }

  function handleTaskTouchMove(e, task) {
    const y = getY(e);
    const x = e.touches[0].clientX;

    if (!touchDraggingTask) {
      if (touchStartPos.current) {
        const dx = Math.abs(x - touchStartPos.current.x);
        const dy = Math.abs(y - touchStartPos.current.y);
        if (dx > 10 || dy > 10) {
          clearTimeout(longPressTimer.current);
        }
      }
      return;
    }

    e.preventDefault();
    setGhostPos({ x, y });
    const hour = getHourFromY(y);
    setTouchDragHour(hour);
  }

  function handleTaskTouchEnd(e) {
    clearTimeout(longPressTimer.current);

    if (touchDraggingTask && touchDragHour !== null) {
      dropTaskAtHour(touchDraggingTask, touchDragHour);
    }

    setTouchDraggingTask(null);
    setTouchDragHour(null);
    setGhostPos(null);
    touchStartPos.current = null;
  }

  function handleDragStart(e, task) {
    setDraggingTask(task);
    e.dataTransfer.effectAllowed = 'copy';
    e.dataTransfer.setData('text/plain', task.text);
  }

  function handleDragOver(e, hour) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    setDropHour(hour);
  }

  function handleDragLeave() {
    setDropHour(null);
  }

  function handleDrop(e, hour) {
    e.preventDefault();
    setDropHour(null);
    if (draggingTask) {
      dropTaskAtHour(draggingTask, hour);
      setDraggingTask(null);
    }
  }

  function handleDragEnd() {
    setDraggingTask(null);
    setDropHour(null);
  }

  const handleResizeBottom = useCallback((e, block) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = getY(e);
    const origEnd = block.endHour;

    function onMove(ev) {
      ev.preventDefault();
      const dy = getY(ev) - startY;
      const hourDelta = Math.round(dy / ROW_HEIGHT);
      const newEnd = Math.max(block.startHour + 1, Math.min(24, origEnd + hourDelta));
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, endHour: newEnd } : b));
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      setBlocks(prev => { saveBlocks(date, prev); return prev; });
    }

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [date]);

  const handleResizeTop = useCallback((e, block) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = getY(e);
    const origStart = block.startHour;

    function onMove(ev) {
      ev.preventDefault();
      const dy = getY(ev) - startY;
      const hourDelta = Math.round(dy / ROW_HEIGHT);
      const newStart = Math.max(0, Math.min(block.endHour - 1, origStart + hourDelta));
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, startHour: newStart } : b));
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      setBlocks(prev => { saveBlocks(date, prev); return prev; });
    }

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [date]);

  const handleBlockMove = useCallback((e, block) => {
    e.stopPropagation();
    e.preventDefault();
    const startY = getY(e);
    const origStart = block.startHour;
    const duration = block.endHour - block.startHour;
    let moved = false;

    function onMove(ev) {
      ev.preventDefault();
      moved = true;
      const dy = getY(ev) - startY;
      const hourDelta = Math.round(dy / ROW_HEIGHT);
      let newStart = origStart + hourDelta;
      newStart = Math.max(0, Math.min(24 - duration, newStart));
      setBlocks(prev => prev.map(b => b.id === block.id ? { ...b, startHour: newStart, endHour: newStart + duration } : b));
    }

    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      document.removeEventListener('touchmove', onMove);
      document.removeEventListener('touchend', onUp);
      setBlocks(prev => { saveBlocks(date, prev); return prev; });
      if (!moved) {
        setEditingBlock(block);
      }
    }

    document.addEventListener('mousemove', onMove, { passive: false });
    document.addEventListener('mouseup', onUp);
    document.addEventListener('touchmove', onMove, { passive: false });
    document.addEventListener('touchend', onUp);
  }, [date]);

  const doneCount = allTasks.filter(t => t.done).length;
  const activeDropHour = touchDragHour !== null ? touchDragHour : dropHour;

  return (
    <div>
      <div className="date-nav">
        <button onClick={() => shiftDate(-1)}>&larr;</button>
        <span>{formatDate(date)}</span>
        <button onClick={() => shiftDate(1)}>&rarr;</button>
      </div>

      <div className="daily-split">
        <div className="daily-schedule-panel">
          <p className="section-header" style={{ marginBottom: 8 }}>Schedule</p>

          <div className="schedule-grid" ref={scheduleRef}>
            {blocks.map(block => {
              const top = block.startHour * ROW_HEIGHT;
              const height = (block.endHour - block.startHour) * ROW_HEIGHT;
              return (
                <div
                  key={block.id}
                  className={`time-block ${block.type === 'actual' ? 'actual' : ''}`}
                  style={{ top, height, background: block.color || BLOCK_COLORS[0] }}
                >
                  <div
                    className="time-block-resize top"
                    onMouseDown={e => handleResizeTop(e, block)}
                    onTouchStart={e => handleResizeTop(e, block)}
                  >
                    <div className="resize-dots">···</div>
                  </div>

                  <div
                    className="time-block-body"
                    onMouseDown={e => handleBlockMove(e, block)}
                    onTouchStart={e => handleBlockMove(e, block)}
                  >
                    <div className="time-block-text">{block.text}</div>
                    {height >= 40 && (
                      <div className="time-block-range">
                        {formatHour(block.startHour)} – {formatHour(block.endHour)}
                        {' '}({block.endHour - block.startHour}h)
                      </div>
                    )}
                  </div>

                  <div
                    className="time-block-resize bottom"
                    onMouseDown={e => handleResizeBottom(e, block)}
                    onTouchStart={e => handleResizeBottom(e, block)}
                  >
                    <div className="resize-dots">···</div>
                  </div>
                </div>
              );
            })}

            {addingAtHour !== null && (
              <div
                className="inline-add-block"
                style={{ top: addingAtHour * ROW_HEIGHT, height: ROW_HEIGHT }}
              >
                <input
                  ref={blockInputRef}
                  className="inline-block-input"
                  value={newBlockText}
                  onChange={e => setNewBlockText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') addBlockAtHour();
                    if (e.key === 'Escape') setAddingAtHour(null);
                  }}
                  onBlur={() => { if (!newBlockText.trim()) setAddingAtHour(null); }}
                  placeholder="What did you do?"
                />
                <button className="inline-block-add" onClick={addBlockAtHour}>+</button>
              </div>
            )}

            {HOURS.map(h => {
              const isCurrent = h === currentHour;
              const isDropTarget = activeDropHour === h;
              const hasBlock = blocks.some(b => h >= b.startHour && h < b.endHour);

              return (
                <div
                  key={h}
                  ref={isCurrent ? currentRef : null}
                  className={`hour-row ${isCurrent ? 'current' : ''} ${isDropTarget ? 'drop-target' : ''}`}
                  style={{ height: ROW_HEIGHT }}
                  onClick={() => { if (!hasBlock) handleHourClick(h); }}
                  onDragOver={e => handleDragOver(e, h)}
                  onDragLeave={handleDragLeave}
                  onDrop={e => handleDrop(e, h)}
                >
                  <div className="hour-label">{formatHour(h)}</div>
                  <div className="hour-content">
                    <div className="hour-empty">
                      {isDropTarget ? 'Drop here' : !hasBlock ? 'tap to log' : ''}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="daily-tasks-panel">
          <div className="daily-tasks-section">
            <div className="daily-tasks-header">
              <div className="daily-tasks-title">
                <span className="daily-tasks-icon">&#x2726;</span>
                <span>Tasks</span>
                <span className="daily-tasks-badge">{allTasks.length}</span>
              </div>
              <button
                className="daily-tasks-add-btn"
                onClick={() => { setShowAddTask(true); setTimeout(() => taskInputRef.current?.focus(), 50); }}
              >
                + Add task
              </button>
            </div>

            {showAddTask && (
              <div className="daily-task-add-form">
                <input
                  ref={taskInputRef}
                  className="daily-task-add-input"
                  value={newTaskText}
                  onChange={e => setNewTaskText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') addTask(); if (e.key === 'Escape') setShowAddTask(false); }}
                  placeholder="What needs to get done?"
                />
                <div className="daily-task-add-row">
                  <div className="daily-task-color-picks">
                    {TASK_COLORS.map(c => (
                      <button
                        key={c}
                        className={`daily-task-color-btn ${newTaskColor === c ? 'selected' : ''}`}
                        style={{ background: c, border: c === '#1a1a1a' ? '1px solid #333' : '1px solid transparent' }}
                        onClick={() => setNewTaskColor(c)}
                      />
                    ))}
                  </div>
                  <button
                    className={`recurring-toggle ${newTaskRecurring ? 'active' : ''}`}
                    onClick={() => setNewTaskRecurring(!newTaskRecurring)}
                    title="Recurring (daily)"
                  >
                    &#x21BB; {newTaskRecurring ? 'Daily' : 'Once'}
                  </button>
                </div>
                <div style={{ display: 'flex', gap: 6, marginTop: 6, justifyContent: 'flex-end' }}>
                  <button className="btn-cancel" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => setShowAddTask(false)}>Cancel</button>
                  <button className="btn-save" style={{ padding: '4px 10px', fontSize: 12 }} onClick={addTask}>Add</button>
                </div>
              </div>
            )}

            <div className="daily-tasks-drag-hint">Hold &amp; drag onto schedule</div>

            {allTasks.length > 0 && (
              <div className="daily-tasks-list">
                {doneCount > 0 && (
                  <div className="daily-tasks-progress-text">{doneCount}/{allTasks.length} done</div>
                )}
                {allTasks.map(task => (
                  <div
                    key={task.id}
                    className={`daily-task-item ${task.done ? 'done' : ''} ${touchDraggingTask?.id === task.id ? 'dragging' : ''}`}
                    style={{ background: task.color || '#1a1a1a' }}
                    draggable
                    onDragStart={e => handleDragStart(e, task)}
                    onDragEnd={handleDragEnd}
                    onTouchStart={e => handleTaskTouchStart(e, task)}
                    onTouchMove={e => handleTaskTouchMove(e, task)}
                    onTouchEnd={handleTaskTouchEnd}
                  >
                    <div className="daily-task-grip">&#x2802;&#x2802;</div>
                    <button
                      className={`daily-task-check ${task.done ? 'checked' : ''}`}
                      onClick={() => toggleTask(task)}
                    >
                      {task.done ? '✓' : ''}
                    </button>
                    <span className={`daily-task-text ${task.done ? 'done-text' : ''}`}
                      style={{ color: task.color === '#f1f5f9' || task.color === TASK_COLORS[0] ? '#1e293b' : '#1e293b' }}
                    >
                      {task.text}
                    </span>
                    {task.isRecurring && <span className="recurring-badge">&#x21BB;</span>}
                    <button
                      className={`daily-task-delete ${confirmDeleteId === (task.recurringId || task.id) ? 'confirm' : ''}`}
                      onClick={() => removeTask(task)}
                    >
                      {confirmDeleteId === (task.recurringId || task.id) ? 'Delete?' : '\u00d7'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {allTasks.length === 0 && !showAddTask && (
              <div className="daily-tasks-empty">No tasks for this day</div>
            )}
          </div>
        </div>
      </div>

      {touchDraggingTask && ghostPos && (
        <div className="touch-drag-ghost" style={{ top: ghostPos.y - 20, left: ghostPos.x - 60 }}>
          {touchDraggingTask.text}
        </div>
      )}

      {editingBlock && (
        <BlockModal
          block={blocks.find(b => b.id === editingBlock.id) || editingBlock}
          onClose={() => setEditingBlock(null)}
          onDelete={() => removeBlock(editingBlock.id)}
          onUpdate={(changes) => {
            const updated = blocks.map(b => b.id === editingBlock.id ? { ...b, ...changes } : b);
            updateBlocks(updated);
            setEditingBlock({ ...editingBlock, ...changes });
          }}
        />
      )}
    </div>
  );
}

function BlockModal({ block, onClose, onDelete, onUpdate }) {
  const [text, setText] = useState(block.text);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <label>Task</label>
        <input
          className="modal-input"
          value={text}
          onChange={e => { setText(e.target.value); onUpdate({ text: e.target.value }); }}
        />

        <p style={{ color: '#888', fontSize: 13, margin: '12px 0 4px' }}>
          {formatHour(block.startHour)} – {formatHour(block.endHour)}
          {' '}({block.endHour - block.startHour}h)
        </p>

        <label>Start</label>
        <select
          className="modal-select"
          value={block.startHour}
          onChange={e => onUpdate({ startHour: Number(e.target.value), endHour: Math.max(Number(e.target.value) + 1, block.endHour) })}
        >
          {HOURS.map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
        </select>

        <label>End</label>
        <select
          className="modal-select"
          value={block.endHour}
          onChange={e => onUpdate({ endHour: Number(e.target.value) })}
        >
          {HOURS.filter(h => h > block.startHour).map(h => <option key={h} value={h}>{formatHour(h)}</option>)}
          <option value={24}>12 AM (next day)</option>
        </select>

        <div className="modal-actions" style={{ marginTop: 16 }}>
          <button className="btn-clear" onClick={onDelete}>Remove</button>
          <button className="btn-cancel" onClick={onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}

export default DailyView;
