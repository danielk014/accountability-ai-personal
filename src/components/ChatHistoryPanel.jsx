import React from "react";
import { X, Plus, Trash2, MessageSquare } from "lucide-react";

function groupByTime(conversations) {
  const now = Date.now();
  const dayMs = 86400000;
  const todayStart = new Date().setHours(0, 0, 0, 0);
  const yesterdayStart = todayStart - dayMs;
  const weekStart = todayStart - 7 * dayMs;

  const groups = { today: [], yesterday: [], week: [], older: [] };
  for (const c of conversations) {
    if (c.updatedAt >= todayStart) groups.today.push(c);
    else if (c.updatedAt >= yesterdayStart) groups.yesterday.push(c);
    else if (c.updatedAt >= weekStart) groups.week.push(c);
    else groups.older.push(c);
  }
  return groups;
}

function formatDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function Section({ label, items, onSelect, onDelete }) {
  if (items.length === 0) return null;
  return (
    <div className="mb-4">
      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide px-3 mb-1.5">{label}</p>
      {items.map(conv => (
        <div
          key={conv.id}
          onClick={() => onSelect(conv)}
          className="group flex items-center gap-2 px-3 py-2.5 rounded-xl hover:bg-slate-100 cursor-pointer transition"
        >
          <MessageSquare className="w-4 h-4 text-slate-400 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-slate-700 truncate">{conv.title}</p>
            <p className="text-xs text-slate-400">{formatDate(conv.updatedAt)} &middot; {conv.messages.length} messages</p>
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(conv.id); }}
            className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

export default function ChatHistoryPanel({ open, onClose, conversations, onSelect, onDelete, onNewChat }) {
  if (!open) return null;

  const groups = groupByTime(conversations);

  return (
    <div className="fixed inset-0 z-50 flex justify-end" onClick={onClose}>
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      {/* Panel */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative w-full max-w-sm bg-white shadow-2xl flex flex-col animate-slide-in-right"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 flex-shrink-0">
          <h2 className="text-lg font-semibold text-slate-800">Chat History</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={onNewChat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-600 text-white text-sm font-medium hover:bg-indigo-700 transition"
            >
              <Plus className="w-4 h-4" /> New Chat
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Conversations list */}
        <div className="flex-1 overflow-y-auto py-3 px-2">
          {conversations.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-sm">
              No conversations yet
            </div>
          ) : (
            <>
              <Section label="Today" items={groups.today} onSelect={onSelect} onDelete={onDelete} />
              <Section label="Yesterday" items={groups.yesterday} onSelect={onSelect} onDelete={onDelete} />
              <Section label="Last 7 Days" items={groups.week} onSelect={onSelect} onDelete={onDelete} />
              <Section label="Older" items={groups.older} onSelect={onSelect} onDelete={onDelete} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
