import React, { useState, useRef, useEffect } from "react";
import { MessageCircle, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import MessageBubble from "./MessageBubble";
import ChatInput from "./ChatInput";
import { sendMessageToClaude, loadHistory, saveHistory } from "@/api/claudeClient";
import { getUnreadCount, clearUnread } from "@/lib/reminderEngine";

export default function FloatingChatBubble({ currentPageName }) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState(() => loadHistory());
  const [isLoading, setIsLoading] = useState(false);
  const [unread, setUnread] = useState(getUnreadCount);
  const messagesEndRef = useRef(null);
  const chatWindowRef = useRef(null);
  const buttonRef = useRef(null);

  const displayMessages = messages.filter(m => m.role !== "system");

  // Scroll to bottom when messages change
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "auto" });
      }, 100);
    }
  }, [messages, isOpen]);

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (isOpen && chatWindowRef.current && buttonRef.current &&
          !chatWindowRef.current.contains(e.target) &&
          !buttonRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  // When opened: sync latest messages + clear unread
  useEffect(() => {
    if (isOpen) {
      setMessages(loadHistory());
      clearUnread();
      setUnread(0);
    }
  }, [isOpen]);

  // Listen for reminder fires — update badge and sync messages
  useEffect(() => {
    const onReminderFired = () => {
      if (!isOpen) {
        setMessages(loadHistory()); // keep in sync even when closed
      }
    };
    window.addEventListener('reminder-fired', onReminderFired);
    return () => window.removeEventListener('reminder-fired', onReminderFired);
  }, [isOpen]);

  // Listen for unread-changed events
  useEffect(() => {
    const handler = (e) => {
      if (!isOpen) setUnread(e.detail?.count ?? getUnreadCount());
    };
    window.addEventListener('unread-changed', handler);
    return () => window.removeEventListener('unread-changed', handler);
  }, [isOpen]);

  const handleSend = async (text, attachments = []) => {
    const displayMsg = {
      role: "user",
      content: text || "",
      ...(attachments.length > 0 && {
        _attachments: attachments.map(a => ({ name: a.name, mediaType: a.mediaType, isImage: a.isImage, preview: a.preview })),
      }),
    };

    let apiContent;
    if (attachments.length > 0) {
      apiContent = [];
      for (const att of attachments) {
        if (att.isImage) {
          apiContent.push({ type: "image", source: { type: "base64", media_type: att.mediaType, data: att.data } });
        } else if (att.mediaType === "application/pdf") {
          apiContent.push({ type: "document", source: { type: "base64", media_type: "application/pdf", data: att.data } });
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

    try {
      const reply = await sendMessageToClaude([...messages, apiMsg]);
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

  if (currentPageName === "Chat" || currentPageName === "Projects") return null;

  return (
    <>
      {/* Floating button */}
      <motion.button
        ref={buttonRef}
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-8 left-8 w-14 h-14 rounded-full bg-[#1e2228] text-white shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center z-40"
        whileHover={{ scale: 1.1 }}
        whileTap={{ scale: 0.95 }}
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <X className="w-5 h-5" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }} transition={{ duration: 0.2 }}>
              <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="AI" className="w-7 h-7 object-contain" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Unread badge on button */}
        {!isOpen && unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-violet-500 text-white text-[10px] font-bold flex items-center justify-center px-1 shadow-md border-2 border-white">
            {unread > 99 ? '99+' : unread}
          </span>
        )}
      </motion.button>

      {/* Chat window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={chatWindowRef}
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-24 left-8 w-96 h-[500px] bg-white rounded-2xl shadow-2xl border border-slate-200 flex flex-col z-40 max-h-[calc(100vh-120px)]"
          >
            {/* Header */}
            <div className="px-4 py-4 border-b border-slate-100 flex-shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-[#1e2228] flex items-center justify-center overflow-hidden">
                  <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="AI" className="w-7 h-7 object-contain" />
                </div>
                <div>
                  <p className="text-sm font-bold text-slate-800">Accountable AI</p>
                  <p className="text-xs text-slate-400">Your AI coach</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
              {displayMessages.length === 0 && (
                <div className="text-center py-8">
                  <p className="text-xs text-slate-500">
                    Start chatting to get personalized coaching and support
                  </p>
                </div>
              )}
              {displayMessages.map((msg, i) => (
                <MessageBubble key={i} message={msg} />
              ))}
              {isLoading && (
                <div className="flex gap-3">
                  <div className="h-8 w-8 rounded-lg bg-[#1e2228] flex items-center justify-center flex-shrink-0 overflow-hidden">
                    <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="AI" className="w-7 h-7 object-contain" />
                  </div>
                  <div className="bg-slate-100 rounded-2xl px-3 py-2">
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

            {/* Input */}
            <div className="border-t border-slate-100 flex-shrink-0 p-4">
              <ChatInput onSend={handleSend} isLoading={isLoading} compact={true} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
