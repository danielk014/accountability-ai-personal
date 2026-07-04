import { useState, useRef, useEffect } from 'react';
import { loadNotes, saveNotes } from './storage';

const COLORS = ['#f7c948', '#4a6cf7', '#ef4444', '#22c55e', '#a855f7', '#ec4899'];

function NotesView() {
  const [notes, setNotes] = useState(() => loadNotes());
  const [selectedId, setSelectedId] = useState(null);
  const [search, setSearch] = useState('');
  const textareaRef = useRef(null);

  const selected = notes.find(n => n.id === selectedId);

  useEffect(() => {
    if (selected && textareaRef.current) {
      textareaRef.current.focus();
    }
  }, [selectedId]);

  function persist(updated) {
    setNotes(updated);
    saveNotes(updated);
  }

  function addNote() {
    const note = {
      id: Date.now().toString(),
      title: '',
      body: '',
      color: COLORS[0],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = [note, ...notes];
    persist(updated);
    setSelectedId(note.id);
  }

  function updateNote(id, changes) {
    const updated = notes.map(n =>
      n.id === id ? { ...n, ...changes, updatedAt: new Date().toISOString() } : n
    );
    persist(updated);
  }

  function deleteNote(id) {
    const updated = notes.filter(n => n.id !== id);
    persist(updated);
    if (selectedId === id) setSelectedId(null);
  }

  function getPreview(note) {
    const lines = note.body.split('\n').filter(l => l.trim());
    return lines.length > 0 ? lines[0].slice(0, 80) : 'New note';
  }

  function getTitle(note) {
    return note.title || getPreview(note);
  }

  function formatDate(iso) {
    const d = new Date(iso);
    const now = new Date();
    const diff = now - d;
    if (diff < 86400000 && d.getDate() === now.getDate()) {
      return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
    if (diff < 604800000) {
      return d.toLocaleDateString([], { weekday: 'short' });
    }
    return d.toLocaleDateString([], { month: 'short', day: 'numeric' });
  }

  const filtered = search
    ? notes.filter(n =>
        (n.title + ' ' + n.body).toLowerCase().includes(search.toLowerCase())
      )
    : notes;

  if (selected) {
    return (
      <div className="notes-editor">
        <div className="notes-editor-toolbar">
          <button className="notes-back-btn" onClick={() => setSelectedId(null)}>
            &larr; Notes
          </button>
          <div className="notes-editor-actions">
            <div className="notes-color-picks">
              {COLORS.map(c => (
                <button
                  key={c}
                  className={`notes-color-dot ${selected.color === c ? 'selected' : ''}`}
                  style={{ background: c }}
                  onClick={() => updateNote(selected.id, { color: c })}
                />
              ))}
            </div>
            <button
              className="notes-delete-btn"
              onClick={() => deleteNote(selected.id)}
            >
              Delete
            </button>
          </div>
        </div>
        <input
          className="notes-title-input"
          value={selected.title}
          onChange={e => updateNote(selected.id, { title: e.target.value })}
          placeholder="Title"
        />
        <textarea
          ref={textareaRef}
          className="notes-body-input"
          value={selected.body}
          onChange={e => updateNote(selected.id, { body: e.target.value })}
          placeholder="Start writing..."
        />
      </div>
    );
  }

  return (
    <div className="notes-container">
      <div className="notes-list-header">
        <h2 className="notes-list-title">Notes</h2>
        <button className="notes-new-btn" onClick={addNote}>+</button>
      </div>

      <input
        className="notes-search"
        value={search}
        onChange={e => setSearch(e.target.value)}
        placeholder="Search notes..."
      />

      <div className="notes-count">{filtered.length} {filtered.length === 1 ? 'note' : 'notes'}</div>

      <div className="notes-list">
        {filtered.map(note => (
          <div
            key={note.id}
            className="notes-list-item"
            onClick={() => setSelectedId(note.id)}
          >
            <div className="notes-item-color" style={{ background: note.color }} />
            <div className="notes-item-content">
              <div className="notes-item-title">{getTitle(note)}</div>
              <div className="notes-item-preview">
                {note.title ? getPreview(note) : (note.body.split('\n').filter(l => l.trim())[1] || '').slice(0, 60)}
              </div>
            </div>
            <div className="notes-item-date">{formatDate(note.updatedAt)}</div>
          </div>
        ))}
        {filtered.length === 0 && (
          <div className="notes-empty">
            {search ? 'No matching notes' : 'No notes yet. Tap + to create one.'}
          </div>
        )}
      </div>
    </div>
  );
}

export default NotesView;
