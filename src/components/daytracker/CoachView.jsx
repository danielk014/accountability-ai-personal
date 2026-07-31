import { useState, useRef, useEffect } from 'react';
import { sanitizeImageSrc } from '@/lib/sanitize';
import { History, Paperclip, X, FileText, Zap, Sun, Moon, BarChart3, Calendar, Target } from 'lucide-react';
import { loadLogs, loadGoals, loadLongTermGoals, loadGoalsV2, loadVisions, loadAllDailyTasks, loadAllBlocks, loadBlocks, saveBlocks, loadDailyTasks, saveDailyTasks } from './storage';
import { loadNutrition } from './NutritionView';
import { loadLessons } from './LifeLessonsView';
import ChatHistoryPanel from '@/components/ChatHistoryPanel';
import { loadConversations, saveConversation, deleteConversation, newConversation } from '@/lib/chatHistory';
import { base44 } from '@/api/base44Client';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import ModelSettingsPanel from '@/components/ModelSettingsPanel';
import { supabaseStorage } from '@/api/supabaseStorage';
import { getUserPrefix } from '@/lib/userStore';
import DOMPurify from 'dompurify';

function formatCoachText(text) {
  if (!text) return '';
  let html = text
    // Escape HTML
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    // Bold **text**
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    // Italic *text*
    .replace(/(?<!\*)\*(?!\*)(.+?)(?<!\*)\*(?!\*)/g, '<em>$1</em>')
    // Headers: lines starting with ### or ## or #
    .replace(/^### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^## (.+)$/gm, '<h3>$1</h3>')
    .replace(/^# (.+)$/gm, '<h3>$1</h3>')
    // Bullet lines: - item or * item
    .replace(/^[-*] (.+)$/gm, '<li>$1</li>')
    // Numbered list: 1. item
    .replace(/^\d+\. (.+)$/gm, '<li>$1</li>')
    // Wrap consecutive <li> in <ul>
    .replace(/((?:<li>.*<\/li>\n?)+)/g, '<ul>$1</ul>')
    // Double newlines -> paragraph break
    .replace(/\n\n+/g, '</p><p>')
    // Single newlines -> line break
    .replace(/\n/g, '<br>');
  html = '<p>' + html + '</p>';
  // Clean up empty paragraphs
  html = html.replace(/<p>\s*<\/p>/g, '');
  return DOMPurify.sanitize(html);
}

const DEFAULT_COACH_PERSONALITY = `You are JARVIS — my personal AI command center for life optimization.

YOUR JOB:
- Analyze ALL my data (schedule, goals, nutrition, gym, finances, lessons) as one connected system
- Learn from my previous days — detect patterns, peak hours, recurring failures and wins
- Judge my progress against MY GOALS with specific data, not generic advice
- Proactively structure my days ahead based on what actually works for me
- Be brutally honest about my trajectory — show me the math

YOUR PHILOSOPHICAL LENSES (use whichever fits):
- MARCUS AURELIUS (default): Discipline, self-command, do the duty in front of you
- SUN TZU: Strategy & positioning. Win before fighting
- ALEX HORMOZI: Brutal prioritization. "Is this the highest-value action right now?"
- DAVE RAMSEY: Financial discipline. Budget every dollar

RULES:
- Talk like JARVIS — intelligent, precise, slightly dry wit
- Lead with data and numbers. "You completed 7/10 tasks" not "you did most tasks"
- Keep replies concise unless doing a full assessment
- When I say "plan my day" — USE THE TOOLS to build my schedule, don't just describe it`;

const QUICK_ACTIONS = [
  { label: 'Morning Briefing', icon: Sun, prompt: 'Good morning. Give me my status report and plan my day.' },
  { label: 'Plan My Day', icon: Calendar, prompt: 'Plan my day. Build me a full schedule based on my patterns, goals, and pending tasks.' },
  { label: 'Evening Debrief', icon: Moon, prompt: 'End of day. Score my day, what did I complete vs miss, and what should I carry to tomorrow?' },
  { label: 'Weekly Review', icon: BarChart3, prompt: 'Give me a full weekly review — hours logged, task completion, nutrition, gym, finances, and trajectory vs goals.' },
  { label: 'Am I On Track?', icon: Target, prompt: 'Based on all my data, am I on track for my goals? Show me the trajectory and the gap.' },
  { label: 'Plan My Week', icon: Zap, prompt: 'Plan my entire week ahead. Build schedules for each day based on my patterns, goals, and what needs to get done.' },
];

function readFileAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function CoachView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);

  // Load profile for coach personality & context files
  const queryClient = useQueryClient();
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: profiles = [] } = useQuery({
    queryKey: ['profile', me?.email],
    queryFn: () => me?.email ? base44.entities.UserProfile.filter({ created_by: me.email }) : [],
    enabled: !!me?.email,
  });
  const profile = profiles[0];

  const handleSaveProfile = async (data) => {
    try {
      if (profile?.id) {
        await base44.entities.UserProfile.update(profile.id, data);
      } else {
        await base44.entities.UserProfile.create(data);
      }
      queryClient.invalidateQueries({ queryKey: ['profile'] });
    } catch {
      toast.error('Failed to save. Please try again.');
    }
  };

  // Initialize from stored conversations
  useEffect(() => {
    const convs = loadConversations('coach');
    setConversations(convs);
    if (convs.length > 0) {
      setCurrentConvId(convs[0].id);
      setMessages(convs[0].messages);
    } else {
      const conv = newConversation();
      setCurrentConvId(conv.id);
    }
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  function saveCurrentConv(msgs) {
    if (!currentConvId) return;
    const conv = { id: currentConvId, title: '', createdAt: Date.now(), updatedAt: Date.now(), messages: msgs };
    saveConversation('coach', conv);
    setConversations(loadConversations('coach'));
  }

  function handleNewChat() {
    const conv = newConversation();
    setCurrentConvId(conv.id);
    setMessages([]);
    saveConversation('coach', conv);
    setConversations(loadConversations('coach'));
    setShowHistory(false);
  }

  function handleSelectConv(conv) {
    setCurrentConvId(conv.id);
    setMessages(conv.messages);
    setShowHistory(false);
  }

  function handleDeleteConv(id) {
    deleteConversation('coach', id);
    setConversations(loadConversations('coach'));
    if (id === currentConvId) {
      const remaining = loadConversations('coach');
      if (remaining.length > 0) {
        setCurrentConvId(remaining[0].id);
        setMessages(remaining[0].messages);
      } else {
        handleNewChat();
      }
    }
  }

  async function handleFileSelect(e) {
    for (const file of Array.from(e.target.files || [])) {
      const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) { toast.error('Only PDFs and images are supported'); continue; }
      if (file.size > 10 * 1024 * 1024) { toast.error(`${file.name} is too large (max 10MB)`); continue; }
      try {
        const data = await readFileAsBase64(file);
        const rawPreview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        const preview = sanitizeImageSrc(rawPreview);
        setAttachments(prev => [...prev, { name: file.name, mediaType: file.type, data, preview }]);
      } catch { toast.error(`Failed to read ${file.name}`); }
    }
    e.target.value = '';
  }

  async function send(overrideMessage) {
    const userMsg = overrideMessage || input.trim();
    if ((!userMsg && attachments.length === 0) || loading) return;

    const currentAttachments = [...attachments];
    if (!overrideMessage) setInput('');
    setAttachments([]);
    setError(null);

    const displayMsg = {
      role: 'user',
      text: userMsg,
      ...(currentAttachments.length > 0 && { _attachments: currentAttachments.map(a => ({ name: a.name, mediaType: a.mediaType })) }),
    };
    const updatedMessages = [...messages, displayMsg];
    setMessages(updatedMessages);
    saveCurrentConv(updatedMessages);
    setLoading(true);

    try {
      const logs = loadLogs();
      const goals = loadGoals();
      const longTermGoals = loadLongTermGoals();
      const goalsV2 = loadGoalsV2();
      const visionsData = loadVisions();
      const dailyTasks = loadAllDailyTasks();
      const scheduleBlocks = loadAllBlocks();
      const nutrition = loadNutrition();
      const lifeLessons = loadLessons();

      const coachPersonality = profile?.model_personalities?.coach || null;
      const coachContextFiles = profile?.model_context_files?.coach || [];

      // Load financial data
      let financials = null;
      try {
        const finRaw = supabaseStorage.getItem(`${getUserPrefix()}accountable_financials_v2`);
        if (finRaw) financials = JSON.parse(finRaw);
      } catch {}

      // Load gym data
      let gymData = null;
      try {
        const gymRaw = supabaseStorage.getItem(`${getUserPrefix()}gym_tracker_v1`);
        if (gymRaw) gymData = JSON.parse(gymRaw);
      } catch {}

      // Build conversation history for context (last 10 messages to stay within token limits)
      const conversationHistory = messages.slice(-10).map(m => ({
        role: m.role,
        text: m.text,
      }));

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          logs, goals, longTermGoals, goalsV2, visionsData, dailyTasks, scheduleBlocks, nutrition,
          financials,
          gymData,
          lifeLessons,
          coachPersonality,
          coachContextFiles,
          conversationHistory,
          attachments: currentAttachments.map(a => ({ name: a.name, mediaType: a.mediaType, data: a.data })),
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data = await res.json();

      // Apply schedule changes if the coach made any
      if (data.scheduleChanges && data.scheduleChanges.length > 0) {
        let blockCount = 0;
        let taskCount = 0;
        for (const change of data.scheduleChanges) {
          if (change.action === 'add') {
            const dateBlocks = loadBlocks(change.date);
            dateBlocks.push(change.block);
            saveBlocks(change.date, dateBlocks);
            blockCount++;
          } else if (change.action === 'add_task') {
            const dateTasks = loadDailyTasks(change.date);
            dateTasks.push(change.task);
            saveDailyTasks(change.date, dateTasks);
            taskCount++;
          } else if (change.action === 'remove') {
            const dateBlocks = loadBlocks(change.date);
            const filtered = dateBlocks.filter(b => !b.text.toLowerCase().includes(change.matchText.toLowerCase()));
            saveBlocks(change.date, filtered);
            blockCount++;
          } else if (change.action === 'update') {
            const dateBlocks = loadBlocks(change.date);
            const updated = dateBlocks.map(b => {
              if (b.text.toLowerCase().includes(change.matchText.toLowerCase())) {
                return { ...b, ...change.updates };
              }
              return b;
            });
            saveBlocks(change.date, updated);
            blockCount++;
          }
        }
        window.dispatchEvent(new CustomEvent('daytracker-data-refreshed'));
        const parts = [];
        if (blockCount > 0) parts.push(`${blockCount} block${blockCount > 1 ? 's' : ''}`);
        if (taskCount > 0) parts.push(`${taskCount} task${taskCount > 1 ? 's' : ''}`);
        toast.success(`JARVIS updated your schedule (${parts.join(', ')})`);
      }

      setMessages(prev => {
        const updated = [...prev, { role: 'assistant', text: data.reply }];
        saveCurrentConv(updated);
        return updated;
      });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function handleQuickAction(prompt) {
    send(prompt);
  }

  return (
    <div>
      <ChatHistoryPanel
        open={showHistory}
        onClose={() => setShowHistory(false)}
        conversations={conversations}
        onSelect={handleSelectConv}
        onDelete={handleDeleteConv}
        onNewChat={handleNewChat}
      />

      <div style={{ marginBottom: 12, display: 'flex', gap: 4, flexWrap: 'wrap' }}>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition font-medium"
        >
          <History className="w-4 h-4" /> Chat History
        </button>
      </div>

      <ModelSettingsPanel
        modelKey="coach"
        label="Coach"
        defaultPersonality={DEFAULT_COACH_PERSONALITY}
        profile={profile}
        onSaveProfile={handleSaveProfile}
      />

      {messages.length === 0 && !loading && (
        <div className="coach-empty">
          <h3 style={{ fontSize: 18, fontWeight: 700, marginBottom: 4 }}>JARVIS</h3>
          <p style={{ color: '#64748b', fontSize: 13, marginBottom: 16 }}>
            Your AI command center. I see your schedule, goals, nutrition, gym, finances, and life lessons.
            I learn from your patterns and structure your days for maximum impact.
          </p>

          {/* Quick action buttons */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, maxWidth: 500 }}>
            {QUICK_ACTIONS.map((action) => {
              const Icon = action.icon;
              return (
                <button
                  key={action.label}
                  onClick={() => handleQuickAction(action.prompt)}
                  className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-sm text-left transition font-medium"
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    color: '#334155',
                    cursor: 'pointer',
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.background = '#f1f5f9'; e.currentTarget.style.borderColor = '#cbd5e1'; }}
                  onMouseOut={(e) => { e.currentTarget.style.background = '#f8fafc'; e.currentTarget.style.borderColor = '#e2e8f0'; }}
                >
                  <Icon style={{ width: 16, height: 16, color: '#6366f1', flexShrink: 0 }} />
                  <span>{action.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="coach-messages">
        {messages.map((msg, i) => (
          <div key={i} className={`coach-msg ${msg.role}`}>
            {msg._attachments && msg._attachments.length > 0 && (
              <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
                {msg._attachments.map((att, j) => (
                  <span key={j} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.06)', borderRadius: 6, padding: '2px 8px', fontSize: 11 }}>
                    <FileText style={{ width: 12, height: 12 }} /> {att.name}
                  </span>
                ))}
              </div>
            )}
            <div className="coach-msg-content" dangerouslySetInnerHTML={{ __html: formatCoachText(msg.text) }} />
          </div>
        ))}
        {loading && (
          <div className="coach-loading" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: '#6366f1', animation: 'pulse 1.5s infinite' }} />
            JARVIS is analyzing...
          </div>
        )}
        {error && <div className="coach-error">Error: {error}</div>}
        <div ref={bottomRef} />
      </div>

      {/* Attachment preview */}
      {attachments.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 0' }}>
          {attachments.map((att, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 4, background: '#f1f5f9', borderRadius: 8, padding: '4px 10px', fontSize: 12, color: '#475569' }}>
              {att.preview ? (
                <img src={att.preview} alt="" style={{ width: 20, height: 20, borderRadius: 4, objectFit: 'cover' }} />
              ) : (
                <FileText style={{ width: 14, height: 14 }} />
              )}
              <span style={{ maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{att.name}</span>
              <button onClick={() => setAttachments(prev => prev.filter((_, j) => j !== i))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 0, display: 'flex' }}>
                <X style={{ width: 12, height: 12, color: '#94a3b8' }} />
              </button>
            </div>
          ))}
        </div>
      )}

      <input type="file" ref={fileInputRef} onChange={handleFileSelect} className="hidden" multiple
        accept=".pdf,image/jpeg,image/png,image/gif,image/webp" style={{ display: 'none' }} />

      <div className="coach-input-bar">
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 6px', display: 'flex', alignItems: 'center', color: '#94a3b8' }}
          title="Attach file"
        >
          <Paperclip style={{ width: 18, height: 18 }} />
        </button>
        <input
          className="coach-input"
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Talk to JARVIS..."
          disabled={loading}
        />
        <button
          className="coach-send"
          onClick={() => send()}
          disabled={loading || (!input.trim() && attachments.length === 0)}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}

export default CoachView;
