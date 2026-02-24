import React, { useState, useRef, useEffect } from "react";
import { Trash2, CheckSquare, Square } from "lucide-react";

import MessageBubble from "../components/chat/MessageBubble";
import ChatInput from "../components/chat/ChatInput";
import ContextSidebar from "../components/chat/ContextSidebar";
import { sendMessageToClaude, loadHistory, saveHistory, clearHistory } from "@/api/claudeClient";
import { clearUnread } from "@/lib/reminderEngine";
import { isStorageReady } from "@/api/supabaseStorage";

export default function Chat() {
  const [messages, setMessages] = useState(() => loadHistory());
  const [isLoading, setIsLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const messagesEndRef = useRef(null);

  // Clear unread count when Chat page mounts
  useEffect(() => {
    clearUnread();
  }, []);

  // Load chat history once supabaseStorage finishes hydrating
  useEffect(() => {
    if (isStorageReady()) { setMessages(loadHistory()); return; }
    const handler = () => setMessages(loadHistory());
    window.addEventListener('supabase-storage-ready', handler);
    return () => window.removeEventListener('supabase-storage-ready', handler);
  }, []);

  // Sync messages when a reminder fires from outside this page
  useEffect(() => {
    const handler = () => {
      setMessages(loadHistory());
    };
    window.addEventListener('reminder-fired', handler);
    return () => window.removeEventListener('reminder-fired', handler);
  }, []);

  // Auto-scroll
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const handleCoachingClick = async (coachingResponse) => {
    const withCoaching = [
      ...messages,
      { role: "assistant", content: coachingResponse },
    ];
    setMessages(withCoaching);
    saveHistory(withCoaching);
  };

  const handleSend = async (text, attachments = []) => {
    // Build the display message (stored in history — no base64)
    const displayMsg = {
      role: "user",
      content: text || "",
      ...(attachments.length > 0 && {
        _attachments: attachments.map(a => ({
          name: a.name,
          mediaType: a.mediaType,
          isImage: a.isImage,
          preview: a.preview, // blob URL — valid this session only
        })),
      }),
    };

    // Build the API content (with base64 for files)
    let apiContent;
    if (attachments.length > 0) {
      apiContent = [];
      for (const att of attachments) {
        if (att.isImage) {
          apiContent.push({
            type: "image",
            source: { type: "base64", media_type: att.mediaType, data: att.data },
          });
        } else if (att.mediaType === "application/pdf") {
          apiContent.push({
            type: "document",
            source: { type: "base64", media_type: "application/pdf", data: att.data },
          });
        }
      }
      if (text) apiContent.push({ type: "text", text });
    } else {
      apiContent = text;
    }

    const apiMsg = { role: "user", content: apiContent };
    const updatedDisplay = [...messages, displayMsg];
    setMessages(updatedDisplay);
    setIsLoading(true);

    // Pass history with current message carrying actual file content
    const apiHistory = [...messages, apiMsg];

    try {
      const reply = await sendMessageToClaude(apiHistory);
      const withReply = [...updatedDisplay, { role: "assistant", content: reply }];
      setMessages(withReply);
      saveHistory(withReply);
    } catch (err) {
      const errMsg = { role: "assistant", content: `Sorry, something went wrong: ${err.message}` };
      const withErr = [...updatedDisplay, errMsg];
      setMessages(withErr);
      saveHistory(withErr);
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleSelect = (idx) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === messages.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(messages.map((_, i) => i)));
    }
  };

  const handleDeleteSelected = () => {
    const newMessages = messages.filter((_, i) => !selectedIds.has(i));
    setMessages(newMessages);
    saveHistory(newMessages);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const handleClearAll = () => {
    clearHistory();
    setMessages([]);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const displayMessages = messages.filter(m => m.role !== "system");

  return (
    <div className="flex h-[calc(100vh-64px)]">
      {/* Main chat area */}
      <div className="flex flex-col flex-1 min-w-0">
        {/* Selection toolbar */}
        {isSelectionMode && (
          <div className="px-4 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between flex-shrink-0">
            <button
              onClick={handleSelectAll}
              className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-800 font-medium"
            >
              {selectedIds.size === displayMessages.length ? (
                <CheckSquare className="w-4 h-4" />
              ) : (
                <Square className="w-4 h-4" />
              )}
              {selectedIds.size === displayMessages.length ? "Deselect All" : "Select All"}
            </button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-indigo-600">{selectedIds.size} selected</span>
              <button
                onClick={handleDeleteSelected}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </button>
              <button
                onClick={() => setIsSelectionMode(false)}
                className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-sm font-medium border border-slate-200 hover:bg-slate-50 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-6">
          <div className="max-w-3xl mx-auto space-y-4">
            {displayMessages.length === 0 && (
              <div className="text-center py-20">
                <div className="w-16 h-16 rounded-2xl bg-[#1e2228] flex items-center justify-center mx-auto mb-4 overflow-hidden">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="AI" className="w-14 h-14 object-contain" />
                </div>
                <h2 className="text-xl font-bold text-slate-800 mb-2">Accountable AI</h2>
                <p className="text-slate-500 max-w-md mx-auto text-sm">
                  Tell me about your goals, habits, and schedule. I'll help you stay on track,
                  celebrate wins, and build consistency.
                </p>
                <div className="flex flex-wrap gap-2 justify-center mt-6">
                  {[
                    "What should I focus on today?",
                    "Help me build a morning routine",
                    "How am I doing this week?",
                  ].map(suggestion => (
                    <button
                      key={suggestion}
                      onClick={() => handleSend(suggestion)}
                      className="px-4 py-2 rounded-full border border-slate-200 text-sm text-slate-600 hover:bg-indigo-50 hover:border-indigo-200 hover:text-indigo-700 transition-all"
                    >
                      {suggestion}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {displayMessages.map((msg, idx) => (
              <div
                key={idx}
                className="flex gap-3 items-start group"
                onContextMenu={(e) => { e.preventDefault(); setIsSelectionMode(true); handleToggleSelect(idx); }}
              >
                {isSelectionMode && (
                  <button
                    onClick={() => handleToggleSelect(idx)}
                    className="mt-1 flex-shrink-0 text-slate-400 hover:text-indigo-600 transition"
                  >
                    {selectedIds.has(idx) ? (
                      <CheckSquare className="w-4 h-4 text-indigo-600" />
                    ) : (
                      <Square className="w-4 h-4" />
                    )}
                  </button>
                )}
                <div className="flex-1">
                  <MessageBubble message={msg} />
                </div>
              </div>
            ))}

            {isLoading && (
              <div className="flex gap-3">
                <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm ml-11">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <div className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}


            <div ref={messagesEndRef} />
          </div>
        </div>

        {/* Input */}
        <ChatInput onSend={handleSend} isLoading={isLoading} onCoachingClick={handleCoachingClick} />
      </div>

      {/* Context sidebar */}
      <ContextSidebar />
    </div>
  );
}
