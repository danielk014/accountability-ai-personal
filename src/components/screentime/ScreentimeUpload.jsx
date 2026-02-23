import React, { useState, useRef, useEffect } from "react";
import { Send, Upload, Loader2, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";

async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 1200;
      let { width, height } = img;
      if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
      const canvas = document.createElement("canvas");
      canvas.width = width; canvas.height = height;
      canvas.getContext("2d").drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL("image/jpeg", 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("Failed to load image")); };
    img.src = url;
  });
}

async function analyzeScreenshot(dataUrl) {
  const base64 = dataUrl.split(",")[1];
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: "image/jpeg", data: base64 } },
          {
            type: "text",
            text: 'Analyze this phone screen time screenshot. Extract the exact app usage. Respond ONLY with valid JSON: {"total_time":"e.g. 4h 23m","date":"YYYY-MM-DD or null","apps":[{"name":"App Name","minutes":90}],"insights":["2-3 short tips"],"summary":"one sentence"}'
          }
        ]
      }]
    }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  const text = data.content?.[0]?.text || "";
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON in response");
  return JSON.parse(match[0]);
}

async function askAI(question, logsContext) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 600,
      system: `You are a screen time accountability coach. Keep responses concise and actionable. User's recent screen time data:\n${logsContext || "No data logged yet."}`,
      messages: [{ role: "user", content: question }],
    }),
  });
  if (!res.ok) throw new Error("API error");
  const data = await res.json();
  return data.content?.[0]?.text || "";
}

function fmtMins(m) {
  if (!m) return "0m";
  const h = Math.floor(m / 60);
  const r = m % 60;
  return h > 0 ? (r > 0 ? `${h}h ${r}m` : `${h}h`) : `${r}m`;
}

// ScreentimeAIChat — used as the "AI" sub-tab of the Screen Time page
export default function ScreentimeAIChat({ logs = [], onLogEntries, today }) {
  const [messages, setMessages] = useState([{
    role: "assistant",
    text: "Upload a screen time screenshot and I'll analyze it and log your app usage automatically. You can also ask me anything about your habits."
  }]);
  const [input, setInput]   = useState("");
  const [loading, setLoading] = useState(false);
  const fileRef   = useRef(null);
  const bottomRef = useRef(null);

  // Tell FloatingChatBubble to hide while this chat is mounted
  useEffect(() => {
    window.dispatchEvent(new CustomEvent("embedded-chat-active", { detail: true }));
    return () => window.dispatchEvent(new CustomEvent("embedded-chat-active", { detail: false }));
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMsg = (msg) => setMessages(m => [...m, msg]);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Please upload an image"); return; }
    if (fileRef.current) fileRef.current.value = "";

    addMsg({ role: "user", text: `📷 Uploaded: ${file.name}` });
    setLoading(true);
    try {
      const dataUrl = await compressImage(file);
      const analysis = await analyzeScreenshot(dataUrl);

      // Build log entries from apps extracted
      const logDate = analysis.date || today || format(new Date(), "yyyy-MM-dd");
      const entries = (analysis.apps || [])
        .filter(a => a.name && a.minutes > 0)
        .map(a => ({
          id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
          date: logDate,
          app: a.name,
          minutes: a.minutes,
        }));

      if (entries.length > 0) onLogEntries?.(entries, logDate);

      // Format response
      const appLines = (analysis.apps || []).slice(0, 6).map(a =>
        `  • ${a.name}: ${fmtMins(a.minutes)}`
      ).join("\n");

      const parts = [
        `📱 **Total: ${analysis.total_time || fmtMins(entries.reduce((s, e) => s + e.minutes, 0))}**`,
        analysis.date ? `📅 Date logged: ${analysis.date}` : "",
        "",
        appLines ? `**Top apps:**\n${appLines}` : "",
        "",
        ...(analysis.insights || []).map(i => `💡 ${i}`),
        "",
        entries.length > 0
          ? `✅ Logged ${entries.length} app${entries.length !== 1 ? "s" : ""} to your screen time!`
          : "⚠️ Couldn't extract app data — try a clearer screenshot.",
      ].filter(s => s !== undefined && s !== "").join("\n");

      addMsg({ role: "assistant", text: parts });
    } catch (err) {
      addMsg({ role: "assistant", text: "I couldn't analyze that screenshot. Make sure it shows your phone's screen time report (iPhone Settings → Screen Time, or Android Digital Wellbeing)." });
    } finally {
      setLoading(false);
    }
  };

  const handleSend = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    addMsg({ role: "user", text: q });
    setLoading(true);
    try {
      // Build context from last 7 days of logs
      const cutoff = format(new Date(Date.now() - 7 * 86400000), "yyyy-MM-dd");
      const recent = logs.filter(l => l.date >= cutoff);
      const grouped = recent.reduce((acc, l) => {
        if (!acc[l.date]) acc[l.date] = [];
        acc[l.date].push(`${l.app}: ${fmtMins(l.minutes)}`);
        return acc;
      }, {});
      const ctx = Object.entries(grouped)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([d, apps]) => `${d}: ${apps.join(", ")}`)
        .join("\n");

      const reply = await askAI(q, ctx);
      addMsg({ role: "assistant", text: reply });
    } catch {
      addMsg({ role: "assistant", text: "Something went wrong. Please try again." });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden flex flex-col" style={{ height: 500 }}>
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map((msg, i) => (
          <div key={i} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            {msg.role === "assistant" && (
              <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mr-2 mt-0.5">
                <Smartphone className="w-3.5 h-3.5 text-orange-500" />
              </div>
            )}
            <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm whitespace-pre-wrap leading-relaxed ${
              msg.role === "user"
                ? "bg-indigo-600 text-white rounded-br-sm"
                : "bg-slate-100 text-slate-800 rounded-bl-sm"
            }`}>
              {msg.text}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="w-7 h-7 rounded-full bg-orange-100 flex items-center justify-center flex-shrink-0 mr-2">
              <Smartphone className="w-3.5 h-3.5 text-orange-500" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-bl-sm px-4 py-3 flex gap-1 items-center">
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
              <span className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input row */}
      <div className="border-t border-slate-100 p-3 flex items-center gap-2">
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          title="Upload screenshot"
          className="p-2 rounded-xl bg-orange-50 text-orange-500 hover:bg-orange-100 disabled:opacity-50 transition flex-shrink-0"
        >
          <Upload className="w-4 h-4" />
        </button>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
          placeholder="Ask about your screen time..."
          disabled={loading}
          className="flex-1 text-sm rounded-xl border border-slate-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 placeholder:text-slate-300"
        />
        <button
          type="button"
          onClick={handleSend}
          disabled={loading || !input.trim()}
          className="p-2 rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition flex-shrink-0"
        >
          <Send className="w-4 h-4" />
        </button>
        <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} className="hidden" />
      </div>
    </div>
  );
}
