import { useState, useEffect, useRef, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { format } from 'date-fns';
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
const BLOCK_CATEGORIES = [
  { value: 'work', label: 'Work', color: '#f97316' },
  { value: 'sleep', label: 'Sleep', color: '#6366f1' },
  { value: 'personal', label: 'Personal', color: '#22c55e' },
  { value: 'other', label: 'Other', color: '#64748b' },
];

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
  const [newBlockCategory, setNewBlockCategory] = useState('other');
  const [newTaskCategory, setNewTaskCategory] = useState('other');
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [pickerMonth, setPickerMonth] = useState(null);
  const datePickerRef = useRef(null);

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

  // Fetch dashboard tasks from base44
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: dashboardTasks = [] } = useQuery({
    queryKey: ['tasks', me?.email],
    queryFn: () => me?.email ? base44.entities.Task.filter({ created_by: me.email }) : [],
    enabled: !!me?.email,
  });
  const { data: completions = [] } = useQuery({
    queryKey: ['completions', me?.email],
    queryFn: () => me?.email ? base44.entities.TaskCompletion.filter({ created_by: me.email }, '-completed_date', 500) : [],
    enabled: !!me?.email,
  });

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const todayCompletions = completions.filter(c => c.completed_date === todayStr);
  const completedTaskIds = new Set(todayCompletions.map(c => c.task_id));

  // Show active dashboard tasks: no date, or date within 1 week from today
  const oneWeekFromNow = format(new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd');
  const allDashboardTasks = dashboardTasks
    .filter(t => {
      if (t.is_active === false) return false;
      // No scheduled date — always show
      if (!t.scheduled_date) return true;
      // Has a date — only show if within 1 week
      return t.scheduled_date <= oneWeekFromNow;
    })
    .sort((a, b) => (a.scheduled_time || '99:99').localeCompare(b.scheduled_time || '99:99'));

  // Also fetch to-do items
  const { data: todoItems = [] } = useQuery({
    queryKey: ['todos', me?.email],
    queryFn: () => me?.email ? base44.entities.TodoItem.filter({ created_by: me.email }) : [],
    enabled: !!me?.email,
  });
  const pendingTodos = todoItems.filter(t => !t.is_done);

  const updateTodoMutation = useMutation({
    mutationFn: ({ id, data }) => base44.entities.TodoItem.update(id, data),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ['todos'] }),
  });

  const toggleDashboardCompletion = useMutation({
    mutationFn: async (task) => {
      if (completedTaskIds.has(task.id)) {
        const completion = todayCompletions.find(c => c.task_id === task.id);
        if (completion) {
          await base44.entities.TaskCompletion.delete(completion.id);
          const updates = { streak: Math.max(0, (task.streak || 0) - 1), total_completions: Math.max(0, (task.total_completions || 0) - 1) };
          if (task.frequency === 'once') updates.is_active = true;
          await base44.entities.Task.update(task.id, updates);
        }
      } else {
        await base44.entities.TaskCompletion.create({ task_id: task.id, task_name: task.name, completed_date: todayStr, completed_at: format(new Date(), 'HH:mm') });
        if (task.frequency === 'once') {
          await base44.entities.Task.delete(task.id);
        } else {
          const newStreak = (task.streak || 0) + 1;
          await base44.entities.Task.update(task.id, { streak: newStreak, best_streak: Math.max(newStreak, task.best_streak || 0), total_completions: (task.total_completions || 0) + 1 });
        }
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['tasks'] });
      queryClient.invalidateQueries({ queryKey: ['completions'] });
    },
  });

  // Close date picker on click outside
  useEffect(() => {
    if (!showDatePicker) return;
    function onClickOutside(e) {
      if (datePickerRef.current && !datePickerRef.current.contains(e.target)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [showDatePicker]);

  function shiftDate(days) {
    const d = new Date(date + 'T12:00:00');
    d.setDate(d.getDate() + days);
    setDate(getDateStr(d));
  }

  function openDatePicker() {
    const d = new Date(date + 'T12:00:00');
    setPickerMonth({ year: d.getFullYear(), month: d.getMonth() });
    setShowDatePicker(!showDatePicker);
  }

  function selectPickerDate(dateStr) {
    setDate(dateStr);
    setShowDatePicker(false);
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
      const newRecurring = { id: Date.now(), text: newTaskText.trim(), done: false, color: newTaskColor, blockCategory: newTaskCategory };
      const updated = [...recurringTasks, newRecurring];
      setRecurringTasks(updated);
      saveRecurringTasks(updated);
    } else {
      const updated = [...tasks, { id: Date.now(), text: newTaskText.trim(), done: false, color: newTaskColor, blockCategory: newTaskCategory }];
      setTasks(updated);
      saveDailyTasks(date, updated);
    }
    setNewTaskText('');
    setNewTaskColor(TASK_COLORS[0]);
    setNewTaskRecurring(false);
    setNewTaskCategory('other');
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
    setNewBlockCategory('other');
    setTimeout(() => blockInputRef.current?.focus(), 50);
  }

  function addBlockAtHour() {
    if (!newBlockText.trim() || addingAtHour === null) return;
    const catConfig = BLOCK_CATEGORIES.find(c => c.value === newBlockCategory);
    const newBlock = {
      id: Date.now(),
      text: newBlockText.trim(),
      startHour: addingAtHour,
      endHour: Math.min(addingAtHour + 1, 24),
      color: catConfig?.color || ACTUAL_COLOR,
      type: 'actual',
      blockCategory: newBlockCategory,
    };
    updateBlocks([...blocks, newBlock]);
    setAddingAtHour(null);
    setNewBlockText('');
    setNewBlockCategory('other');
  }

  // Add a sleep block that spans midnight — splits across two days
  function addSleepBlock(startHour, endHourNextDay) {
    const sleepCat = BLOCK_CATEGORIES.find(c => c.value === 'sleep');
    // Evening portion on current day
    if (startHour < 24) {
      const eveningBlock = {
        id: Date.now(),
        text: 'Sleep',
        startHour: startHour,
        endHour: 24,
        color: sleepCat?.color || '#6366f1',
        type: 'actual',
        blockCategory: 'sleep',
      };
      updateBlocks([...blocks, eveningBlock]);
    }
    // Morning portion on next day
    if (endHourNextDay > 0) {
      const nextDate = new Date(date + 'T12:00:00');
      nextDate.setDate(nextDate.getDate() + 1);
      const nextDateStr = getDateStr(nextDate);
      const nextBlocks = loadBlocks(nextDateStr);
      const morningBlock = {
        id: Date.now() + 1,
        text: 'Sleep',
        startHour: 0,
        endHour: endHourNextDay,
        color: sleepCat?.color || '#6366f1',
        type: 'actual',
        blockCategory: 'sleep',
      };
      saveBlocks(nextDateStr, [...nextBlocks, morningBlock]);
    }
  }

  function dropTaskAtHour(task, hour) {
    const taskCat = task.blockCategory || 'other';
    const catConfig = BLOCK_CATEGORIES.find(c => c.value === taskCat);
    const colorIdx = blocks.length % BLOCK_COLORS.length;
    const newBlock = {
      id: Date.now(),
      text: task.text || task.name || 'Task',
      startHour: hour,
      endHour: Math.min(hour + 1, 24),
      color: catConfig?.color || (task.color && task.color !== '#1a1a1a' ? task.color : BLOCK_COLORS[colorIdx]),
      type: 'planned',
      blockCategory: taskCat,
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
    e.dataTransfer.setData('text/plain', task.text || task.name || '');
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

  // Calculate sleep and work hours from blocks using blockCategory
  const sleepHours = blocks
    .filter(b => b.blockCategory === 'sleep')
    .reduce((sum, b) => sum + (b.endHour - b.startHour), 0);
  const workHours = blocks
    .filter(b => b.blockCategory === 'work')
    .reduce((sum, b) => sum + (b.endHour - b.startHour), 0);

  return (
    <div>
      <div className="date-nav" style={{ position: 'relative' }}>
        <button onClick={() => shiftDate(-1)}>&larr;</button>
        <span className="date-nav-label" onClick={openDatePicker} style={{ cursor: 'pointer' }}>
          {formatDate(date)} <span style={{ fontSize: 10, opacity: 0.5 }}>{showDatePicker ? '\u25B2' : '\u25BC'}</span>
        </span>
        <button onClick={() => shiftDate(1)}>&rarr;</button>

        {showDatePicker && pickerMonth && (
          <div className="schedule-date-picker" ref={datePickerRef}>
            <div className="sdp-header">
              <button className="sdp-nav" onClick={() => setPickerMonth(p => {
                const d = new Date(p.year, p.month - 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>&larr;</button>
              <span className="sdp-title">
                {new Date(pickerMonth.year, pickerMonth.month).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </span>
              <button className="sdp-nav" onClick={() => setPickerMonth(p => {
                const d = new Date(p.year, p.month + 1, 1);
                return { year: d.getFullYear(), month: d.getMonth() };
              })}>&rarr;</button>
            </div>
            <div className="sdp-days-header">
              {['Mo','Tu','We','Th','Fr','Sa','Su'].map(d => <div key={d} className="sdp-day-name">{d}</div>)}
            </div>
            <div className="sdp-grid">
              {(() => {
                const yr = pickerMonth.year, mo = pickerMonth.month;
                const firstDay = new Date(yr, mo, 1);
                let startDow = firstDay.getDay() - 1;
                if (startDow < 0) startDow = 6;
                const daysInMonth = new Date(yr, mo + 1, 0).getDate();
                const cells = [];
                for (let i = 0; i < startDow; i++) cells.push(null);
                for (let d = 1; d <= daysInMonth; d++) {
                  const ds = `${yr}-${String(mo + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
                  cells.push(ds);
                }
                return cells.map((ds, i) => {
                  if (!ds) return <div key={`e${i}`} className="sdp-cell empty" />;
                  const dayNum = parseInt(ds.split('-')[2]);
                  const isSelected = ds === date;
                  const isToday = ds === today;
                  return (
                    <div
                      key={ds}
                      className={`sdp-cell ${isSelected ? 'selected' : ''} ${isToday ? 'today' : ''}`}
                      onClick={() => selectPickerDate(ds)}
                    >
                      {dayNum}
                    </div>
                  );
                });
              })()}
            </div>
            <button className="sdp-today-btn" onClick={() => { selectPickerDate(today); }}>Go to Today</button>
          </div>
        )}
      </div>

      {blocks.length > 0 && (sleepHours > 0 || workHours > 0) && (
        <div className="daily-stats-row">
          {sleepHours > 0 && (
            <div className="daily-stat-chip sleep">
              <span className="daily-stat-icon">&#x1F4A4;</span>
              <span className="daily-stat-value">{sleepHours}h</span>
              <span className="daily-stat-label">sleep</span>
            </div>
          )}
          {workHours > 0 && (
            <div className="daily-stat-chip work">
              <span className="daily-stat-icon">&#x1F4BC;</span>
              <span className="daily-stat-value">{workHours}h</span>
              <span className="daily-stat-label">work</span>
            </div>
          )}
          <div className="daily-stat-chip total">
            <span className="daily-stat-icon">&#x23F1;</span>
            <span className="daily-stat-value">{blocks.reduce((s, b) => s + (b.endHour - b.startHour), 0)}h</span>
            <span className="daily-stat-label">logged</span>
          </div>
        </div>
      )}

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
                style={{ top: addingAtHour * ROW_HEIGHT, minHeight: ROW_HEIGHT }}
              >
                <div className="inline-block-row">
                  <input
                    ref={blockInputRef}
                    className="inline-block-input"
                    value={newBlockText}
                    onChange={e => setNewBlockText(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') addBlockAtHour();
                      if (e.key === 'Escape') setAddingAtHour(null);
                    }}
                    placeholder="What did you do?"
                  />
                  <button className="inline-block-add" onClick={addBlockAtHour}>+</button>
                </div>
                <div className="inline-block-cats">
                  {BLOCK_CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      className={`inline-cat-btn ${newBlockCategory === c.value ? 'active' : ''}`}
                      style={newBlockCategory === c.value ? { background: c.color, color: '#fff', borderColor: c.color } : {}}
                      onClick={() => setNewBlockCategory(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
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
          {/* Dashboard Habits/Tasks */}
          {allDashboardTasks.length > 0 && (
            <div className="dashboard-tasks-section">
              <div className="dashboard-tasks-title">
                <span style={{ color: '#6366f1' }}>&#x2605;</span>
                <span>Dashboard Tasks</span>
                <span className="daily-tasks-badge">{allDashboardTasks.length}</span>
              </div>
              {allDashboardTasks.map(task => {
                const isDone = completedTaskIds.has(task.id);
                return (
                  <div
                    key={task.id}
                    className={`dashboard-task-item ${isDone ? 'completed' : ''}`}
                    draggable
                    onDragStart={e => handleDragStart(e, { ...task, text: task.name })}
                    onDragEnd={handleDragEnd}
                    onClick={() => toggleDashboardCompletion.mutate(task)}
                  >
                    <div className="daily-task-grip" style={{ fontSize: 10, opacity: 0.4 }}>&#x2802;&#x2802;</div>
                    <div className={`dashboard-task-check ${isDone ? 'checked' : ''}`}>
                      {isDone ? '\u2713' : ''}
                    </div>
                    <span className="dashboard-task-name">{task.name}</span>
                    {task.scheduled_time && <span className="dashboard-task-time">{task.scheduled_time}</span>}
                    {task.category && <span className="dashboard-task-category">{task.category}</span>}
                  </div>
                );
              })}
            </div>
          )}

          {/* Dashboard To-Do Items */}
          {pendingTodos.length > 0 && (
            <div className="dashboard-tasks-section">
              <div className="dashboard-tasks-title">
                <span style={{ color: '#22c55e' }}>&#x2611;</span>
                <span>To-Do List</span>
                <span className="daily-tasks-badge" style={{ background: '#22c55e' }}>{pendingTodos.length}</span>
              </div>
              {pendingTodos.map(item => (
                <div
                  key={item.id}
                  className="dashboard-task-item"
                  draggable
                  onDragStart={e => handleDragStart(e, { ...item, text: item.name })}
                  onDragEnd={handleDragEnd}
                  onClick={() => updateTodoMutation.mutate({ id: item.id, data: { is_done: true, completed_at: new Date().toISOString() } })}
                >
                  <div className="daily-task-grip" style={{ fontSize: 10, opacity: 0.4 }}>&#x2802;&#x2802;</div>
                  <div className="dashboard-task-check">
                  </div>
                  <span className="dashboard-task-name">{item.name}</span>
                  {item.due_date && <span className="dashboard-task-time">{item.due_date}</span>}
                  {item.category && <span className="dashboard-task-category">{item.category}</span>}
                </div>
              ))}
            </div>
          )}

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
                <div className="inline-block-cats" style={{ marginBottom: 6 }}>
                  {BLOCK_CATEGORIES.map(c => (
                    <button
                      key={c.value}
                      className={`inline-cat-btn ${newTaskCategory === c.value ? 'active' : ''}`}
                      style={newTaskCategory === c.value ? { background: c.color, color: '#fff', borderColor: c.color } : {}}
                      onClick={() => setNewTaskCategory(c.value)}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
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

        <label>Category</label>
        <div className="inline-block-cats" style={{ marginTop: 4, marginBottom: 8 }}>
          {BLOCK_CATEGORIES.map(c => (
            <button
              key={c.value}
              className={`inline-cat-btn ${(block.blockCategory || 'other') === c.value ? 'active' : ''}`}
              style={(block.blockCategory || 'other') === c.value ? { background: c.color, color: '#fff', borderColor: c.color } : {}}
              onClick={() => onUpdate({ blockCategory: c.value, color: c.color })}
            >
              {c.label}
            </button>
          ))}
        </div>

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
