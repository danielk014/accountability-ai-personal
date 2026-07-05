import { useState, useRef } from 'react';
import { Settings, ChevronDown, ChevronUp, Pencil, Check, X, Upload, FileText, Trash2, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';

const MAX_FILES = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

export default function ModelSettingsPanel({ modelKey, label, defaultPersonality, profile, onSaveProfile }) {
  const [open, setOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState('');
  const fileInputRef = useRef(null);

  const personality = profile?.model_personalities?.[modelKey] || '';
  const contextFiles = profile?.model_context_files?.[modelKey] || [];

  const savePersonality = (value) => {
    const updated = { ...(profile?.model_personalities || {}), [modelKey]: value };
    onSaveProfile({ model_personalities: updated });
    setIsEditing(false);
    toast.success('Custom instructions saved!');
  };

  const resetPersonality = () => {
    const updated = { ...(profile?.model_personalities || {}) };
    delete updated[modelKey];
    onSaveProfile({ model_personalities: updated });
    toast.success('Reset to default!');
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error('File too large. Max 10MB.'); e.target.value = ''; return; }
    const allowed = ['application/pdf', 'image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    if (!allowed.includes(file.type)) { toast.error('Only PDFs and images supported.'); e.target.value = ''; return; }
    if (contextFiles.length >= MAX_FILES) { toast.error(`Max ${MAX_FILES} files.`); e.target.value = ''; return; }
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve(ev.target.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const current = profile?.model_context_files || {};
      onSaveProfile({ model_context_files: { ...current, [modelKey]: [...contextFiles, { name: file.name, mediaType: file.type, data }] } });
      toast.success('File uploaded!');
    } catch { toast.error('Failed to read file.'); }
    e.target.value = '';
  };

  const deleteFile = (idx) => {
    const current = profile?.model_context_files || {};
    onSaveProfile({ model_context_files: { ...current, [modelKey]: contextFiles.filter((_, i) => i !== idx) } });
    toast.success('File removed!');
  };

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        onClick={() => setOpen(o => !o)}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm text-slate-600 hover:bg-slate-100 transition font-medium"
      >
        <Settings className="w-4 h-4" />
        {label} Settings
        {open ? <ChevronUp className="w-3.5 h-3.5 ml-1" /> : <ChevronDown className="w-3.5 h-3.5 ml-1" />}
      </button>

      {open && (
        <div className="mt-2 bg-white rounded-2xl border border-slate-200 p-5 space-y-4">
          {/* Personality / Instructions */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Custom Instructions</p>
            {isEditing ? (
              <div className="space-y-2">
                <textarea
                  value={editValue}
                  onChange={e => setEditValue(e.target.value)}
                  rows={8}
                  className="w-full text-sm rounded-xl border border-indigo-200 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white resize-y font-mono"
                />
                <div className="flex gap-2">
                  <button onClick={() => savePersonality(editValue)}
                    className="flex-1 py-2 rounded-xl bg-indigo-600 text-white text-sm font-semibold hover:bg-indigo-700 transition flex items-center justify-center gap-1">
                    <Check className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setIsEditing(false)}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-sm text-slate-500 hover:bg-slate-50 transition">Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="bg-slate-50 border border-slate-100 rounded-xl px-4 py-3 max-h-40 overflow-y-auto">
                  <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-wrap font-mono">
                    {personality || defaultPersonality}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setEditValue(personality || defaultPersonality); setIsEditing(true); }}
                    className="flex-1 py-2 rounded-xl border border-dashed border-indigo-300 text-sm text-indigo-500 hover:bg-indigo-50 transition flex items-center justify-center gap-1.5">
                    <Pencil className="w-3.5 h-3.5" /> Edit
                  </button>
                  {personality && (
                    <button onClick={resetPersonality}
                      className="px-3 py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:bg-slate-50 transition flex items-center justify-center gap-1.5"
                      title="Reset to default">
                      <RotateCcw className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Context Files */}
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">
              Knowledge Files ({contextFiles.length}/{MAX_FILES})
            </p>
            {contextFiles.length > 0 && (
              <div className="space-y-1.5 mb-2">
                {contextFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center gap-2 bg-slate-50 border border-slate-100 rounded-lg px-3 py-2">
                    <FileText className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="text-xs text-slate-600 truncate flex-1">{file.name}</span>
                    <span className="text-xs text-slate-400">{file.mediaType?.split('/')[1]?.toUpperCase()}</span>
                    <button onClick={() => deleteFile(idx)}
                      className="p-0.5 rounded hover:bg-red-50 text-slate-300 hover:text-red-500 transition">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input type="file" ref={fileInputRef} onChange={handleFileSelect} style={{ display: 'none' }}
              accept=".pdf,image/jpeg,image/png,image/gif,image/webp" />
            <button onClick={() => fileInputRef.current?.click()}
              disabled={contextFiles.length >= MAX_FILES}
              className="w-full py-2 rounded-xl border border-dashed border-slate-300 text-sm text-slate-400 hover:bg-slate-50 hover:text-slate-600 disabled:opacity-30 disabled:cursor-not-allowed transition flex items-center justify-center gap-1.5">
              <Upload className="w-3.5 h-3.5" /> Upload PDF or Image
            </button>
            <p className="text-xs text-slate-300 mt-1">Files are sent as context with every message.</p>
          </div>
        </div>
      )}
    </div>
  );
}
