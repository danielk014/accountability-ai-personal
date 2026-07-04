import { useState, useRef, useEffect } from 'react';
import { loadLogs, loadGoals, loadLongTermGoals, loadAllDailyTasks, loadAllBlocks } from './storage';

function CoachView() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function send() {
    if (!input.trim() || loading) return;

    const userMsg = input.trim();
    setInput('');
    setError(null);
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
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
      setMessages(prev => [...prev, { role: 'assistant', text: data.reply }]);
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
