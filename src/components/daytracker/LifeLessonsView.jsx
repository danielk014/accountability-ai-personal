import { useState, useEffect, useRef } from 'react';
import { supabaseStorage } from '@/api/supabaseStorage';
import { getUserPrefix } from '@/lib/userStore';

const STORAGE_KEY_SUFFIX = 'dt_life_lessons_v1';
const CATEGORIES = ['General', 'Career', 'Relationships', 'Health', 'Money', 'Mindset', 'Social', 'Discipline', 'Failure', 'Success'];
const CATEGORY_COLORS = {
  General: '#64748b',
  Career: '#3b82f6',
  Relationships: '#ec4899',
  Health: '#22c55e',
  Money: '#eab308',
  Mindset: '#8b5cf6',
  Social: '#f97316',
  Discipline: '#ef4444',
  Failure: '#6b7280',
  Success: '#14b8a6',
};

function getStorageKey() {
  return `${getUserPrefix()}${STORAGE_KEY_SUFFIX}`;
}

export function loadLessons() {
  try {
    const raw = supabaseStorage.getItem(getStorageKey());
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLessons(lessons) {
  supabaseStorage.setItem(getStorageKey(), JSON.stringify(lessons));
}

export default function LifeLessonsView() {
  const [lessons, setLessons] = useState([]);
  const [showAdd, setShowAdd] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('All');
  const [expandedId, setExpandedId] = useState(null);

  const [form, setForm] = useState({
    title: '',
    lesson: '',
    context: '',
    category: 'General',
    source: '',
  });

  const titleRef = useRef(null);

  useEffect(() => {
    setLessons(loadLessons());
  }, []);

  function resetForm() {
    setForm({ title: '', lesson: '', context: '', category: 'General', source: '' });
    setEditingId(null);
    setShowAdd(false);
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!form.title.trim() || !form.lesson.trim()) return;

    let updated;
    if (editingId) {
      updated = lessons.map(l => l.id === editingId ? { ...l, ...form, updatedAt: Date.now() } : l);
    } else {
      const newLesson = {
        id: Date.now(),
        ...form,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        reviewCount: 0,
        lastReviewed: null,
      };
      updated = [newLesson, ...lessons];
    }
    setLessons(updated);
    saveLessons(updated);
    resetForm();
  }

  function handleEdit(lesson) {
    setForm({
      title: lesson.title,
      lesson: lesson.lesson,
      context: lesson.context || '',
      category: lesson.category || 'General',
      source: lesson.source || '',
    });
    setEditingId(lesson.id);
    setShowAdd(true);
    setTimeout(() => titleRef.current?.focus(), 50);
  }

  function handleDelete(id) {
    if (!window.confirm('Delete this life lesson?')) return;
    const updated = lessons.filter(l => l.id !== id);
    setLessons(updated);
    saveLessons(updated);
    if (editingId === id) resetForm();
  }

  function handleMarkReviewed(id) {
    const updated = lessons.map(l =>
      l.id === id ? { ...l, reviewCount: (l.reviewCount || 0) + 1, lastReviewed: Date.now() } : l
    );
    setLessons(updated);
    saveLessons(updated);
  }

  const filtered = lessons.filter(l => {
    if (filterCategory !== 'All' && l.category !== filterCategory) return false;
    if (search) {
      const s = search.toLowerCase();
      return l.title.toLowerCase().includes(s) || l.lesson.toLowerCase().includes(s) || (l.context || '').toLowerCase().includes(s);
    }
    return true;
  });

  return (
    <div className="life-lessons-container">
      <div className="ll-header">
        <div>
          <h2 className="ll-title">Life Lessons</h2>
          <p className="ll-subtitle">{lessons.length} lesson{lessons.length !== 1 ? 's' : ''} collected</p>
        </div>
        <button
          className="ll-add-btn"
          onClick={() => { resetForm(); setShowAdd(true); setTimeout(() => titleRef.current?.focus(), 50); }}
        >
          + New Lesson
        </button>
      </div>

      {/* Add/Edit Form */}
      {showAdd && (
        <form className="ll-form" onSubmit={handleSubmit}>
          <input
            ref={titleRef}
            className="ll-form-input ll-form-title"
            value={form.title}
            onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
            placeholder="The lesson in one line..."
            maxLength={200}
          />
          <textarea
            className="ll-form-input ll-form-body"
            value={form.lesson}
            onChange={e => setForm(f => ({ ...f, lesson: e.target.value }))}
            placeholder="Expand on the lesson. What did you learn? Why does it matter?"
            rows={4}
          />
          <textarea
            className="ll-form-input ll-form-context"
            value={form.context}
            onChange={e => setForm(f => ({ ...f, context: e.target.value }))}
            placeholder="Context: What happened that taught you this? (optional)"
            rows={2}
          />
          <div className="ll-form-row">
            <div className="ll-form-field">
              <label className="ll-form-label">Category</label>
              <select
                className="ll-form-select"
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
              >
                {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="ll-form-field">
              <label className="ll-form-label">Source (optional)</label>
              <input
                className="ll-form-input"
                value={form.source}
                onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                placeholder="Book, person, experience..."
              />
            </div>
          </div>
          <div className="ll-form-actions">
            <button type="button" className="btn-cancel" onClick={resetForm}>Cancel</button>
            <button type="submit" className="btn-save">{editingId ? 'Save Changes' : 'Add Lesson'}</button>
          </div>
        </form>
      )}

      {/* Search & Filter */}
      {lessons.length > 0 && (
        <div className="ll-controls">
          <input
            className="ll-search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search lessons..."
          />
          <div className="ll-filters">
            <button
              className={`ll-filter-chip ${filterCategory === 'All' ? 'active' : ''}`}
              onClick={() => setFilterCategory('All')}
            >
              All
            </button>
            {CATEGORIES.filter(c => lessons.some(l => l.category === c)).map(c => (
              <button
                key={c}
                className={`ll-filter-chip ${filterCategory === c ? 'active' : ''}`}
                onClick={() => setFilterCategory(filterCategory === c ? 'All' : c)}
                style={filterCategory === c ? { background: CATEGORY_COLORS[c] + '1a', borderColor: CATEGORY_COLORS[c], color: CATEGORY_COLORS[c] } : {}}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lessons List */}
      <div className="ll-list">
        {filtered.map(lesson => {
          const isExpanded = expandedId === lesson.id;
          const catColor = CATEGORY_COLORS[lesson.category] || '#64748b';
          return (
            <div key={lesson.id} className="ll-card" onClick={() => setExpandedId(isExpanded ? null : lesson.id)}>
              <div className="ll-card-accent" style={{ background: catColor }} />
              <div className="ll-card-content">
                <div className="ll-card-top">
                  <span className="ll-card-category" style={{ color: catColor, background: catColor + '15', borderColor: catColor + '30' }}>
                    {lesson.category}
                  </span>
                  {lesson.reviewCount > 0 && (
                    <span className="ll-card-reviews">
                      Reviewed {lesson.reviewCount}x
                    </span>
                  )}
                </div>

                <h3 className="ll-card-title">{lesson.title}</h3>

                <p className={`ll-card-lesson ${isExpanded ? '' : 'collapsed'}`}>
                  {lesson.lesson}
                </p>

                {isExpanded && (
                  <div className="ll-card-expanded">
                    {lesson.context && (
                      <div className="ll-card-context">
                        <span className="ll-card-context-label">Context:</span>
                        <span>{lesson.context}</span>
                      </div>
                    )}
                    {lesson.source && (
                      <div className="ll-card-source">
                        Source: {lesson.source}
                      </div>
                    )}
                    <div className="ll-card-meta">
                      <span className="ll-card-date">
                        Added {new Date(lesson.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                      {lesson.lastReviewed && (
                        <span className="ll-card-date">
                          Last reviewed {new Date(lesson.lastReviewed).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                    <div className="ll-card-actions">
                      <button className="ll-action-btn review" onClick={e => { e.stopPropagation(); handleMarkReviewed(lesson.id); }}>
                        Mark Reviewed
                      </button>
                      <button className="ll-action-btn edit" onClick={e => { e.stopPropagation(); handleEdit(lesson); }}>
                        Edit
                      </button>
                      <button className="ll-action-btn delete" onClick={e => { e.stopPropagation(); handleDelete(lesson.id); }}>
                        Delete
                      </button>
                    </div>
                  </div>
                )}

                {!isExpanded && lesson.lesson.length > 120 && (
                  <span className="ll-card-expand-hint">tap to expand</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && lessons.length > 0 && (
        <div className="ll-empty">No lessons match your search.</div>
      )}

      {lessons.length === 0 && !showAdd && (
        <div className="ll-empty-start">
          <h3>No lessons yet</h3>
          <p>Start capturing the lessons life teaches you. They compound over time.</p>
          <p style={{ marginTop: 8, fontSize: 12 }}>
            "The only real mistake is the one from which we learn nothing." - Henry Ford
          </p>
        </div>
      )}
    </div>
  );
}
