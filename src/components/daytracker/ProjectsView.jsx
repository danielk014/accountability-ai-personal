import { useState, useEffect } from 'react';
import { loadProjects, saveProjects } from './storage';

const CATEGORIES = ['Business', 'School', 'Personal', 'Health', 'Finance', 'Side Hustle'];
const STATUSES = ['Active', 'Paused', 'Completed'];
const COLORS = ['#4a6cf7', '#22c55e', '#ef4444', '#f7c948', '#a855f7', '#6b7280'];

function ProjectsView() {
  const [projects, setProjects] = useState([]);
  const [openProject, setOpenProject] = useState(null);
  const [showNew, setShowNew] = useState(false);
  const [filter, setFilter] = useState('All');
  const [sort, setSort] = useState('Newest');

  useEffect(() => {
    setProjects(loadProjects());
  }, []);

  function update(next) {
    setProjects(next);
    saveProjects(next);
  }

  function addProject(project) {
    const next = [{ ...project, id: Date.now(), tasks: [], createdAt: new Date().toISOString() }, ...projects];
    update(next);
    setShowNew(false);
  }

  function updateProject(id, changes) {
    const next = projects.map(p => p.id === id ? { ...p, ...changes } : p);
    update(next);
    if (openProject?.id === id) setOpenProject({ ...openProject, ...changes });
  }

  function deleteProject(id) {
    update(projects.filter(p => p.id !== id));
    setOpenProject(null);
  }

  function addTask(projectId, taskText) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = [...project.tasks, { id: Date.now(), text: taskText, done: false }];
    updateProject(projectId, { tasks: newTasks });
  }

  function toggleTask(projectId, taskId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = project.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t);
    updateProject(projectId, { tasks: newTasks });
  }

  function removeTask(projectId, taskId) {
    const project = projects.find(p => p.id === projectId);
    if (!project) return;
    const newTasks = project.tasks.filter(t => t.id !== taskId);
    updateProject(projectId, { tasks: newTasks });
  }

  let filtered = filter === 'All' ? projects : projects.filter(p => p.status === filter);
  if (sort === 'Newest') {
    filtered = [...filtered].sort((a, b) => b.id - a.id);
  } else {
    filtered = [...filtered].sort((a, b) => a.name.localeCompare(b.name));
  }

  return (
    <div>
      <div className="projects-header">
        <div>
          <h2 className="projects-title">Projects</h2>
          <p className="projects-subtitle">Track your ventures, goals, and long-term work</p>
        </div>
        <button className="new-project-btn" onClick={() => setShowNew(true)}>
          + New Project
        </button>
      </div>

      <div className="projects-filters">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
          <option>All</option>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>
        <select value={sort} onChange={e => setSort(e.target.value)} className="filter-select">
          <option>Newest</option>
          <option>A-Z</option>
        </select>
        <span className="projects-count">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="projects-grid">
        {filtered.map(p => {
          const done = p.tasks.filter(t => t.done).length;
          const total = p.tasks.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;

          return (
            <div key={p.id} className="project-card" onClick={() => setOpenProject(p)}>
              <div className="project-card-top">
                <span className="project-dot" style={{ background: p.color || COLORS[0] }} />
                <span className="project-tag category">{p.category}</span>
                <span className={`project-tag status ${p.status.toLowerCase()}`}>{p.status}</span>
              </div>
              <h3 className="project-name">{p.name}</h3>
              <div className="project-progress-row">
                <span className="project-tasks-count">{done}/{total} tasks</span>
                <span className="project-pct">{pct}%</span>
              </div>
              <div className="project-progress-bar">
                <div className="project-progress-fill" style={{ width: `${pct}%`, background: p.color || COLORS[0] }} />
              </div>
              <div className="project-card-bottom">
                <span className="project-deadline">
                  {p.deadline ? formatDeadline(p.deadline) : 'No deadline'}
                </span>
                <span className="project-open-link">Open</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && !showNew && (
        <div className="coach-empty" style={{ marginTop: 20 }}>
          <h3>No projects yet</h3>
          <p>Create your first project to start tracking your ventures and goals.</p>
        </div>
      )}

      {showNew && (
        <NewProjectModal onSave={addProject} onClose={() => setShowNew(false)} />
      )}

      {openProject && (
        <ProjectDetail
          project={projects.find(p => p.id === openProject.id) || openProject}
          onClose={() => setOpenProject(null)}
          onUpdate={(changes) => updateProject(openProject.id, changes)}
          onDelete={() => deleteProject(openProject.id)}
          onAddTask={(text) => addTask(openProject.id, text)}
          onToggleTask={(taskId) => toggleTask(openProject.id, taskId)}
          onRemoveTask={(taskId) => removeTask(openProject.id, taskId)}
        />
      )}
    </div>
  );
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function NewProjectModal({ onSave, onClose }) {
  const [name, setName] = useState('');
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [status, setStatus] = useState('Active');
  const [color, setColor] = useState(COLORS[0]);
  const [deadline, setDeadline] = useState('');

  function handleSave() {
    if (!name.trim()) return;
    onSave({ name: name.trim(), category, status, color, deadline: deadline || null });
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>New Project</h3>

        <label>Project name</label>
        <input
          className="modal-input"
          value={name}
          onChange={e => setName(e.target.value)}
          placeholder="What are you building?"
          autoFocus
        />

        <label>Category</label>
        <select className="modal-select" value={category} onChange={e => setCategory(e.target.value)}>
          {CATEGORIES.map(c => <option key={c}>{c}</option>)}
        </select>

        <label>Status</label>
        <select className="modal-select" value={status} onChange={e => setStatus(e.target.value)}>
          {STATUSES.map(s => <option key={s}>{s}</option>)}
        </select>

        <label>Color</label>
        <div className="color-picker">
          {COLORS.map(c => (
            <button
              key={c}
              className={`color-btn ${color === c ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => setColor(c)}
            />
          ))}
        </div>

        <label>Deadline (optional)</label>
        <input
          type="date"
          className="modal-input"
          value={deadline}
          onChange={e => setDeadline(e.target.value)}
        />

        <div className="modal-actions">
          <button className="btn-cancel" onClick={onClose}>Cancel</button>
          <button className="btn-save" onClick={handleSave}>Create</button>
        </div>
      </div>
    </div>
  );
}

function ProjectDetail({ project, onClose, onUpdate, onDelete, onAddTask, onToggleTask, onRemoveTask }) {
  const [newTask, setNewTask] = useState('');
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(project.name);
  const [editCategory, setEditCategory] = useState(project.category);
  const [editStatus, setEditStatus] = useState(project.status);
  const [editDeadline, setEditDeadline] = useState(project.deadline || '');
  const [editColor, setEditColor] = useState(project.color || COLORS[0]);

  const done = project.tasks.filter(t => t.done).length;
  const total = project.tasks.length;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;

  function handleAddTask() {
    if (!newTask.trim()) return;
    onAddTask(newTask.trim());
    setNewTask('');
  }

  function saveEdits() {
    onUpdate({
      name: editName,
      category: editCategory,
      status: editStatus,
      deadline: editDeadline || null,
      color: editColor
    });
    setEditing(false);
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal project-detail-modal" onClick={e => e.stopPropagation()}>
        <div className="project-detail-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="project-dot" style={{ background: project.color || COLORS[0], width: 10, height: 10 }} />
            <span className="project-tag category">{project.category}</span>
            <span className={`project-tag status ${project.status.toLowerCase()}`}>{project.status}</span>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="icon-btn" onClick={() => setEditing(!editing)}>
              {editing ? 'Cancel' : 'Edit'}
            </button>
            <button className="icon-btn delete" onClick={() => { if (confirm('Delete this project?')) onDelete(); }}>
              Delete
            </button>
          </div>
        </div>

        {editing ? (
          <div>
            <label>Name</label>
            <input className="modal-input" value={editName} onChange={e => setEditName(e.target.value)} />
            <label>Category</label>
            <select className="modal-select" value={editCategory} onChange={e => setEditCategory(e.target.value)}>
              {CATEGORIES.map(c => <option key={c}>{c}</option>)}
            </select>
            <label>Status</label>
            <select className="modal-select" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
              {STATUSES.map(s => <option key={s}>{s}</option>)}
            </select>
            <label>Color</label>
            <div className="color-picker">
              {COLORS.map(c => (
                <button key={c} className={`color-btn ${editColor === c ? 'selected' : ''}`} style={{ background: c }} onClick={() => setEditColor(c)} />
              ))}
            </div>
            <label>Deadline</label>
            <input type="date" className="modal-input" value={editDeadline} onChange={e => setEditDeadline(e.target.value)} />
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setEditing(false)}>Cancel</button>
              <button className="btn-save" onClick={saveEdits}>Save</button>
            </div>
          </div>
        ) : (
          <>
            <h3 className="project-detail-name">{project.name}</h3>

            <div className="project-progress-row" style={{ marginTop: 8 }}>
              <span className="project-tasks-count">{done}/{total} tasks</span>
              <span className="project-pct">{pct}%</span>
            </div>
            <div className="project-progress-bar" style={{ marginBottom: 4 }}>
              <div className="project-progress-fill" style={{ width: `${pct}%`, background: project.color || COLORS[0] }} />
            </div>
            {project.deadline && (
              <p style={{ fontSize: 12, color: '#666', marginBottom: 12 }}>
                Deadline: {formatDeadline(project.deadline)}
              </p>
            )}

            <div className="project-tasks-section">
              <p className="section-header" style={{ marginTop: 16 }}>Tasks</p>

              {project.tasks.map(task => (
                <div key={task.id} className="project-task-item">
                  <button
                    className={`task-check ${task.done ? 'checked' : ''}`}
                    onClick={() => onToggleTask(task.id)}
                  >
                    {task.done ? '✓' : ''}
                  </button>
                  <span className={`task-text ${task.done ? 'done' : ''}`}>{task.text}</span>
                  <button className="goal-delete" onClick={() => onRemoveTask(task.id)}>&times;</button>
                </div>
              ))}

              <div className="add-task-row">
                <input
                  className="modal-input"
                  value={newTask}
                  onChange={e => setNewTask(e.target.value)}
                  placeholder="Add a task..."
                  onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
                />
                <button className="btn-save" style={{ minWidth: 60 }} onClick={handleAddTask}>Add</button>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: 20 }}>
              <button className="btn-cancel" onClick={onClose} style={{ flex: 1 }}>Close</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

export default ProjectsView;
