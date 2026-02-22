import React, { useState } from "react";
import { Upload, X, Smartphone, Loader2, ChevronDown, ChevronUp, RefreshCw } from "lucide-react";
import { toast } from "sonner";

// Compress screenshot before storing in localStorage to keep size manageable
async function compressImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const maxW = 1200;
      let { width, height } = img;
      if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      resolve(canvas.toDataURL('image/jpeg', 0.8));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Failed to load image')); };
    img.src = url;
  });
}

async function analyzeScreentime(dataUrl) {
  const base64 = dataUrl.split(',')[1];
  const response = await fetch('/api/claude', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-5',
      max_tokens: 1024,
      messages: [{
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          {
            type: 'text',
            text: 'Analyze this phone screen time screenshot. Respond ONLY with a valid JSON object using these exact fields: {"total_time":"e.g. 4h 23m","top_apps":["Instagram: 1h 30m","YouTube: 45m"],"insights":["2-3 short actionable accountability tips"],"summary":"one sentence summary"}'
          }
        ]
      }]
    }),
  });
  if (!response.ok) throw new Error('API error');
  const data = await response.json();
  const text = data.content?.[0]?.text || '';
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('No JSON in response');
  return JSON.parse(match[0]);
}

const MAX_FILES = 5;

export default function ScreentimeUpload({ profile, saveMutation, compact = false }) {
  const [open, setOpen] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(null); // index being analyzed
  const fileInputRef = React.useRef(null);

  const screentimeFiles = profile?.screentime_files || [];

  const handleFileSelect = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    if (screentimeFiles.length >= MAX_FILES) {
      toast.error(`Max ${MAX_FILES} screenshots. Delete one first.`);
      return;
    }
    setIsUploading(true);
    try {
      const uploaded = [];
      for (const file of files.slice(0, MAX_FILES - screentimeFiles.length)) {
        if (!file.type.startsWith('image/')) {
          toast.error(`${file.name} is not an image`);
          continue;
        }
        const dataUrl = await compressImage(file);
        uploaded.push({ name: file.name, dataUrl, type: 'image/jpeg', uploaded_at: new Date().toISOString() });
      }
      if (!uploaded.length) return;
      const newFiles = [...screentimeFiles, ...uploaded];
      if (profile?.id) {
        await saveMutation.mutateAsync({ screentime_files: newFiles });
        toast.success(`${uploaded.length} screenshot${uploaded.length > 1 ? "s" : ""} uploaded!`);
      }
      // Auto-analyze the last uploaded image
      const lastIdx = newFiles.length - 1;
      await handleRunAnalysis(uploaded[uploaded.length - 1], lastIdx, newFiles);
    } catch {
      toast.error("Failed to upload screenshot");
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Pass currentFiles explicitly to avoid stale closure issues
  const handleRunAnalysis = async (file, idx, currentFiles) => {
    if (!file?.dataUrl) {
      toast.error("No image data — please re-upload this screenshot");
      return;
    }
    setAnalyzing(idx);
    try {
      const analysis = await analyzeScreentime(file.dataUrl);
      const files = currentFiles || screentimeFiles;
      const updatedFiles = files.map((f, i) => i === idx ? { ...f, analysis } : f);
      if (profile?.id) {
        await saveMutation.mutateAsync({ screentime_files: updatedFiles });
        toast.success("Analysis saved!");
      }
    } catch {
      toast.error("Analysis failed — check your connection");
    } finally {
      setAnalyzing(null);
    }
  };

  const handleDelete = (idx) => {
    const newFiles = screentimeFiles.filter((_, i) => i !== idx);
    if (profile?.id) {
      saveMutation.mutate({ screentime_files: newFiles });
      toast.success("Removed");
    }
  };

  if (compact) {
    const lastThree = screentimeFiles.slice(-3);
    const baseIdx = screentimeFiles.length - Math.min(3, screentimeFiles.length);

    return (
      <div className="border-b border-slate-100">
        <button onClick={() => setOpen(o => !o)}
          className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600">
              <Smartphone className="w-4 h-4" />
            </div>
            <div className="text-left">
              <p className="text-sm font-semibold text-slate-700">Screen Time</p>
              <p className="text-xs text-slate-400">
                {screentimeFiles.length > 0 ? `${screentimeFiles.length} uploaded` : "Upload for accountability"}
              </p>
            </div>
          </div>
          {open ? <ChevronUp className="w-3.5 h-3.5 text-slate-300" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-300" />}
        </button>

        {open && (
          <div className="px-4 pb-4 space-y-2">
            {lastThree.map((file, i) => {
              const realIdx = baseIdx + i;
              const isAnalyzing = analyzing === realIdx;
              return (
                <div key={realIdx} className="bg-orange-50 border border-orange-100 rounded-lg overflow-hidden">
                  {file.dataUrl && (
                    <img src={file.dataUrl} alt={file.name} className="w-full h-24 object-cover object-top" />
                  )}
                  <div className="flex items-center gap-2 px-2.5 py-1.5 group">
                    <span className="text-xs text-slate-600 flex-1 truncate">{file.name}</span>
                    <button onClick={() => handleRunAnalysis(file, realIdx)} disabled={isAnalyzing}
                      className="text-orange-500 hover:text-orange-700 transition flex-shrink-0" title="Analyze">
                      {isAnalyzing
                        ? <Loader2 className="w-3 h-3 animate-spin" />
                        : <RefreshCw className="w-3 h-3" />}
                    </button>
                    <button onClick={() => handleDelete(realIdx)}
                      className="text-slate-400 hover:text-red-500 transition flex-shrink-0 opacity-0 group-hover:opacity-100">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                  {file.analysis && (
                    <div className="px-2.5 pb-2 space-y-0.5">
                      {file.analysis.total_time && (
                        <p className="text-xs font-semibold text-orange-700">📱 {file.analysis.total_time}</p>
                      )}
                      {file.analysis.insights?.map((ins, j) => (
                        <p key={j} className="text-xs text-slate-600">• {ins}</p>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {screentimeFiles.length < MAX_FILES && (
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="w-full py-2 rounded-lg border border-dashed border-orange-300 text-xs text-orange-500 hover:bg-orange-50 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                {isUploading
                  ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Uploading...</>
                  : <><Upload className="w-3.5 h-3.5" /> Upload screenshot</>}
              </button>
            )}
            <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
          </div>
        )}
      </div>
    );
  }

  // Full version for Settings page
  return (
    <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 bg-orange-100 text-orange-600">
            <Smartphone className="w-4 h-4" />
          </div>
          <div className="text-left">
            <p className="text-sm font-bold text-slate-800">Screen Time</p>
            <p className="text-xs text-slate-400">
              {screentimeFiles.length > 0
                ? `${screentimeFiles.length} screenshot${screentimeFiles.length > 1 ? "s" : ""} uploaded`
                : "Upload screenshots for accountability"}
            </p>
          </div>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-slate-300" /> : <ChevronDown className="w-4 h-4 text-slate-300" />}
      </button>

      {open && (
        <div className="px-6 pb-5 space-y-3">
          <p className="text-xs text-slate-500">
            Upload your iPhone/Android screen time screenshots. Your AI coach will analyze them and reference them in conversations.
          </p>

          {screentimeFiles.map((file, i) => {
            const isAnalyzing = analyzing === i;
            return (
              <div key={i} className="border border-orange-100 rounded-xl overflow-hidden bg-white">
                {file.dataUrl && (
                  <img
                    src={file.dataUrl}
                    alt={file.name}
                    className="w-full max-h-56 object-contain bg-slate-50"
                  />
                )}
                <div className="flex items-center gap-3 px-4 py-2.5 group">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{file.name}</p>
                    <p className="text-xs text-slate-400">{new Date(file.uploaded_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex gap-2 items-center flex-shrink-0">
                    <button
                      onClick={() => handleRunAnalysis(file, i)}
                      disabled={isAnalyzing}
                      className="text-xs text-orange-500 hover:text-orange-700 font-medium flex items-center gap-1 transition"
                    >
                      {isAnalyzing
                        ? <><Loader2 className="w-3 h-3 animate-spin" /> Analyzing...</>
                        : <><RefreshCw className="w-3 h-3" /> {file.analysis ? "Re-analyze" : "Analyze"}</>}
                    </button>
                    <button onClick={() => handleDelete(i)}
                      className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-500 transition">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>

                {file.analysis && (
                  <div className="bg-orange-50 border-t border-orange-100 px-4 py-3 space-y-1.5">
                    <p className="text-xs font-bold text-orange-800">📊 Screen Time Analysis</p>
                    {file.analysis.total_time && (
                      <p className="text-sm text-slate-700">📱 Total: <strong>{file.analysis.total_time}</strong></p>
                    )}
                    {file.analysis.top_apps?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-0.5">Top apps:</p>
                        {file.analysis.top_apps.map((app, j) => (
                          <p key={j} className="text-xs text-slate-600">• {app}</p>
                        ))}
                      </div>
                    )}
                    {file.analysis.insights?.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-slate-600 mb-0.5">Insights:</p>
                        {file.analysis.insights.map((ins, j) => (
                          <p key={j} className="text-xs text-slate-600">• {ins}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {screentimeFiles.length < MAX_FILES ? (
            <>
              <button onClick={() => fileInputRef.current?.click()} disabled={isUploading}
                className="w-full py-2.5 rounded-xl border border-dashed border-orange-300 text-sm text-orange-500 hover:bg-orange-50 disabled:opacity-50 transition flex items-center justify-center gap-1.5">
                {isUploading
                  ? <><Loader2 className="w-4 h-4 animate-spin" /> Uploading...</>
                  : <><Upload className="w-4 h-4" /> Upload screenshot</>}
              </button>
              <p className="text-xs text-slate-400 text-center">
                iPhone: Settings → Screen Time → screenshot it. Android: Digital Wellbeing.
              </p>
            </>
          ) : (
            <p className="text-xs text-slate-400 text-center">
              Max {MAX_FILES} screenshots stored. Delete one to add more.
            </p>
          )}
          <input ref={fileInputRef} type="file" onChange={handleFileSelect} className="hidden" accept="image/*" multiple />
        </div>
      )}
    </div>
  );
}
