import { useState, useRef, useEffect } from 'react';
import { History, Paperclip, X, FileText } from 'lucide-react';
import { loadLogs, loadGoals, loadLongTermGoals, loadAllDailyTasks, loadAllBlocks } from './storage';
import { loadNutrition } from './NutritionView';
import ChatHistoryPanel from '@/components/ChatHistoryPanel';
import { loadConversations, saveConversation, deleteConversation, newConversation } from '@/lib/chatHistory';
import { base44 } from '@/api/base44Client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

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
  const { data: me } = useQuery({ queryKey: ['me'], queryFn: () => base44.auth.me() });
  const { data: profiles = [] } = useQuery({
    queryKey: ['profile', me?.email],
    queryFn: () => me?.email ? base44.entities.UserProfile.filter({ created_by: me.email }) : [],
    enabled: !!me?.email,
  });
  const profile = profiles[0];

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
        const preview = file.type.startsWith('image/') ? URL.createObjectURL(file) : null;
        setAttachments(prev => [...prev, { name: file.name, mediaType: file.type, data, preview }]);
      } catch { toast.error(`Failed to read ${file.name}`); }
    }
    e.target.value = '';
  }

  async function send() {
    if ((!input.trim() && attachments.length === 0) || loading) return;

    const userMsg = input.trim();
    const currentAttachments = [...attachments];
    setInput('');
    setAttachments([]);
    setError(null);

    const displayMsg = {
      role: 'user',
      text: userMsg,
      ...(currentAttachments.length > 0 && { _attachments: currentAttachments.map(a => ({ name: a.name, mediaType: a.mediaType })) }),
    };
    setMessages(prev => {
      const updated = [...prev, displayMsg];
      saveCurrentConv(updated);
      return updated;
    });
    setLoading(true);

    try {
      const logs = loadLogs();
      const goals = loadGoals();
      const longTermGoals = loadLongTermGoals();
      const dailyTasks = loadAllDailyTasks();
      const scheduleBlocks = loadAllBlocks();
      const nutrition = loadNutrition();

      const coachPersonality = profile?.model_personalities?.coach || null;
      const coachContextFiles = profile?.model_context_files?.coach || [];

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: userMsg,
          logs, goals, longTermGoals, dailyTasks, scheduleBlocks, nutrition,
          coachPersonality,
          coachContextFiles,
          attachments: currentAttachments.map(a => ({ name: a.name, mediaType: a.mediaType, data: a.data })),
        })
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Server error ${res.status}`);
      }

      const data = await res.json();
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

      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowHistory(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition font-medium"
        >
          <History className="w-4 h-4" /> Chat History
        </button>
      </div>

      {messages.length === 0 && !loading && (
        <div className="coach-empty">
          <h3>Your AI Coach</h3>
          <p>
            Ask anything about your week, your goals, or what to do next.
            The coach sees all your logged days, your current goals, and your long-term vision.
          </p>
          <p style={{ marginTop: 12, color: '#555' }}>
            Try: "Am I on track?", "What direction am I headed?", or "What should I do today?"
          </p>
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
            {msg.text}
          </div>
        ))}
        {loading && <div className="coach-loading">Coach is thinking...</div>}
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
          placeholder="Ask your coach..."
          disabled={loading}
        />
        <button
          className="coach-send"
          onClick={send}
          disabled={loading || (!input.trim() && attachments.length === 0)}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}

export default CoachView;
