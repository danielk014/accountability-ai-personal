import { useState, useRef, useEffect } from 'react';
import { History } from 'lucide-react';
import { loadLogs, loadGoals, loadLongTermGoals, loadAllDailyTasks, loadAllBlocks } from './storage';
import ChatHistoryPanel from '@/components/ChatHistoryPanel';
import { loadConversations, saveConversation, deleteConversation, newConversation } from '@/lib/chatHistory';

function CoachView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [currentConvId, setCurrentConvId] = useState(null);
  const [conversations, setConversations] = useState([]);
  const bottomRef = useRef(null);

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

  async function send() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setError(null);
    setMessages(prev => {
      const updated = [...prev, { role: 'user', text: userMsg }];
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

      const res = await fetch('/api/coach', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMsg, logs, goals, longTermGoals, dailyTasks, scheduleBlocks })
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
            {msg.text}
          </div>
        ))}
        {loading && <div className="coach-loading">Coach is thinking...</div>}
        {error && <div className="coach-error">Error: {error}</div>}
        <div ref={bottomRef} />
      </div>

      <div className="coach-input-bar">
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
          disabled={loading || !input.trim()}
        >
          &uarr;
        </button>
      </div>
    </div>
  );
}

export default CoachView;
