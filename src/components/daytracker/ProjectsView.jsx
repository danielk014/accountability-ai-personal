import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { useNavigate } from 'react-router-dom';

const STATUS_COLORS = {
  idea:      { bg: '#f1f5f9', text: '#64748b' },
  active:    { bg: '#dcfce7', text: '#15803d' },
  paused:    { bg: '#fef9c3', text: '#a16207' },
  completed: { bg: '#e0e7ff', text: '#4338ca' },
};

const STATUS_LABELS = {
  idea: 'Idea',
  active: 'Active',
  paused: 'Paused',
  completed: 'Completed',
};

function ProjectsView() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { data: user } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });

  const { data: projects = [], isLoading } = useQuery({
    queryKey: ['projects', user?.email],
    queryFn: () => base44.entities.Project.filter({ created_by: user.email }, '-created_at'),
    enabled: !!user?.email,
  });

  const { data: allTasks = [] } = useQuery({
    queryKey: ['projectTasks', user?.email],
    queryFn: () => base44.entities.ProjectTask.filter({ created_by: user.email }),
    enabled: !!user?.email,
  });

  const tasksByProject = useMemo(() => {
    const map = {};
    for (const t of allTasks) {
      if (!map[t.project_id]) map[t.project_id] = [];
      map[t.project_id].push(t);
    }
    return map;
  }, [allTasks]);

  const [filter, setFilter] = useState('All');
  const [dragIdx, setDragIdx] = useState(null);
  const [dragOverIdx, setDragOverIdx] = useState(null);

  const filtered = (filter === 'All'
    ? projects
    : projects.filter(p => p.status === filter.toLowerCase())
  ).sort((a, b) => (a.sort_order ?? 9999) - (b.sort_order ?? 9999));

  async function handleReorder(fromIdx, toIdx) {
    if (fromIdx === toIdx) return;
    const reordered = [...filtered];
    const [moved] = reordered.splice(fromIdx, 1);
    reordered.splice(toIdx, 0, moved);
    const updates = reordered.map((p, i) => ({ id: p.id, sort_order: i }));
    for (const u of updates) {
      queryClient.setQueryData(['projects', user?.email], (old = []) =>
        old.map(p => p.id === u.id ? { ...p, sort_order: u.sort_order } : p)
      );
    }
    await Promise.all(updates.map(u => base44.entities.Project.update(u.id, { sort_order: u.sort_order })));
    queryClient.invalidateQueries({ queryKey: ['projects'] });
  }

  function openInProjectsPage(project) {
    navigate('/Projects');
  }

  if (isLoading) {
    return (
      <div className="coach-empty">
        <p>Loading projects...</p>
      </div>
    );
  }

  return (
    <div>
      <div className="projects-header">
        <div>
          <h2 className="projects-title">Projects</h2>
          <p className="projects-subtitle">Linked to your Projects tab — click any project to open it there</p>
        </div>
        <button className="new-project-btn" onClick={() => navigate('/Projects')}>
          Open Projects
        </button>
      </div>

      <div className="projects-filters">
        <select value={filter} onChange={e => setFilter(e.target.value)} className="filter-select">
          <option>All</option>
          <option>Active</option>
          <option>Paused</option>
          <option>Idea</option>
          <option>Completed</option>
        </select>
        <span className="projects-count">{filtered.length} project{filtered.length !== 1 ? 's' : ''}</span>
      </div>

      <div className="projects-grid">
        {filtered.map((p, idx) => {
          const tasks = tasksByProject[p.id] || [];
          const done = tasks.filter(t => t.is_done).length;
          const total = tasks.length;
          const pct = total > 0 ? Math.round((done / total) * 100) : 0;
          const sc = STATUS_COLORS[p.status] || STATUS_COLORS.active;
          const label = STATUS_LABELS[p.status] || p.status;

          return (
            <div
              key={p.id}
              className="project-card"
              draggable
              onDragStart={() => setDragIdx(idx)}
              onDragOver={(e) => { e.preventDefault(); setDragOverIdx(idx); }}
              onDragLeave={() => setDragOverIdx(null)}
              onDrop={(e) => { e.preventDefault(); handleReorder(dragIdx, idx); setDragIdx(null); setDragOverIdx(null); }}
              onDragEnd={() => { setDragIdx(null); setDragOverIdx(null); }}
              onClick={() => openInProjectsPage(p)}
              style={{
                opacity: dragIdx === idx ? 0.4 : 1,
                border: dragOverIdx === idx && dragIdx !== idx ? '2px dashed #6366f1' : undefined,
                cursor: 'grab',
              }}
            >
              <div className="project-card-top">
                <span className="project-dot" style={{ background: p.color || '#6366f1' }} />
                <span
                  className="project-tag status"
                  style={{ background: sc.bg, color: sc.text }}
                >
                  {label}
                </span>
              </div>
              <h3 className="project-name">{p.name}</h3>
              {p.description && (
                <p style={{ fontSize: 12, color: '#888', marginBottom: 8, lineHeight: 1.4 }}>
                  {p.description.length > 80 ? p.description.slice(0, 80) + '…' : p.description}
                </p>
              )}
              <div className="project-progress-row">
                <span className="project-tasks-count">{done}/{total} tasks</span>
                <span className="project-pct">{pct}%</span>
              </div>
              <div className="project-progress-bar">
                <div className="project-progress-fill" style={{ width: `${pct}%`, background: p.color || '#6366f1' }} />
              </div>
              <div className="project-card-bottom">
                <span className="project-deadline">
                  {p.deadline ? formatDeadline(p.deadline) : 'No deadline'}
                </span>
                <span className="project-open-link">Open →</span>
              </div>
            </div>
          );
        })}
      </div>

      {filtered.length === 0 && (
        <div className="coach-empty" style={{ marginTop: 20 }}>
          <h3>No projects yet</h3>
          <p>Head to the Projects tab to create your first project.</p>
          <button
            className="new-project-btn"
            style={{ marginTop: 12 }}
            onClick={() => navigate('/Projects')}
          >
            Go to Projects
          </button>
        </div>
      )}
    </div>
  );
}

function formatDeadline(dateStr) {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export default ProjectsView;
