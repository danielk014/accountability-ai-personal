import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Zap, CheckCircle2, AlertCircle, Loader2, ChevronRight, Clock, FileText, Image } from 'lucide-react';
import { cn } from "@/lib/utils";

const FunctionDisplay = ({ toolCall }) => {
  const [expanded, setExpanded] = useState(false);
  const name = toolCall?.name || 'Function';
  const status = toolCall?.status || 'pending';
  const results = toolCall?.results;

  const parsedResults = (() => {
    if (!results) return null;
    try { return typeof results === 'string' ? JSON.parse(results) : results; } catch { return results; }
  })();

  const isError = results && (
    (typeof results === 'string' && /error|failed/i.test(results)) ||
    (parsedResults?.success === false)
  );

  const statusConfig = {
    pending: { icon: Clock, color: 'text-slate-400', text: 'Pending' },
    running: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    in_progress: { icon: Loader2, color: 'text-slate-500', text: 'Running...', spin: true },
    completed: isError
      ? { icon: AlertCircle, color: 'text-red-500', text: 'Failed' }
      : { icon: CheckCircle2, color: 'text-emerald-500', text: 'Done' },
    success: { icon: CheckCircle2, color: 'text-emerald-500', text: 'Done' },
    failed: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' },
    error: { icon: AlertCircle, color: 'text-red-500', text: 'Failed' }
  }[status] || { icon: Zap, color: 'text-slate-500', text: '' };

  const Icon = statusConfig.icon;
  const formattedName = name.replace(/\./g, ' ').toLowerCase();

  return (
    <div className="mt-2 text-xs">
      <button
        onClick={() => setExpanded(!expanded)}
        className={cn(
          "flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all",
          "hover:bg-slate-50",
          expanded ? "bg-slate-50 border-slate-300" : "bg-white border-slate-200"
        )}
      >
        <Icon className={cn("h-3 w-3", statusConfig.color, statusConfig.spin && "animate-spin")} />
        <span className="text-slate-600">{formattedName}</span>
        {statusConfig.text && (
          <span className={cn("text-slate-400", isError && "text-red-500")}>• {statusConfig.text}</span>
        )}
        {!statusConfig.spin && (toolCall.arguments_string || results) && (
          <ChevronRight className={cn("h-3 w-3 text-slate-400 transition-transform ml-auto", expanded && "rotate-90")} />
        )}
      </button>
      {expanded && !statusConfig.spin && (
        <div className="mt-1.5 ml-3 pl-3 border-l-2 border-slate-200 space-y-2">
          {toolCall.arguments_string && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Parameters:</div>
              <pre className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 whitespace-pre-wrap overflow-auto max-h-32">
                {(() => { try { return JSON.stringify(JSON.parse(toolCall.arguments_string), null, 2); } catch { return toolCall.arguments_string; } })()}
              </pre>
            </div>
          )}
          {parsedResults && (
            <div>
              <div className="text-xs text-slate-400 mb-1">Result:</div>
              <pre className="bg-slate-50 rounded-lg p-2 text-xs text-slate-600 whitespace-pre-wrap max-h-32 overflow-auto">
                {typeof parsedResults === 'object' ? JSON.stringify(parsedResults, null, 2) : parsedResults}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default function MessageBubble({ message }) {
  const isUser = message.role === 'user';

  return (
    <div className={cn("flex gap-3", isUser ? "justify-end" : "justify-start")}>
      {!isUser && (
        <div className="h-8 w-8 rounded-xl bg-[#1e2228] flex items-center justify-center mt-0.5 flex-shrink-0 overflow-hidden">
          <img src="https://qtrypzzcjebvfcihiynt.supabase.co/storage/v1/object/public/base44-prod/public/699863bb9965c7b81ed00428/8af80c917_c05151408_logo.png" alt="AI" className="w-7 h-7 object-contain" />
        </div>
      )}
      <div className={cn("max-w-[85%]", isUser && "flex flex-col items-end")}>
        {/* Attachment chips (images inline, files as chips) */}
        {isUser && message._attachments?.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mb-1.5 justify-end">
            {message._attachments.map((att, i) => (
              att.isImage && att.preview ? (
                <img
                  key={i}
                  src={att.preview}
                  alt={att.name}
                  className="max-w-[200px] max-h-[160px] rounded-xl object-cover border border-indigo-300"
                />
              ) : (
                <div key={i} className="flex items-center gap-1.5 bg-indigo-500 text-white rounded-lg px-2.5 py-1.5 text-xs max-w-[200px]">
                  {att.isImage
                    ? <Image className="w-3.5 h-3.5 flex-shrink-0" />
                    : <FileText className="w-3.5 h-3.5 flex-shrink-0" />}
                  <span className="truncate">{att.name}</span>
                </div>
              )
            ))}
          </div>
        )}

        {(message.content || (!isUser)) && (
          <div className={cn(
            "rounded-2xl px-4 py-3",
            isUser
              ? "bg-indigo-600 text-white"
              : "bg-white border border-slate-200 shadow-sm"
          )}>
            {isUser ? (
              <p className="text-sm leading-relaxed">{message.content || <span className="opacity-60 italic text-xs">File attached</span>}</p>
            ) : (
              <ReactMarkdown
                className="text-sm prose prose-sm prose-slate max-w-none [&>*:first-child]:mt-0 [&>*:last-child]:mb-0"
                components={{
                  p: ({ children }) => <p className="my-1 leading-relaxed text-slate-700">{children}</p>,
                  ul: ({ children }) => <ul className="my-1 ml-4 list-disc">{children}</ul>,
                  ol: ({ children }) => <ol className="my-1 ml-4 list-decimal">{children}</ol>,
                  li: ({ children }) => <li className="my-0.5 text-slate-700">{children}</li>,
                  strong: ({ children }) => <strong className="font-semibold text-slate-900">{children}</strong>,
                  a: ({ children, ...props }) => (
                    <a {...props} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">{children}</a>
                  ),
                  code: ({ inline, children, ...props }) =>
                    inline ? (
                      <code className="px-1 py-0.5 rounded bg-slate-100 text-slate-700 text-xs">{children}</code>
                    ) : (
                      <pre className="bg-slate-900 text-slate-100 rounded-lg p-3 overflow-x-auto my-2">
                        <code {...props}>{children}</code>
                      </pre>
                    ),
                }}
              >
                {message.content}
              </ReactMarkdown>
            )}
          </div>
        )}
        {message.tool_calls?.filter(tc => {
           const n = (tc?.name || '').toLowerCase();
           return !n.includes('read_') && !n.includes('update_');
         }).length > 0 && (
           <div className="space-y-1 mt-1">
             {message.tool_calls
               .filter(tc => {
                 const n = (tc?.name || '').toLowerCase();
                 return !n.includes('read_') && !n.includes('update_');
               })
               .map((tc, idx) => (
                 <FunctionDisplay key={idx} toolCall={tc} />
               ))}
           </div>
         )}
      </div>
    </div>
  );
}