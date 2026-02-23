import React, { useState, useEffect, useRef } from "react";
import { base44 } from "@/api/base44Client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Plus, Trash2, Send, Loader2, Sparkles,
  Check, ChevronRight, ChevronLeft, FileText, CreditCard, Target,
  BookOpen, Pencil, RotateCcw, X, GraduationCap, Paperclip,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { getUserPrefix } from "@/lib/userStore";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

// ─── Top-level navigation controller ─────────────────────────────────────────

export default function HomeworkProjectDetail({ project, onBack, onEdit, onDelete }) {
  const [view, setView] = useState("chapters");
  const [selectedChapter, setSelectedChapter] = useState(null);
  const [selectedSection, setSelectedSection] = useState(null);

  const openChapter = (chapter) => {
    setSelectedChapter(chapter);
    setView("chapter");
  };

  const openSection = (section) => {
    setSelectedSection(section);
    setView("section");
  };

  const goBack = () => {
    if (view === "section") {
      setSelectedSection(null);
      setView("chapter");
    } else if (view === "chapter") {
      setSelectedChapter(null);
      setView("chapters");
    } else {
      onBack();
    }
  };

  if (view === "section" && selectedChapter) {
    if (selectedSection === "summary")    return <SummaryView    chapter={selectedChapter} onBack={goBack} />;
    if (selectedSection === "flashcards") return <FlashcardsView chapter={selectedChapter} onBack={goBack} />;
    if (selectedSection === "objectives") return <LearningObjectivesView chapter={selectedChapter} onBack={goBack} />;
  }

  if (view === "chapter" && selectedChapter) {
    return (
      <ChapterSectionsView
        chapter={selectedChapter}
        onBack={goBack}
        onOpenSection={openSection}
      />
    );
  }

  return (
    <ChaptersView
      project={project}
      onBack={onBack}
      onOpenChapter={openChapter}
      onEdit={onEdit}
      onDelete={onDelete}
    />
  );
}

// ─── ChaptersView ─────────────────────────────────────────────────────────────

function ChaptersView({ project, onBack, onOpenChapter, onEdit, onDelete }) {
  const queryClient = useQueryClient();

  const { data: chapters = [] } = useQuery({
    queryKey: ["chapters", project.id],
    queryFn: () => base44.entities.HomeworkChapter.filter({ project_id: project.id }, "created_at"),
    enabled: !!project.id,
  });

  useEffect(() => {
    const unsub = base44.entities.HomeworkChapter.subscribe(() =>
      queryClient.invalidateQueries({ queryKey: ["chapters", project.id] })
    );
    return unsub;
  }, [project.id]);

  const [showNewChapter, setShowNewChapter] = useState(false);
  const [newChapterName, setNewChapterName] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (showNewChapter) setTimeout(() => inputRef.current?.focus(), 50);
  }, [showNewChapter]);

  const createChapter = async () => {
    if (!newChapterName.trim()) return;
    await base44.entities.HomeworkChapter.create({
      project_id: project.id,
      name: newChapterName.trim(),
      order: chapters.length,
    });
    queryClient.invalidateQueries({ queryKey: ["chapters", project.id] });
    setNewChapterName("");
    setShowNewChapter(false);
    toast.success("Chapter created!");
  };

  const deleteChapter = async (chapterId) => {
    if (!window.confirm("Delete this chapter and all its contents?")) return;
    const [summaries, flashcards, objectives] = await Promise.all([
      base44.entities.ChapterSummaryEntry.filter({ chapter_id: chapterId }),
      base44.entities.Flashcard.filter({ chapter_id: chapterId }),
      base44.entities.LearningObjective.filter({ chapter_id: chapterId }),
    ]);
    await Promise.all([
      ...summaries.map(s => base44.entities.ChapterSummaryEntry.delete(s.id)),
      ...flashcards.map(f => base44.entities.Flashcard.delete(f.id)),
      ...objectives.map(o => base44.entities.LearningObjective.delete(o.id)),
      base44.entities.HomeworkChapter.delete(chapterId),
    ]);
    queryClient.invalidateQueries({ queryKey: ["chapters", project.id] });
    toast.success("Chapter deleted");
  };

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-4 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: project.color || "#8b5cf6" }} />
        <div className="flex-1 min-w-0">
          <h2 className="text-lg font-bold text-slate-800 truncate">{project.name}</h2>
          <div className="flex items-center gap-1.5 mt-0.5">
            <GraduationCap className="w-3 h-3 text-violet-400" />
            <p className="text-xs text-slate-400">Homework</p>
          </div>
        </div>
        <div className="flex gap-2 flex-shrink-0">
          <button onClick={() => onEdit(project)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={() => { onDelete(project.id); onBack(); }} className="p-2 rounded-xl hover:bg-red-50 text-slate-400 hover:text-red-400 transition">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Body */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto">
          {/* Create chapter */}
          <div className="mb-6">
            {showNewChapter ? (
              <div className="flex gap-2">
                <Input
                  ref={inputRef}
                  value={newChapterName}
                  onChange={e => setNewChapterName(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter") createChapter();
                    if (e.key === "Escape") setShowNewChapter(false);
                  }}
                  placeholder="e.g. Chapter 1, Unit 3, Lecture 5…"
                  className="rounded-xl flex-1"
                />
                <Button onClick={createChapter} disabled={!newChapterName.trim()} className="rounded-xl bg-violet-600 hover:bg-violet-700">
                  Create
                </Button>
                <Button variant="outline" onClick={() => { setShowNewChapter(false); setNewChapterName(""); }} className="rounded-xl">
                  Cancel
                </Button>
              </div>
            ) : (
              <Button onClick={() => setShowNewChapter(true)} className="rounded-xl bg-violet-600 hover:bg-violet-700">
                <Plus className="w-4 h-4 mr-1.5" />
                Create new chapter
              </Button>
            )}
          </div>

          {/* Chapter list */}
          {chapters.length === 0 ? (
            <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
              <div className="w-16 h-16 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-4">
                <BookOpen className="w-8 h-8 text-violet-300" />
              </div>
              <p className="text-lg font-semibold text-slate-700">No chapters yet</p>
              <p className="text-sm text-slate-400 mt-1">Create your first chapter to start organizing your study material</p>
            </motion.div>
          ) : (
            <div className="space-y-3">
              <AnimatePresence>
                {chapters.map(chapter => (
                  <ChapterCard
                    key={chapter.id}
                    chapter={chapter}
                    onOpen={onOpenChapter}
                    onDelete={deleteChapter}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── ChapterCard ──────────────────────────────────────────────────────────────

function ChapterCard({ chapter, onOpen, onDelete }) {
  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -16 }}
      onClick={() => onOpen(chapter)}
      className="bg-white rounded-2xl border border-slate-200 p-5 cursor-pointer hover:border-violet-300 hover:shadow-md transition-all group flex items-center gap-4"
    >
      <div className="w-12 h-12 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
        <BookOpen className="w-6 h-6 text-violet-500" />
      </div>
      <div className="flex-1 min-w-0">
        <h3 className="font-semibold text-slate-800 text-base truncate">{chapter.name}</h3>
        <p className="text-xs text-slate-400 mt-0.5">Summary · Flashcards · Learning Objectives</p>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
        <button
          onClick={e => { e.stopPropagation(); onDelete(chapter.id); }}
          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-400 transition"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-violet-500 transition" />
      </div>
    </motion.div>
  );
}

// ─── ChapterSectionsView ──────────────────────────────────────────────────────

const SECTIONS = [
  {
    id: "summary",
    icon: FileText,
    label: "Summary",
    description: "Write and build your chapter summary in your own words",
    bg: "bg-blue-50",
    iconColor: "text-blue-500",
    borderHover: "hover:border-blue-300",
    accent: "text-blue-600",
  },
  {
    id: "flashcards",
    icon: CreditCard,
    label: "Flashcards",
    description: "Create flashcard decks and study terms and definitions",
    bg: "bg-emerald-50",
    iconColor: "text-emerald-500",
    borderHover: "hover:border-emerald-300",
    accent: "text-emerald-600",
  },
  {
    id: "objectives",
    icon: Target,
    label: "Learning Objectives",
    description: "AI-assisted goals — what you should be able to do after studying",
    bg: "bg-violet-50",
    iconColor: "text-violet-500",
    borderHover: "hover:border-violet-300",
    accent: "text-violet-600",
  },
];

function ChapterSectionsView({ chapter, onBack, onOpenSection }) {
  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
          <BookOpen className="w-5 h-5 text-violet-500" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">{chapter.name}</h2>
          <p className="text-xs text-slate-400">Choose a section to study</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-8">
        <div className="max-w-2xl mx-auto space-y-4">
          {SECTIONS.map((section, i) => {
            const Icon = section.icon;
            return (
              <motion.div
                key={section.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.07 }}
                onClick={() => onOpenSection(section.id)}
                className={cn(
                  "bg-white rounded-2xl border border-slate-200 p-6 cursor-pointer transition-all hover:shadow-md flex items-center gap-5",
                  section.borderHover
                )}
              >
                <div className={cn("w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0", section.bg)}>
                  <Icon className={cn("w-7 h-7", section.iconColor)} />
                </div>
                <div className="flex-1">
                  <h3 className={cn("font-semibold text-slate-800 text-lg")}>{section.label}</h3>
                  <p className="text-sm text-slate-400 mt-0.5 leading-relaxed">{section.description}</p>
                </div>
                <ChevronRight className="w-5 h-5 text-slate-300 flex-shrink-0" />
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── SummaryView ──────────────────────────────────────────────────────────────

const getSummaryAIKey    = (chapterId) => `${getUserPrefix()}accountable_summary_ai_${chapterId}`;
const getObjectivesAIKey = (chapterId) => `${getUserPrefix()}accountable_objectives_ai_${chapterId}`;
const getFlashcardsAIKey  = (chapterId) => `${getUserPrefix()}accountable_flashcards_ai_${chapterId}`;
const getDecksStorageKey  = (chapterId) => `${getUserPrefix()}accountable_decks_${chapterId}`;
const getFilesStorageKey  = (chapterId) => `${getUserPrefix()}accountable_summary_files_${chapterId}`;

async function callSummaryAI(messages, systemPrompt) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

async function callObjectivesAI(messages, systemPrompt) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

async function callFlashcardsAI(messages, systemPrompt) {
  const response = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content })),
    }),
  });
  if (!response.ok) throw new Error(`API error ${response.status}`);
  const data = await response.json();
  return data.content?.find(b => b.type === "text")?.text ?? "";
}

function SummaryView({ chapter, onBack }) {
  const queryClient = useQueryClient();

  const { data: entries = [] } = useQuery({
    queryKey: ["summaryEntries", chapter.id],
    queryFn: () => base44.entities.ChapterSummaryEntry.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  useEffect(() => {
    const unsub = base44.entities.ChapterSummaryEntry.subscribe(() =>
      queryClient.invalidateQueries({ queryKey: ["summaryEntries", chapter.id] })
    );
    return unsub;
  }, [chapter.id]);

  // Panel mode: "write" | "ai"
  const [panel, setPanel] = useState("write");

  // Write mode state
  const [writeText, setWriteText]               = useState("");
  const [saving, setSaving]                     = useState(false);
  const [confirmDeleteEntryId, setConfirmDeleteEntryId] = useState(null);
  const [confirmDeleteEntryFinal, setConfirmDeleteEntryFinal] = useState(null);
  const textRef    = useRef(null);
  const entriesRef = useRef(null);

  // Uploaded files (persisted in localStorage per chapter)
  const filesKey = getFilesStorageKey(chapter.id);
  const [uploadedFiles, setUploadedFiles] = useState(() => {
    try { return JSON.parse(localStorage.getItem(getFilesStorageKey(chapter.id)) || "[]"); } catch { return []; }
  });
  const saveUploadedFiles = (files) => {
    setUploadedFiles(files);
    try { localStorage.setItem(filesKey, JSON.stringify(files)); } catch { toast.error("Storage full — remove some files to free space"); }
  };
  const deleteUploadedFile = (id) => saveUploadedFiles(uploadedFiles.filter(f => f.id !== id));

  // AI chat state
  const aiChatKey = getSummaryAIKey(chapter.id);
  const [aiMessages, setAiMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(aiChatKey) || "[]"); } catch { return []; }
  });
  const [aiInput, setAiInput]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiBottomRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (panel === "ai") setTimeout(() => aiBottomRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [aiMessages, panel]);

  useEffect(() => {
    if (panel === "write") setTimeout(() => entriesRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  }, [entries, panel]);

  // ── Write mode ──────────────────────────────────────────────────────────────

  const saveEntry = async (content) => {
    if (!content.trim()) return;
    setSaving(true);
    try {
      await base44.entities.ChapterSummaryEntry.create({
        chapter_id: chapter.id,
        content: content.trim(),
      });
      queryClient.invalidateQueries({ queryKey: ["summaryEntries", chapter.id] });
    } catch {
      toast.error("Failed to save summary");
    } finally {
      setSaving(false);
    }
  };

  const handleWriteSubmit = async () => {
    if (!writeText.trim() || saving) return;
    await saveEntry(writeText);
    setWriteText("");
    setTimeout(() => textRef.current?.focus(), 50);
  };

  const deleteEntry = async (id) => {
    await base44.entities.ChapterSummaryEntry.delete(id);
    queryClient.invalidateQueries({ queryKey: ["summaryEntries", chapter.id] });
  };

  // ── AI chat ─────────────────────────────────────────────────────────────────

  const buildSystemPrompt = () => {
    const savedText = entries.map(e => e.content).join("\n\n");
    return `You are an AI study assistant helping a student write and improve a chapter summary for "${chapter.name}".

${savedText ? `The student has already written the following summary:\n\n${savedText}\n\n` : "No summary has been written yet.\n\n"}Help them:
- Expand, clarify, or improve their summary
- Generate a new summary from notes or content they paste or upload
- Answer questions about the chapter material
- Suggest key points to include

When you generate a paragraph of summary text that the student should save, wrap it in <SAVE>...</SAVE> tags so they can save it with one click. Keep responses concise and educational.`;
  };

  // Build file-prepended messages so the AI always has access to uploaded files
  const buildMessagesWithFiles = (msgs) => {
    if (uploadedFiles.length === 0) return msgs;
    const filePreamble = uploadedFiles.flatMap(f => [
      {
        role: "user",
        content: f.isPDF
          ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: f.base64 } },
             { type: "text", text: `This is my attached file: "${f.name}". Use it as context.` }]
          : [{ type: "image", source: { type: "base64", media_type: f.mediaType, data: f.base64 } },
             { type: "text", text: `This is my attached file: "${f.name}". Use it as context.` }],
      },
      { role: "assistant", content: `Got it — I can see "${f.name}" and will use it as context for your questions.` },
    ]);
    return [...filePreamble, ...msgs];
  };

  const sendAiMessage = async (content) => {
    if (!content.trim() || aiLoading) return;
    const userMsg = { role: "user", content: content.trim() };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    localStorage.setItem(aiChatKey, JSON.stringify(updated.slice(-60)));
    setAiLoading(true);
    try {
      const reply = await callSummaryAI(buildMessagesWithFiles(updated), buildSystemPrompt());
      const withReply = [...updated, { role: "assistant", content: reply }];
      setAiMessages(withReply);
      localStorage.setItem(aiChatKey, JSON.stringify(withReply.slice(-60)));
    } catch {
      toast.error("AI failed to respond. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const deleteAiMessage = (index) => {
    const updated = aiMessages.filter((_, i) => i !== index);
    setAiMessages(updated);
    localStorage.setItem(aiChatKey, JSON.stringify(updated));
  };

  // ── File upload ──────────────────────────────────────────────────────────────

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const isImage = file.type.startsWith("image/");
    const isPDF   = file.type === "application/pdf";
    const maxSize = isImage ? 5 * 1024 * 1024 : isPDF ? 20 * 1024 * 1024 : 500 * 1024;
    if (file.size > maxSize) {
      toast.error(
        isImage ? "Image too large — please upload images under 5 MB"
        : isPDF  ? "PDF too large — please upload PDFs under 20 MB"
        :          "File too large — please upload files under 500 KB"
      );
      return;
    }

    const reader = new FileReader();

    if (isImage || isPDF) {
      reader.onload = async (ev) => {
        const dataUrl = ev.target?.result;
        if (!dataUrl) { toast.error(`Could not read ${isPDF ? "PDF" : "image"}.`); return; }
        const [header, base64Data] = dataUrl.split(",");
        const mediaType = isPDF ? "application/pdf" : (header.match(/:(.*?);/)?.[1] ?? "image/jpeg");

        // Persist the file so it stays available across messages
        const newFile = { id: Date.now().toString(), name: file.name, isPDF, mediaType, base64: base64Data, addedAt: new Date().toISOString() };
        const nextFiles = [...uploadedFiles, newFile];
        saveUploadedFiles(nextFiles);

        setPanel("ai");
        const displayMsg = { role: "user", content: isPDF ? `📄 PDF: ${file.name}` : `📷 Image: ${file.name}` };
        const updatedDisplay = [...aiMessages, displayMsg];
        setAiMessages(updatedDisplay);
        localStorage.setItem(aiChatKey, JSON.stringify(updatedDisplay.slice(-60)));
        setAiLoading(true);
        try {
          const fileContent = isPDF
            ? [
                { type: "document", source: { type: "base64", media_type: "application/pdf", data: base64Data } },
                { type: "text", text: `I've uploaded a PDF called "${file.name}". Please read its contents and generate a concise, well-structured summary I can save for my notes. Wrap the summary text in <SAVE>...</SAVE> tags so I can save it with one click.` },
              ]
            : [
                { type: "image", source: { type: "base64", media_type: mediaType, data: base64Data } },
                { type: "text", text: `I've uploaded an image called "${file.name}". Please read all the text visible in this image carefully and generate a concise, well-structured summary I can save for my notes. If it contains charts, stats, or tables, describe them in detail. Wrap the summary text in <SAVE>...</SAVE> tags so I can save it with one click.` },
              ];
          const messagesForAI = [...aiMessages, { role: "user", content: fileContent }];
          const reply = await callSummaryAI(messagesForAI, buildSystemPrompt());
          const withReply = [...updatedDisplay, { role: "assistant", content: reply }];
          setAiMessages(withReply);
          localStorage.setItem(aiChatKey, JSON.stringify(withReply.slice(-60)));
        } catch {
          toast.error("AI failed to respond. Please try again.");
        } finally {
          setAiLoading(false);
        }
      };
      reader.onerror = () => toast.error(`Failed to read ${isPDF ? "PDF" : "image"}`);
      reader.readAsDataURL(file);
    } else {
      reader.onload = async (ev) => {
        const content = ev.target?.result;
        if (!content || typeof content !== "string") {
          toast.error("Could not read file. Make sure it's a plain text file.");
          return;
        }
        setPanel("ai");
        const truncated = content.length > 8000 ? content.slice(0, 8000) + "\n\n[File truncated at 8000 chars]" : content;
        const prompt = `I've uploaded a file called "${file.name}". Please read its contents and generate a concise, well-structured summary I can save for my notes:\n\n---\n${truncated}\n---`;
        await sendAiMessage(prompt);
      };
      reader.onerror = () => toast.error("Failed to read file");
      reader.readAsText(file);
    }
  };

  // Extract <SAVE>...</SAVE> blocks from AI message
  const parseSaveBlocks = (text) => {
    const parts = [];
    const re = /<SAVE>([\s\S]*?)<\/SAVE>/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
      parts.push({ type: "save", content: m[1].trim() });
      last = m.index + m[0].length;
    }
    if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
    return parts;
  };

  const quickPrompts = [
    "Summarize what I've written so far in bullet points",
    "What are the key concepts I should include?",
    "Help me expand my summary with more detail",
    "Generate a concise summary I can save",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-6 py-4 flex items-center gap-4 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center flex-shrink-0">
          <FileText className="w-5 h-5 text-blue-500" />
        </div>
        <div className="flex-1">
          <h2 className="text-base font-bold text-slate-800">Summary</h2>
          <p className="text-xs text-slate-400">{chapter.name}</p>
        </div>
        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          title="Upload a file or image to generate a summary with AI"
          className="p-2 rounded-xl hover:bg-blue-50 text-slate-400 hover:text-blue-500 transition flex-shrink-0"
        >
          <Paperclip className="w-4 h-4" />
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.md,.csv,.json,.xml,.html,.htm,.rtf,.jpg,.jpeg,.png,.gif,.webp,.pdf"
          className="hidden"
          onChange={handleFileUpload}
        />
      </div>

      {/* Panel toggle */}
      <div className="flex bg-white border-b border-slate-100 flex-shrink-0">
        {[["write", "✏️  Write"], ["ai", "✨  AI Assistant"]].map(([id, label]) => (
          <button
            key={id}
            onClick={() => setPanel(id)}
            className={cn(
              "flex-1 py-2.5 text-sm font-medium transition-all",
              panel === id
                ? "text-blue-600 border-b-2 border-blue-600"
                : "text-slate-400 hover:text-slate-600"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── Uploaded files strip ── */}
      {uploadedFiles.length > 0 && (
        <div className="bg-white border-b border-slate-100 px-6 py-2 flex-shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-400 font-medium flex-shrink-0">Files:</span>
            {uploadedFiles.map(f => (
              <div key={f.id} className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-xs text-blue-700 group">
                <span>{f.isPDF ? "📄" : "📷"}</span>
                <span className="max-w-[140px] truncate font-medium">{f.name}</span>
                <button
                  onClick={() => deleteUploadedFile(f.id)}
                  className="ml-0.5 opacity-50 group-hover:opacity-100 hover:text-red-500 transition rounded"
                  title="Remove file"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Write panel ── */}
      {panel === "write" && (
        <>
          <div className="flex-1 overflow-y-auto px-6 py-6">
            <div className="max-w-2xl mx-auto space-y-4">
              {entries.length === 0 ? (
                <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
                  <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
                    <FileText className="w-7 h-7 text-blue-200" />
                  </div>
                  <p className="text-slate-500 font-medium">No summary yet</p>
                  <p className="text-sm text-slate-400 mt-1">Write below, or use AI Assistant to generate one</p>
                </motion.div>
              ) : (
                entries.map(entry => (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white rounded-2xl border border-slate-100 shadow-sm p-5 group"
                  >
                    <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{entry.content}</p>
                    <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-50">
                      <span className="text-xs text-slate-300">
                        {new Date(entry.created_at).toLocaleDateString("en-US", {
                          month: "short", day: "numeric", hour: "2-digit", minute: "2-digit",
                        })}
                      </span>
                      {confirmDeleteEntryFinal === entry.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-600 font-semibold">This is permanent.</span>
                          <button
                            onClick={() => { deleteEntry(entry.id); setConfirmDeleteEntryFinal(null); setConfirmDeleteEntryId(null); }}
                            className="px-2 py-0.5 rounded-lg bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition"
                          >Confirm</button>
                          <button
                            onClick={() => { setConfirmDeleteEntryFinal(null); setConfirmDeleteEntryId(null); }}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition"
                          >Cancel</button>
                        </div>
                      ) : confirmDeleteEntryId === entry.id ? (
                        <div className="flex items-center gap-1">
                          <span className="text-xs text-red-500 font-medium">Delete?</span>
                          <button
                            onClick={() => setConfirmDeleteEntryFinal(entry.id)}
                            className="px-2 py-0.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition"
                          >Yes</button>
                          <button
                            onClick={() => setConfirmDeleteEntryId(null)}
                            className="px-2 py-0.5 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition"
                          >No</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => setConfirmDeleteEntryId(entry.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                ))
              )}
              <div ref={entriesRef} />
            </div>
          </div>

          <div className="bg-white border-t border-slate-100 px-6 py-4 flex-shrink-0">
            <div className="max-w-2xl mx-auto flex gap-3 items-end">
              <textarea
                ref={textRef}
                value={writeText}
                onChange={e => setWriteText(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleWriteSubmit(); }}
                placeholder="Write your summary here… (Cmd+Enter to save)"
                rows={3}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400"
                style={{ minHeight: "80px", maxHeight: "220px" }}
              />
              <Button
                onClick={handleWriteSubmit}
                disabled={!writeText.trim() || saving}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-4 self-end h-10"
              >
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </>
      )}

      {/* ── AI Assistant panel ── */}
      {panel === "ai" && (
        <>
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {aiMessages.length === 0 ? (
              <div className="space-y-3 pt-4">
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-6 h-6 text-blue-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">AI Summary Assistant</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Ask me to generate a summary, expand your notes, or upload a file with the 📎 button
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2 max-w-lg mx-auto">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => sendAiMessage(q)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 hover:border-blue-300 hover:bg-blue-50 text-slate-600 hover:text-blue-700 transition bg-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-blue-600 text-white rounded-tr-sm px-3 py-2.5 whitespace-pre-wrap"
                      : "bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100 overflow-hidden"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="p-3 space-y-2">
                        {parseSaveBlocks(msg.content).map((part, pi) =>
                          part.type === "text" ? (
                            <p key={pi} className="whitespace-pre-wrap text-slate-800 leading-relaxed">{part.content}</p>
                          ) : (
                            <div key={pi} className="bg-blue-50 border border-blue-200 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-blue-600 uppercase tracking-wide">Suggested summary</p>
                              <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{part.content}</p>
                              <button
                                onClick={async () => {
                                  await saveEntry(part.content);
                                  toast.success("Saved to summary!");
                                }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                              >
                                <Check className="w-3.5 h-3.5" /> Save to summary
                              </button>
                            </div>
                          )
                        )}
                        <button
                          onClick={() => deleteAiMessage(i)}
                          className="text-xs text-slate-300 hover:text-red-400 transition mt-1"
                        >
                          Delete
                        </button>
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                  {msg.role === "user" && (
                    <button
                      onClick={() => deleteAiMessage(i)}
                      className="self-end mb-1 text-slate-300 hover:text-red-400 transition opacity-0 group-hover:opacity-100"
                    />
                  )}
                </div>
              ))
            )}

            {aiLoading && (
              <div className="flex gap-2">
                <div className="w-7 h-7 rounded-xl bg-blue-100 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm px-3 py-3 shadow-sm border border-slate-100">
                  <div className="flex gap-1.5">
                    {[0, 150, 300].map(d => (
                      <div key={d} className="w-1.5 h-1.5 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={aiBottomRef} />
          </div>

          <div className="bg-white border-t border-slate-100 px-5 py-4 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <button
                onClick={() => fileInputRef.current?.click()}
                title="Upload a file"
                className="p-2.5 rounded-xl border border-slate-200 text-slate-400 hover:border-blue-300 hover:text-blue-500 transition self-end flex-shrink-0"
              >
                <Paperclip className="w-4 h-4" />
              </button>
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(aiInput); } }}
                placeholder="Ask the AI to help with your summary… (Enter to send)"
                rows={1}
                disabled={aiLoading}
                className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-200 placeholder:text-slate-400"
                style={{ minHeight: "40px", maxHeight: "120px" }}
              />
              <Button
                onClick={() => sendAiMessage(aiInput)}
                disabled={!aiInput.trim() || aiLoading}
                className="rounded-xl bg-blue-600 hover:bg-blue-700 px-3 self-end h-10"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── FlashcardsView ───────────────────────────────────────────────────────────

const SWIPE_THRESHOLD = 60;

function FlashcardsView({ chapter, onBack }) {
  const queryClient = useQueryClient();

  const { data: flashcards = [] } = useQuery({
    queryKey: ["flashcards", chapter.id],
    queryFn: () => base44.entities.Flashcard.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  const { data: summaryEntries = [] } = useQuery({
    queryKey: ["summaryEntries", chapter.id],
    queryFn: () => base44.entities.ChapterSummaryEntry.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", chapter.id],
    queryFn: () => base44.entities.LearningObjective.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  useEffect(() => {
    const unsub = base44.entities.Flashcard.subscribe(() =>
      queryClient.invalidateQueries({ queryKey: ["flashcards", chapter.id] })
    );
    return unsub;
  }, [chapter.id]);

  // Persist deck names in localStorage so empty decks survive card deletions
  const [storedDecks, setStoredDecks] = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(getDecksStorageKey(chapter.id)) || "[]");
      if (saved.length === 0) {
        localStorage.setItem(getDecksStorageKey(chapter.id), JSON.stringify(["General"]));
        return ["General"];
      }
      return saved;
    } catch { return ["General"]; }
  });
  const saveStoredDecks = (list) => {
    setStoredDecks(list);
    localStorage.setItem(getDecksStorageKey(chapter.id), JSON.stringify(list));
  };
  const decks = [...new Set([...storedDecks, ...flashcards.map(f => f.deck_name)])];

  const [selectedDeck, setSelectedDeck]         = useState(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(getDecksStorageKey(chapter.id)) || "[]");
      return saved[0] ?? "General";
    } catch { return "General"; }
  });
  const [showNewDeck, setShowNewDeck]           = useState(false);
  const [newDeckName, setNewDeckName]           = useState("");
  const [showAddCard, setShowAddCard]           = useState(false);
  const [newFront, setNewFront]                 = useState("");
  const [newBack, setNewBack]                   = useState("");
  const [mobilePanel, setMobilePanel]           = useState("cards");
  const [confirmDeleteDeck, setConfirmDeleteDeck] = useState(null); // deck name
  const [confirmDeleteCard, setConfirmDeleteCard] = useState(false);
  const [confirmDeleteCardFinal, setConfirmDeleteCardFinal] = useState(false);

  // Swipe / flip state
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped]       = useState(false);
  const [swipeDir, setSwipeDir]         = useState(1);
  const wasDragging   = useRef(false);
  const mouseDownTime = useRef(null);

  // AI chat state
  const fcChatKey = getFlashcardsAIKey(chapter.id);
  const [aiMessages, setAiMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(fcChatKey) || "[]"); } catch { return []; }
  });
  const [aiInput, setAiInput]     = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  // Auto-select first deck if none selected (e.g. after deck deletion)
  useEffect(() => {
    if (!selectedDeck && decks.length > 0) {
      setSelectedDeck(decks[0]);
    }
  }, [flashcards, storedDecks]);

  const deckCards = selectedDeck ? flashcards.filter(f => f.deck_name === selectedDeck) : [];

  useEffect(() => { setCurrentIndex(0); setIsFlipped(false); setConfirmDeleteCard(false); setConfirmDeleteCardFinal(false); }, [selectedDeck]);

  useEffect(() => {
    if (deckCards.length > 0 && currentIndex >= deckCards.length) {
      setCurrentIndex(deckCards.length - 1);
      setIsFlipped(false);
    }
  }, [deckCards.length]);

  const goNext = () => {
    if (deckCards.length < 2) return;
    setSwipeDir(1); setIsFlipped(false);
    setCurrentIndex(i => (i + 1) % deckCards.length);
  };
  const goPrev = () => {
    if (deckCards.length < 2) return;
    setSwipeDir(-1); setIsFlipped(false);
    setCurrentIndex(i => (i - 1 + deckCards.length) % deckCards.length);
  };
  const jumpTo = (i) => { setSwipeDir(i > currentIndex ? 1 : -1); setCurrentIndex(i); setIsFlipped(false); };

  useEffect(() => {
    const handler = (e) => {
      if (showAddCard) return;
      if (e.key === "ArrowRight") goNext();
      if (e.key === "ArrowLeft")  goPrev();
      if (e.key === " ") { e.preventDefault(); setIsFlipped(f => !f); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [currentIndex, deckCards.length, showAddCard]);

  const buildSystemPrompt = () => {
    const summaryText   = summaryEntries.map(e => e.content).join("\n\n");
    const objectiveText = objectives.map(o => `- ${o.content}`).join("\n");
    const existingCards = flashcards.map(f => `- Q: ${f.front} | A: ${f.back}`).join("\n");

    const context = [
      summaryText   && `CHAPTER SUMMARY:\n${summaryText}`,
      objectiveText && `LEARNING OBJECTIVES:\n${objectiveText}`,
      existingCards && `EXISTING FLASHCARDS (avoid duplicates):\n${existingCards}`,
    ].filter(Boolean).join("\n\n") || "No study material added yet for this chapter.";

    return `You are an expert flashcard creator helping a student study "${chapter.name}". Your job is to create high-quality flashcards that promote active recall and long-term retention.

When creating flashcards:
- One concept per card — keep it atomic and focused
- Front: a clear question, term, or prompt that tests recall (e.g. "What is...", "Define...", "How does... work?")
- Back: a concise, accurate answer (1–3 sentences max) — the student should know immediately if they got it right
- Cover a mix of: definitions, processes, comparisons, causes/effects, examples
- Avoid yes/no questions and vague prompts like "Explain everything about X"
- Do NOT duplicate any card already in the existing flashcards list

When you suggest flashcards the student should add, format each one exactly like this so they can be added with one click:
<FLASHCARD front="The question or term" back="The answer or definition" />

You can suggest individual cards, generate batches from the material, answer questions about the content, or help the student identify gaps in their card set. If the student specifies a deck name, acknowledge it in your reply.

Current chapter material:
${context}`;
  };

  // Parse <FLASHCARD front="..." back="..." /> tags from AI responses
  const parseFlashcardBlocks = (text) => {
    const parts = [];
    const re = /<FLASHCARD\s+front="([^"]*?)"\s+back="([^"]*?)"\s*\/?>/gi;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
      parts.push({ type: "flashcard", front: m[1].trim(), back: m[2].trim() });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
    return parts;
  };

  const addFlashcardFromAI = async (front, back) => {
    const deck = selectedDeck || decks[0];
    if (!deck) { toast.error("Create or select a deck first"); return; }
    await base44.entities.Flashcard.create({ chapter_id: chapter.id, deck_name: deck, front, back });
    queryClient.invalidateQueries({ queryKey: ["flashcards", chapter.id] });
    toast.success("Flashcard added to " + deck + "!");
  };

  const sendAiMessage = async (content) => {
    if (!content.trim() || aiLoading) return;
    const userMsg = { role: "user", content: content.trim() };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    localStorage.setItem(fcChatKey, JSON.stringify(updated.slice(-60)));
    setAiLoading(true);
    try {
      const reply = await callFlashcardsAI(updated, buildSystemPrompt());
      const withReply = [...updated, { role: "assistant", content: reply }];
      setAiMessages(withReply);
      localStorage.setItem(fcChatKey, JSON.stringify(withReply.slice(-60)));
    } catch {
      toast.error("AI failed to respond. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const createDeck = (nameOverride) => {
    const name = (nameOverride || newDeckName).trim();
    if (!name) return;
    if (!storedDecks.includes(name)) saveStoredDecks([...storedDecks, name]);
    setSelectedDeck(name);
    setNewDeckName("");
    setShowNewDeck(false);
    if (!nameOverride) toast.success(`Deck "${name}" ready — add flashcards below`);
  };

  const deleteDeck = async (deckName) => {
    // Delete all flashcards in this deck
    const toDelete = flashcards.filter(f => f.deck_name === deckName);
    await Promise.all(toDelete.map(f => base44.entities.Flashcard.delete(f.id)));
    queryClient.invalidateQueries({ queryKey: ["flashcards", chapter.id] });
    saveStoredDecks(storedDecks.filter(d => d !== deckName));
    if (selectedDeck === deckName) {
      const remaining = storedDecks.filter(d => d !== deckName);
      setSelectedDeck(remaining[0] ?? null);
    }
    setConfirmDeleteDeck(null);
    toast.success(`Deck "${deckName}" deleted`);
  };

  const addFlashcard = async () => {
    if (!newFront.trim() || !newBack.trim() || !selectedDeck) return;
    await base44.entities.Flashcard.create({
      chapter_id: chapter.id,
      deck_name: selectedDeck,
      front: newFront.trim(),
      back: newBack.trim(),
    });
    queryClient.invalidateQueries({ queryKey: ["flashcards", chapter.id] });
    setNewFront(""); setNewBack(""); setShowAddCard(false);
    toast.success("Flashcard added!");
  };

  const deleteCard = async (id) => {
    await base44.entities.Flashcard.delete(id);
    queryClient.invalidateQueries({ queryKey: ["flashcards", chapter.id] });
    setConfirmDeleteCard(false);
    setConfirmDeleteCardFinal(false);
  };

  const currentCard = deckCards[currentIndex] ?? null;

  const quickPrompts = [
    "Generate flashcards from the summary",
    "Generate flashcards from the learning objectives",
    "What key terms should I have flashcards for?",
    "Make 5 flashcards covering the hardest concepts",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-emerald-50 flex items-center justify-center flex-shrink-0">
          <CreditCard className="w-4 h-4 text-emerald-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800">Flashcards</h2>
          <p className="text-xs text-slate-400 truncate">{chapter.name}</p>
        </div>
        {!showAddCard && selectedDeck && (
          <Button onClick={() => setShowAddCard(true)} size="sm" variant="outline"
            className="rounded-xl border-emerald-300 text-emerald-600 hover:bg-emerald-50 flex-shrink-0 hidden md:flex">
            <Plus className="w-3.5 h-3.5 mr-1" />Add Card
          </Button>
        )}
        {/* Mobile panel toggle */}
        <div className="flex md:hidden bg-slate-100 rounded-xl p-0.5 flex-shrink-0">
          {[["cards", "Cards"], ["ai", "✨ AI"]].map(([id, label]) => (
            <button key={id} onClick={() => setMobilePanel(id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition",
                mobilePanel === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Flashcard viewer */}
        <div className={cn(
          "flex-1 flex flex-col overflow-hidden",
          mobilePanel !== "cards" ? "hidden md:flex" : "flex"
        )}>
          {/* Deck tabs */}
          <div className="px-4 pt-4 pb-0 flex-shrink-0">
            <div className="flex items-center gap-2 flex-wrap">
              {decks.map(deck => (
                <div key={deck} className="relative group flex items-center">
                  {confirmDeleteDeck === deck ? (
                    <div className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-red-50 border border-red-200">
                      <span className="text-xs text-red-600 font-medium">Delete "{deck}"?</span>
                      <button onClick={() => deleteDeck(deck)} className="px-1.5 py-0.5 rounded-lg bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition">Yes</button>
                      <button onClick={() => setConfirmDeleteDeck(null)} className="px-1.5 py-0.5 rounded-lg bg-white text-slate-600 text-xs font-semibold hover:bg-slate-100 border border-slate-200 transition">No</button>
                    </div>
                  ) : (
                    <button onClick={() => setSelectedDeck(deck)}
                      className={cn("pl-4 pr-2 py-1.5 rounded-xl text-sm font-medium transition flex items-center gap-1.5",
                        selectedDeck === deck
                          ? "bg-emerald-600 text-white shadow-sm"
                          : "bg-white border border-slate-200 text-slate-600 hover:border-emerald-300 hover:text-emerald-600"
                      )}>
                      {deck}
                      <span
                        onClick={(e) => { e.stopPropagation(); setConfirmDeleteDeck(deck); }}
                        className={cn("rounded-full p-0.5 transition",
                          selectedDeck === deck
                            ? "opacity-60 hover:opacity-100 hover:bg-emerald-700"
                            : "opacity-0 group-hover:opacity-60 hover:!opacity-100 hover:bg-slate-200"
                        )}
                      >
                        <X className="w-3 h-3" />
                      </span>
                    </button>
                  )}
                </div>
              ))}
              {showNewDeck ? (
                <div className="flex gap-2 items-center">
                  <Input autoFocus value={newDeckName} onChange={e => setNewDeckName(e.target.value)}
                    onKeyDown={e => { if (e.key === "Enter") createDeck(); if (e.key === "Escape") setShowNewDeck(false); }}
                    placeholder="Deck name" className="rounded-xl h-8 w-36 text-sm" />
                  <Button size="sm" onClick={createDeck} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 h-8 text-xs px-3">Create</Button>
                  <Button size="sm" variant="outline" onClick={() => { setShowNewDeck(false); setNewDeckName(""); }} className="rounded-xl h-8 text-xs px-3">✕</Button>
                </div>
              ) : (
                <button onClick={() => setShowNewDeck(true)}
                  className="px-3 py-1.5 rounded-xl text-sm border border-dashed border-slate-300 text-slate-400 hover:border-emerald-400 hover:text-emerald-600 transition flex items-center gap-1">
                  <Plus className="w-3.5 h-3.5" />New Deck
                </button>
              )}
            </div>
          </div>

          {/* Add card form */}
          {showAddCard && (
            <div className="mx-4 mt-4 bg-white rounded-2xl border border-slate-200 p-5 space-y-4 flex-shrink-0">
              <h3 className="text-sm font-semibold text-slate-700">Add flashcard to "{selectedDeck}"</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Front (Term / Question)</label>
                  <textarea autoFocus value={newFront} onChange={e => setNewFront(e.target.value)}
                    placeholder="e.g. Mitosis" rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 placeholder:text-slate-300" />
                </div>
                <div>
                  <label className="text-xs font-medium text-slate-500 mb-1.5 block">Back (Definition / Answer)</label>
                  <textarea value={newBack} onChange={e => setNewBack(e.target.value)}
                    placeholder="e.g. Cell division producing two identical daughter cells" rows={3}
                    className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 placeholder:text-slate-300" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <Button variant="outline" onClick={() => { setShowAddCard(false); setNewFront(""); setNewBack(""); }} className="rounded-xl">Cancel</Button>
                <Button onClick={addFlashcard} disabled={!newFront.trim() || !newBack.trim()} className="rounded-xl bg-emerald-600 hover:bg-emerald-700">Add Flashcard</Button>
              </div>
            </div>
          )}

          {/* Card area */}
          {!selectedDeck ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-7 h-7 text-emerald-200" />
                </div>
                <p className="text-slate-500 font-medium">No decks yet</p>
                <p className="text-sm text-slate-400 mt-1">Create a deck or ask the AI to generate cards</p>
              </div>
            </div>
          ) : deckCards.length === 0 ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-3">
                  <CreditCard className="w-7 h-7 text-emerald-200" />
                </div>
                <p className="text-slate-500 font-medium">No cards in this deck yet</p>
                <p className="text-sm text-slate-400 mt-1 mb-4">Add manually or ask the AI to generate some</p>
                <Button onClick={() => setShowAddCard(true)} className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-5">
                  <Plus className="w-4 h-4 mr-1.5" />Add Flashcard
                </Button>
              </div>
            </div>
          ) : !currentCard ? null : (
            <div className="flex-1 flex flex-col items-center justify-center px-4 py-4 select-none">
              <p className="text-xs text-slate-400 font-medium mb-4 tracking-wide">
                {currentIndex + 1} / {deckCards.length}
              </p>
              <div className="relative w-full max-w-sm flex items-center justify-center">
                <button onClick={goPrev} disabled={deckCards.length <= 1}
                  className="absolute left-0 z-10 p-2.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 shadow-sm transition disabled:opacity-30">
                  <ChevronLeft className="w-5 h-5" />
                </button>
                <div className="w-full px-14 overflow-hidden">
                  <AnimatePresence custom={swipeDir} mode="wait">
                    <motion.div
                      key={currentCard.id}
                      custom={swipeDir}
                      initial={{ x: swipeDir > 0 ? 280 : -280, opacity: 0, scale: 0.94 }}
                      animate={{ x: 0, opacity: 1, scale: 1 }}
                      exit={{ x: swipeDir > 0 ? -280 : 280, opacity: 0, scale: 0.94 }}
                      transition={{ type: "spring", stiffness: 320, damping: 32 }}
                      drag="x"
                      dragConstraints={{ left: 0, right: 0 }}
                      dragElastic={0.12}
                      onDragStart={() => { wasDragging.current = false; }}
                      onDragEnd={(_, info) => {
                        if (Math.abs(info.offset.x) > 8) wasDragging.current = true;
                        if (info.offset.x < -SWIPE_THRESHOLD) goNext();
                        else if (info.offset.x > SWIPE_THRESHOLD) goPrev();
                      }}
                      style={{ touchAction: "none" }}
                    >
                      <div style={{ perspective: "1000px" }}>
                        <div
                          onMouseDown={() => { mouseDownTime.current = Date.now(); }}
                          onTouchStart={() => { mouseDownTime.current = Date.now(); }}
                          onClick={() => {
                            const held = mouseDownTime.current && (Date.now() - mouseDownTime.current) > 200;
                            mouseDownTime.current = null;
                            if (!wasDragging.current && !held) setIsFlipped(f => !f);
                          }}
                          style={{
                            transformStyle: "preserve-3d",
                            transform: isFlipped ? "rotateY(180deg)" : "rotateY(0deg)",
                            transition: "transform 0.52s cubic-bezier(0.4, 0, 0.2, 1)",
                            position: "relative",
                            height: "260px",
                            cursor: "pointer",
                          }}
                        >
                          <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden" }}
                            className="absolute inset-0 bg-white rounded-3xl border-2 border-slate-200 shadow-xl flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                            <span className="text-xs font-semibold text-slate-300 uppercase tracking-widest mb-3 flex-shrink-0">Term</span>
                            <p className="font-bold text-slate-800 leading-snug w-full max-h-[150px] overflow-y-auto" style={{ fontSize: "clamp(0.65rem, 3.5vw, 1.25rem)" }}>{currentCard.front}</p>
                            <span className="absolute bottom-5 text-xs text-slate-300 flex items-center gap-1.5">
                              <RotateCcw className="w-3 h-3" /> Tap to flip
                            </span>
                          </div>
                          <div style={{ backfaceVisibility: "hidden", WebkitBackfaceVisibility: "hidden", transform: "rotateY(180deg)" }}
                            className="absolute inset-0 bg-emerald-600 rounded-3xl shadow-xl flex flex-col items-center justify-center p-6 text-center overflow-hidden">
                            <span className="text-xs font-semibold text-emerald-300 uppercase tracking-widest mb-3 flex-shrink-0">Answer</span>
                            <p className="font-semibold text-white leading-relaxed w-full max-h-[150px] overflow-y-auto" style={{ fontSize: "clamp(0.6rem, 3vw, 1.1rem)" }}>{currentCard.back}</p>
                            <span className="absolute bottom-5 text-xs text-emerald-300 flex items-center gap-1.5">
                              <RotateCcw className="w-3 h-3" /> Tap to flip back
                            </span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  </AnimatePresence>
                </div>
                <button onClick={goNext} disabled={deckCards.length <= 1}
                  className="absolute right-0 z-10 p-2.5 rounded-full bg-white border border-slate-200 text-slate-500 hover:border-emerald-300 hover:text-emerald-600 shadow-sm transition disabled:opacity-30">
                  <ChevronRight className="w-5 h-5" />
                </button>
              </div>
              {deckCards.length <= 12 && (
                <div className="flex gap-1.5 mt-6">
                  {deckCards.map((_, i) => (
                    <button key={i} onClick={() => jumpTo(i)}
                      className={cn("rounded-full transition-all duration-200",
                        i === currentIndex ? "w-5 h-2 bg-emerald-500" : "w-2 h-2 bg-slate-300 hover:bg-slate-400"
                      )} />
                  ))}
                </div>
              )}
              <div className="flex items-center gap-4 mt-5">
                {confirmDeleteCardFinal ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-red-600 font-semibold">This is permanent.</span>
                    <button onClick={() => deleteCard(currentCard.id)}
                      className="px-2.5 py-1 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 transition">Confirm</button>
                    <button onClick={() => { setConfirmDeleteCardFinal(false); setConfirmDeleteCard(false); }}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition">Cancel</button>
                  </div>
                ) : confirmDeleteCard ? (
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-red-500 font-medium">Delete this card?</span>
                    <button onClick={() => setConfirmDeleteCardFinal(true)}
                      className="px-2.5 py-1 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 transition">Yes</button>
                    <button onClick={() => setConfirmDeleteCard(false)}
                      className="px-2.5 py-1 rounded-xl bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmDeleteCard(true)}
                    className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-red-400 transition px-3 py-1.5 rounded-xl hover:bg-red-50">
                    <Trash2 className="w-3.5 h-3.5" />Delete card
                  </button>
                )}
                <span className="text-xs text-slate-300">← → to navigate · Space to flip</span>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT — AI Chat */}
        <div className={cn(
          "w-full md:w-96 border-l border-slate-100 bg-white flex flex-col flex-shrink-0",
          mobilePanel !== "ai" ? "hidden md:flex" : "flex"
        )}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {aiMessages.length === 0 ? (
              <div className="space-y-3 pt-4">
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-6 h-6 text-emerald-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">AI Flashcard Assistant</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Generate flashcards from your summary & objectives, or ask for suggestions
                  </p>
                  {selectedDeck && (
                    <p className="text-xs text-emerald-600 font-medium mt-1.5">
                      Adding to: <span className="font-bold">{selectedDeck}</span>
                    </p>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => sendAiMessage(q)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 hover:border-emerald-300 hover:bg-emerald-50 text-slate-600 hover:text-emerald-700 transition bg-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-emerald-600 text-white rounded-tr-sm px-3 py-2.5 whitespace-pre-wrap"
                      : "bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100 overflow-hidden"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="p-3 space-y-2">
                        {parseFlashcardBlocks(msg.content).map((part, pi) =>
                          part.type === "text" ? (
                            <p key={pi} className="whitespace-pre-wrap text-slate-800 leading-relaxed">{part.content}</p>
                          ) : (
                            <div key={pi} className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-1.5">
                              <p className="text-xs font-semibold text-emerald-600 uppercase tracking-wide">Suggested flashcard</p>
                              <p className="text-xs font-semibold text-slate-700">Q: {part.front}</p>
                              <p className="text-xs text-slate-600">A: {part.back}</p>
                              <button
                                onClick={() => addFlashcardFromAI(part.front, part.back)}
                                className="flex items-center gap-1.5 text-xs font-semibold text-emerald-600 hover:text-emerald-800 transition mt-1"
                              >
                                <Check className="w-3.5 h-3.5" />
                                Add to {selectedDeck || "deck"}
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            {aiLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-xl bg-emerald-100 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-emerald-600 animate-spin" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-emerald-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-slate-100 px-4 py-4 flex-shrink-0">
            {selectedDeck && (
              <p className="text-xs text-slate-400 mb-2">
                Cards will be added to <span className="font-semibold text-emerald-600">{selectedDeck}</span>
              </p>
            )}
            <div className="flex gap-2 items-end">
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(aiInput); } }}
                placeholder="Ask AI to generate flashcards…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-200 placeholder:text-slate-300 max-h-28 overflow-y-auto"
              />
              <Button
                onClick={() => sendAiMessage(aiInput)}
                disabled={!aiInput.trim() || aiLoading}
                className="rounded-xl bg-emerald-600 hover:bg-emerald-700 px-3 self-end h-10 flex-shrink-0"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─── LearningObjectivesView ───────────────────────────────────────────────────

function LearningObjectivesView({ chapter, onBack }) {
  const queryClient = useQueryClient();

  const { data: objectives = [] } = useQuery({
    queryKey: ["objectives", chapter.id],
    queryFn: () => base44.entities.LearningObjective.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  const { data: summaryEntries = [] } = useQuery({
    queryKey: ["summaryEntries", chapter.id],
    queryFn: () => base44.entities.ChapterSummaryEntry.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  const { data: flashcards = [] } = useQuery({
    queryKey: ["flashcards", chapter.id],
    queryFn: () => base44.entities.Flashcard.filter({ chapter_id: chapter.id }, "created_at"),
    enabled: !!chapter.id,
  });

  useEffect(() => {
    const unsub = base44.entities.LearningObjective.subscribe(() =>
      queryClient.invalidateQueries({ queryKey: ["objectives", chapter.id] })
    );
    return unsub;
  }, [chapter.id]);

  // Objectives state
  const [showManualAdd, setShowManualAdd] = useState(false);
  const [manualText, setManualText]       = useState("");

  // AI chat state
  const objChatKey = getObjectivesAIKey(chapter.id);
  const [aiMessages, setAiMessages] = useState(() => {
    try { return JSON.parse(localStorage.getItem(objChatKey) || "[]"); } catch { return []; }
  });
  const [aiInput, setAiInput]   = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const messagesEndRef = useRef(null);

  // Mobile panel toggle
  const [mobilePanel, setMobilePanel] = useState("objectives");

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiMessages]);

  const buildSystemPrompt = () => {
    const summaryText      = summaryEntries.map(e => e.content).join("\n\n");
    const flashcardText    = flashcards.map(f => `- ${f.front}: ${f.back}`).join("\n");
    const existingObjs     = objectives.map(o => `- ${o.content}`).join("\n");

    const context = [
      summaryText   && `CHAPTER SUMMARY:\n${summaryText}`,
      flashcardText && `FLASHCARDS:\n${flashcardText}`,
      existingObjs  && `ALREADY SAVED OBJECTIVES (do not repeat these):\n${existingObjs}`,
    ].filter(Boolean).join("\n\n") || "No study material added yet for this chapter.";

    return `You are an expert educational assistant helping a student master "${chapter.name}". Your role is to help them create precise, measurable learning objectives that will guide their study and exam preparation.

When suggesting objectives, apply Bloom's Taxonomy — choose action verbs that match the required cognitive level:
- Remember: define, list, recall, recognise, name, state
- Understand: explain, summarise, describe, paraphrase, classify, interpret
- Apply: solve, demonstrate, use, calculate, implement, show
- Analyse: compare, differentiate, examine, break down, contrast, distinguish
- Evaluate: justify, critique, assess, judge, argue, defend
- Create: design, construct, formulate, develop, compose, produce

Each objective must:
- Start with a precise, measurable action verb (never "understand" or "know" — these cannot be tested)
- Describe a specific, observable outcome tied to the actual chapter content
- Be concise: one clear sentence

When you suggest objectives the student should save, wrap each one in <OBJECTIVE>...</OBJECTIVE> tags so they can add it with one click. Aim for a mix of lower-order (recall, understand) and higher-order (apply, analyse, evaluate) objectives.

You can also answer questions about the material, explain concepts, identify knowledge gaps, or suggest study strategies based on the chapter content.

Current chapter material:
${context}`;
  };

  // Parse <OBJECTIVE>...</OBJECTIVE> tags from AI responses
  const parseObjectiveBlocks = (text) => {
    const parts = [];
    const re = /<OBJECTIVE>([\s\S]*?)<\/OBJECTIVE>/g;
    let last = 0, m;
    while ((m = re.exec(text)) !== null) {
      if (m.index > last) parts.push({ type: "text", content: text.slice(last, m.index) });
      parts.push({ type: "objective", content: m[1].trim() });
      last = re.lastIndex;
    }
    if (last < text.length) parts.push({ type: "text", content: text.slice(last) });
    return parts;
  };

  const sendAiMessage = async (content) => {
    if (!content.trim() || aiLoading) return;
    const userMsg = { role: "user", content: content.trim() };
    const updated = [...aiMessages, userMsg];
    setAiMessages(updated);
    setAiInput("");
    localStorage.setItem(objChatKey, JSON.stringify(updated.slice(-60)));
    setAiLoading(true);
    try {
      const reply = await callObjectivesAI(updated, buildSystemPrompt());
      const withReply = [...updated, { role: "assistant", content: reply }];
      setAiMessages(withReply);
      localStorage.setItem(objChatKey, JSON.stringify(withReply.slice(-60)));
    } catch {
      toast.error("AI failed to respond. Please try again.");
    } finally {
      setAiLoading(false);
    }
  };

  const addObjective = async (content, aiGenerated = false) => {
    if (!content.trim()) return;
    await base44.entities.LearningObjective.create({
      chapter_id: chapter.id,
      content: content.trim(),
      ai_generated: aiGenerated,
    });
    queryClient.invalidateQueries({ queryKey: ["objectives", chapter.id] });
  };

  const deleteObjective = async (id) => {
    await base44.entities.LearningObjective.delete(id);
    queryClient.invalidateQueries({ queryKey: ["objectives", chapter.id] });
  };

  const quickPrompts = [
    "Generate learning objectives for this chapter",
    "What are the most important things I need to know?",
    "Give me higher-order thinking objectives (analyse & evaluate)",
    "Create objectives based on my flashcards",
  ];

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-100 px-4 py-4 flex items-center gap-3 flex-shrink-0">
        <button onClick={onBack} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 hover:text-slate-700 transition">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="w-9 h-9 rounded-xl bg-violet-50 flex items-center justify-center flex-shrink-0">
          <Target className="w-4.5 h-4.5 text-violet-500" />
        </div>
        <div className="flex-1 min-w-0">
          <h2 className="text-base font-bold text-slate-800">Learning Objectives</h2>
          <p className="text-xs text-slate-400 truncate">{chapter.name}</p>
        </div>
        {/* Mobile panel toggle */}
        <div className="flex md:hidden bg-slate-100 rounded-xl p-0.5 flex-shrink-0">
          {[["objectives", "Objectives"], ["ai", "✨ AI"]].map(([id, label]) => (
            <button key={id} onClick={() => setMobilePanel(id)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition",
                mobilePanel === id ? "bg-white text-slate-800 shadow-sm" : "text-slate-500"
              )}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Two-panel body */}
      <div className="flex-1 flex overflow-hidden">

        {/* LEFT — Your Objectives */}
        <div className={cn(
          "flex-1 overflow-y-auto px-5 py-5",
          mobilePanel !== "objectives" ? "hidden md:block" : "block"
        )}>
          <div className="max-w-xl mx-auto space-y-5">

            {/* Saved objectives */}
            {objectives.length > 0 && (
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-3">Your Objectives</p>
                <div className="space-y-2">
                  <AnimatePresence>
                    {objectives.map((obj, i) => (
                      <motion.div
                        key={obj.id}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 8 }}
                        className="bg-white rounded-xl border border-slate-200 px-4 py-3 flex items-start gap-3 group"
                      >
                        <div className="w-6 h-6 rounded-full bg-violet-100 text-violet-600 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                          {i + 1}
                        </div>
                        <p className="flex-1 text-sm text-slate-700 leading-relaxed">{obj.content}</p>
                        <div className="flex items-center gap-2 flex-shrink-0 opacity-0 group-hover:opacity-100 transition">
                          {obj.ai_generated && (
                            <span className="text-xs text-violet-400 font-medium">AI</span>
                          )}
                          <button
                            onClick={() => deleteObjective(obj.id)}
                            className="p-1 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-400 transition"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}

            {/* Empty state */}
            {objectives.length === 0 && (
              <div className="text-center py-12">
                <div className="w-14 h-14 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-3">
                  <Target className="w-7 h-7 text-violet-200" />
                </div>
                <p className="text-slate-500 font-medium">No learning objectives yet</p>
                <p className="text-sm text-slate-400 mt-1">Use the AI chat to generate objectives, or add one manually below</p>
              </div>
            )}

            {/* Manual add form / button */}
            {showManualAdd ? (
              <div className="bg-white rounded-2xl border border-slate-200 p-5 space-y-3">
                <p className="text-sm font-semibold text-slate-700">Add learning objective</p>
                <textarea
                  autoFocus
                  value={manualText}
                  onChange={e => setManualText(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                      addObjective(manualText);
                      setManualText("");
                      setShowManualAdd(false);
                    }
                  }}
                  placeholder='e.g. "Explain the difference between mitosis and meiosis"'
                  rows={3}
                  className="w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 placeholder:text-slate-300"
                />
                <div className="flex gap-2 justify-end">
                  <Button variant="outline" onClick={() => { setShowManualAdd(false); setManualText(""); }} className="rounded-xl text-sm">Cancel</Button>
                  <Button
                    onClick={() => { addObjective(manualText); setManualText(""); setShowManualAdd(false); }}
                    disabled={!manualText.trim()}
                    className="rounded-xl bg-violet-600 hover:bg-violet-700 text-sm"
                  >
                    Add Objective
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                onClick={() => setShowManualAdd(true)}
                className="rounded-xl border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 text-sm w-full"
              >
                <Plus className="w-4 h-4 mr-1.5" />
                Add manually
              </Button>
            )}
          </div>
        </div>

        {/* RIGHT — AI Chat */}
        <div className={cn(
          "w-full md:w-96 border-l border-slate-100 bg-white flex flex-col flex-shrink-0",
          mobilePanel !== "ai" ? "hidden md:flex" : "flex"
        )}>
          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
            {aiMessages.length === 0 ? (
              <div className="space-y-3 pt-4">
                <div className="text-center py-6">
                  <div className="w-12 h-12 rounded-2xl bg-violet-50 flex items-center justify-center mx-auto mb-2">
                    <Sparkles className="w-6 h-6 text-violet-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-700">AI Objectives Assistant</p>
                  <p className="text-xs text-slate-400 mt-1 leading-relaxed">
                    Chat to generate objectives, ask about the chapter, or identify knowledge gaps
                  </p>
                </div>
                <div className="grid grid-cols-1 gap-2">
                  {quickPrompts.map(q => (
                    <button key={q} onClick={() => sendAiMessage(q)}
                      className="text-left text-xs px-3 py-2.5 rounded-xl border border-slate-200 hover:border-violet-300 hover:bg-violet-50 text-slate-600 hover:text-violet-700 transition bg-white">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              aiMessages.map((msg, i) => (
                <div key={i} className={cn("flex gap-2", msg.role === "user" ? "justify-end" : "justify-start")}>
                  {msg.role === "assistant" && (
                    <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0 mt-1">
                      <Sparkles className="w-3.5 h-3.5 text-violet-600" />
                    </div>
                  )}
                  <div className={cn(
                    "max-w-[85%] rounded-2xl text-sm leading-relaxed",
                    msg.role === "user"
                      ? "bg-violet-600 text-white rounded-tr-sm px-3 py-2.5 whitespace-pre-wrap"
                      : "bg-white text-slate-800 rounded-tl-sm shadow-sm border border-slate-100 overflow-hidden"
                  )}>
                    {msg.role === "assistant" ? (
                      <div className="p-3 space-y-2">
                        {parseObjectiveBlocks(msg.content).map((part, pi) =>
                          part.type === "text" ? (
                            <p key={pi} className="whitespace-pre-wrap text-slate-800 leading-relaxed">{part.content}</p>
                          ) : (
                            <div key={pi} className="bg-violet-50 border border-violet-200 rounded-xl p-3 space-y-2">
                              <p className="text-xs font-semibold text-violet-600 uppercase tracking-wide">Suggested objective</p>
                              <p className="text-sm text-slate-700 leading-relaxed">{part.content}</p>
                              <button
                                onClick={async () => {
                                  await addObjective(part.content, true);
                                  toast.success("Objective added!");
                                }}
                                className="flex items-center gap-1.5 text-xs font-semibold text-violet-600 hover:text-violet-800 transition"
                              >
                                <Check className="w-3.5 h-3.5" /> Add to my objectives
                              </button>
                            </div>
                          )
                        )}
                      </div>
                    ) : (
                      msg.content
                    )}
                  </div>
                </div>
              ))
            )}
            {aiLoading && (
              <div className="flex gap-2 justify-start">
                <div className="w-7 h-7 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                  <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                </div>
                <div className="bg-white rounded-2xl rounded-tl-sm shadow-sm border border-slate-100 px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-1.5 h-1.5 bg-violet-300 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border-t border-slate-100 px-4 py-4 flex-shrink-0">
            <div className="flex gap-2 items-end">
              <textarea
                value={aiInput}
                onChange={e => setAiInput(e.target.value)}
                onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendAiMessage(aiInput); } }}
                placeholder="Ask the AI about objectives…"
                rows={1}
                className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-200 placeholder:text-slate-300 max-h-28 overflow-y-auto"
              />
              <Button
                onClick={() => sendAiMessage(aiInput)}
                disabled={!aiInput.trim() || aiLoading}
                className="rounded-xl bg-violet-600 hover:bg-violet-700 px-3 self-end h-10 flex-shrink-0"
              >
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              </Button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
