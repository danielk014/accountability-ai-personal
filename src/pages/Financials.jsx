import React, { useState, useEffect, useRef } from "react";
import { isStorageReady } from "@/api/supabaseStorage";
import { createPortal } from "react-dom";
import {
  TrendingUp, TrendingDown, Wallet,
  Plus, Trash2, Send, Loader2, Sparkles,
  AlertCircle, Pencil, Check, X, CheckSquare, Square,
  ChevronLeft, ChevronRight, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { getUserPrefix } from "@/lib/userStore";
import { supabaseStorage } from "@/api/supabaseStorage";

// ── Storage ────────────────────────────────────────────────────────────────────
const getStorageKey = () => `${getUserPrefix()}accountable_financials_v2`;
const getChatKey    = () => `${getUserPrefix()}accountable_financials_chat`;

function loadFin() {
  const empty = { income_sources: [], recurring_expenses: [], wishlist_expenses: [] };
  try {
    // Try supabaseStorage first (synced to Supabase)
    const raw = supabaseStorage.getItem(getStorageKey());
    if (raw) return JSON.parse(raw) || empty;
    // Migrate from legacy localStorage if present
    const legacy = localStorage.getItem(getStorageKey());
    if (legacy) {
      supabaseStorage.setItem(getStorageKey(), legacy);
      return JSON.parse(legacy) || empty;
    }
  } catch {}
  return empty;
}
function saveFin(d) { supabaseStorage.setItem(getStorageKey(), JSON.stringify(d)); }
function loadChat() {
  try {
    const raw = supabaseStorage.getItem(getChatKey());
    if (raw) return JSON.parse(raw) || [];
    const legacy = localStorage.getItem(getChatKey());
    if (legacy) {
      supabaseStorage.setItem(getChatKey(), legacy);
      return JSON.parse(legacy) || [];
    }
  } catch {}
  return [];
}
function saveChat(m) { supabaseStorage.setItem(getChatKey(), JSON.stringify(m.slice(-60))); }
function uid() { return Math.random().toString(36).slice(2) + Date.now().toString(36); }

// ── Number / date helpers ──────────────────────────────────────────────────────
const fmt = (n) => (parseFloat(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmtWhole = (n) => (parseFloat(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
const sum = (arr) => arr.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
function ordinal(n) {
  const s = ["th","st","nd","rd"], v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

// ── Calendar day-of-month picker — portal-based so overflow-hidden can't clip it
function DayPicker({ value, onChange, label = "Set date" }) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const [display, setDisplay] = useState(() => { const d = new Date(); d.setDate(1); return d; });
  const btnRef = useRef(null);

  // Position the portal popup under the button
  const openPicker = () => {
    if (btnRef.current) {
      const r = btnRef.current.getBoundingClientRect();
      setCoords({ top: r.top + window.scrollY - 6, left: r.left + window.scrollX });
    }
    setOpen(o => !o);
  };

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (btnRef.current?.contains(e.target)) return;
      if (document.getElementById("fin-day-picker")?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const year = display.getFullYear();
  const month = display.getMonth();
  const monthName = display.toLocaleString("en-US", { month: "long", year: "numeric" });
  const firstWeekday = new Date(year, month, 1).getDay();
  const daysInMonth  = new Date(year, month + 1, 0).getDate();

  const popup = open && createPortal(
    <div
      id="fin-day-picker"
      style={{ position: "absolute", top: coords.top, left: coords.left, zIndex: 9999, transform: "translateY(-100%)" }}
      className="bg-white border border-slate-200 rounded-2xl shadow-2xl p-4 w-60"
    >
      {/* Month nav */}
      <div className="flex items-center justify-between mb-3">
        <button onClick={() => setDisplay(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-semibold text-slate-700">{monthName}</span>
        <button onClick={() => setDisplay(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-500 transition">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Weekday headers */}
      <div className="grid grid-cols-7 mb-1">
        {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
          <div key={d} className="text-center text-xs text-slate-400 font-medium py-1">{d}</div>
        ))}
      </div>

      {/* Day grid */}
      <div className="grid grid-cols-7 gap-y-0.5">
        {Array.from({ length: firstWeekday }, (_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }, (_, i) => {
          const day = i + 1;
          const sel = value === day;
          return (
            <button
              key={day}
              onClick={() => { onChange(day); setOpen(false); }}
              className={cn(
                "h-8 w-8 mx-auto rounded-full text-sm transition flex items-center justify-center",
                sel ? "bg-indigo-600 text-white font-semibold" : "text-slate-700 hover:bg-indigo-50 hover:text-indigo-600"
              )}
            >
              {day}
            </button>
          );
        })}
      </div>

      {value && (
        <button onClick={() => { onChange(null); setOpen(false); }} className="w-full mt-3 text-xs text-slate-400 hover:text-red-400 transition text-center">
          Clear date
        </button>
      )}
    </div>,
    document.body
  );

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        onClick={openPicker}
        className={cn(
          "flex items-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm bg-white transition whitespace-nowrap",
          value ? "border-indigo-300 text-indigo-700 font-medium" : "border-slate-200 text-slate-400 hover:border-indigo-300"
        )}
      >
        <Calendar className="w-3.5 h-3.5 flex-shrink-0" />
        {value ? ordinal(value) : label}
      </button>
      {popup}
    </>
  );
}

// ── Build financial system prompt for AI ──────────────────────────────────────
function buildFinancialSystemPrompt(fin) {
  const income = sum(fin.income_sources);
  const recurring = sum(fin.recurring_expenses);
  const wishlist = sum(fin.wishlist_expenses);
  const totalExpenses = recurring + wishlist;
  const savings = income - totalExpenses;
  const rate = income > 0 ? ((savings / income) * 100).toFixed(1) : 0;
  const fmtItem = (i) => `${i.name}: $${fmt(i.amount)}${i.day ? ` (due ${ordinal(i.day)})` : ""}`;

  return `You are a sharp, no-nonsense financial advisor powered by Warren Buffett and Charlie Munger principles. Be direct, specific, and use the user's real numbers. You have tools to directly modify the user's financial data — use them immediately when asked.

## User's Current Financial Snapshot
Monthly Income: $${fmt(income)} (${fin.income_sources.map(fmtItem).join(", ") || "none"})
Recurring Expenses: $${fmt(recurring)}/mo — ${fin.recurring_expenses.map(fmtItem).join(", ") || "none"}
Wishlist/Optional: $${fmt(wishlist)}/mo — ${fin.wishlist_expenses.map(fmtItem).join(", ") || "none"}
Monthly Savings: $${fmt(savings)} (${rate}% savings rate) | Annual Savings: $${fmt(savings * 12)}

Current date: ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}`;
}

// ── Financial AI tools ─────────────────────────────────────────────────────────
const FINANCIAL_TOOLS = [
  {
    name: "add_income_source",
    description: "Add a new income source to the user's financials.",
    input_schema: {
      type: "object",
      properties: {
        name:   { type: "string", description: "Name of the income source (e.g. 'Salary', 'Freelance')" },
        amount: { type: "number", description: "Monthly amount in dollars" },
        day:    { type: "number", description: "Day of month when received (1-31), optional" },
      },
      required: ["name", "amount"],
    },
  },
  {
    name: "add_expense",
    description: "Add a new expense. Use category 'recurring' for essential monthly costs, 'wishlist' for optional/nice-to-have.",
    input_schema: {
      type: "object",
      properties: {
        name:     { type: "string", description: "Name of the expense (e.g. 'Dinner', 'Netflix')" },
        amount:   { type: "number", description: "Monthly amount in dollars" },
        category: { type: "string", enum: ["recurring", "wishlist"], description: "recurring = essential, wishlist = optional" },
        day:      { type: "number", description: "Day of month when due (1-31), optional" },
      },
      required: ["name", "amount", "category"],
    },
  },
  {
    name: "delete_income_source",
    description: "Delete an income source by name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the income source to delete (partial match)" },
      },
      required: ["name"],
    },
  },
  {
    name: "delete_expense",
    description: "Delete an expense by name.",
    input_schema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Name of the expense to delete (partial match)" },
      },
      required: ["name"],
    },
  },
  {
    name: "update_expense",
    description: "Update an existing expense or income source — change its name, amount, or due day.",
    input_schema: {
      type: "object",
      properties: {
        name:       { type: "string", description: "Current name of the item to update (partial match)" },
        new_name:   { type: "string", description: "New name, if changing" },
        new_amount: { type: "number", description: "New monthly amount in dollars, if changing" },
        new_day:    { type: "number", description: "New day of month (1-31), if changing" },
      },
      required: ["name"],
    },
  },
  {
    name: "list_financials",
    description: "List all current income sources and expenses.",
    input_schema: { type: "object", properties: {} },
  },
];

function executeFinancialTool(name, input, update) {
  const fin = loadFin();
  switch (name) {
    case "add_income_source": {
      const item = { id: uid(), name: input.name, amount: parseFloat(input.amount), day: input.day || null };
      update({ income_sources: [...fin.income_sources, item] });
      return { success: true, added: { name: item.name, amount: item.amount } };
    }
    case "add_expense": {
      const item = { id: uid(), name: input.name, amount: parseFloat(input.amount), day: input.day || null };
      const key = input.category === "wishlist" ? "wishlist_expenses" : "recurring_expenses";
      update({ [key]: [...fin[key], item] });
      return { success: true, added: { name: item.name, amount: item.amount, category: input.category } };
    }
    case "delete_income_source": {
      const match = fin.income_sources.find(s => s.name.toLowerCase().includes(input.name.toLowerCase()));
      if (!match) return { error: `No income source found matching "${input.name}"` };
      update({ income_sources: fin.income_sources.filter(s => s.id !== match.id) });
      return { success: true, deleted: match.name };
    }
    case "delete_expense": {
      const match = [...fin.recurring_expenses, ...fin.wishlist_expenses].find(e => e.name.toLowerCase().includes(input.name.toLowerCase()));
      if (!match) return { error: `No expense found matching "${input.name}"` };
      update({
        recurring_expenses: fin.recurring_expenses.filter(e => e.id !== match.id),
        wishlist_expenses:  fin.wishlist_expenses.filter(e => e.id !== match.id),
      });
      return { success: true, deleted: match.name };
    }
    case "update_expense": {
      const needle = input.name.toLowerCase();
      const applyUpdate = item => ({
        ...item,
        ...(input.new_name   !== undefined ? { name: input.new_name } : {}),
        ...(input.new_amount !== undefined ? { amount: parseFloat(input.new_amount) } : {}),
        ...(input.new_day    !== undefined ? { day: input.new_day || null } : {}),
      });
      // Try income sources first, then recurring, then wishlist
      let matched = fin.income_sources.find(s => s.name.toLowerCase().includes(needle));
      if (matched) {
        update({ income_sources: fin.income_sources.map(s => s.id === matched.id ? applyUpdate(s) : s) });
        return { success: true, updated: matched.name };
      }
      matched = fin.recurring_expenses.find(e => e.name.toLowerCase().includes(needle));
      if (matched) {
        update({ recurring_expenses: fin.recurring_expenses.map(e => e.id === matched.id ? applyUpdate(e) : e) });
        return { success: true, updated: matched.name };
      }
      matched = fin.wishlist_expenses.find(e => e.name.toLowerCase().includes(needle));
      if (matched) {
        update({ wishlist_expenses: fin.wishlist_expenses.map(e => e.id === matched.id ? applyUpdate(e) : e) });
        return { success: true, updated: matched.name };
      }
      return { error: `No income or expense found matching "${input.name}"` };
    }
    case "list_financials":
      return { income_sources: fin.income_sources, recurring_expenses: fin.recurring_expenses, wishlist_expenses: fin.wishlist_expenses };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

async function financialAgenticLoop(history, fin, update) {
  // Financial Advisor only sees financial data — not gym, projects, sleep, etc.
  const systemPrompt = buildFinancialSystemPrompt(fin);

  let messages = history.map(m => ({ role: m.role, content: m.content }));
  for (let turn = 0; turn < 8; turn++) {
    const response = await fetch('/api/claude', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 2048,
        system: systemPrompt,
        tools: FINANCIAL_TOOLS,
        messages,
      }),
    });
    if (!response.ok) throw new Error(`Claude API error ${response.status}: ${await response.text()}`);
    const data = await response.json();
    if (data.stop_reason !== 'tool_use') {
      return data.content.find(b => b.type === 'text')?.text ?? '';
    }
    messages = [...messages, { role: 'assistant', content: data.content }];
    const toolResults = [];
    for (const block of data.content) {
      if (block.type === 'tool_use') {
        const result = executeFinancialTool(block.name, block.input, update);
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: JSON.stringify(result) });
      }
    }
    messages = [...messages, { role: 'user', content: toolResults }];
  }
  return "I ran into an issue. Please try again.";
}

// ── Inline add row ─────────────────────────────────────────────────────────────
function AddRow({ placeholder, onAdd, dayLabel = "Day" }) {
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [day, setDay] = useState(null);

  const submit = () => {
    if (!name.trim() || !amount) return;
    onAdd({ id: uid(), name: name.trim(), amount: parseFloat(amount), day: day || null });
    setName(""); setAmount(""); setDay(null);
  };

  return (
    <div className="flex flex-wrap gap-2 pt-3">
      <input
        value={name}
        onChange={e => setName(e.target.value)}
        onKeyDown={e => e.key === "Enter" && submit()}
        placeholder={placeholder}
        className="flex-1 min-w-[140px] text-sm rounded-xl border border-slate-200 px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
      />
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
        <input
          type="number"
          min="0"
          step="0.01"
          value={amount}
          onChange={e => setAmount(e.target.value)}
          onKeyDown={e => e.key === "Enter" && submit()}
          placeholder="0.00"
          className="w-28 pl-6 pr-3 py-2.5 text-sm rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-indigo-200 bg-white"
        />
      </div>
      <DayPicker
        value={day || null}
        onChange={v => setDay(v)}
        label={`${dayLabel} (optional)`}
      />
      <button
        onClick={submit}
        disabled={!name.trim() || !amount}
        className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-30 transition flex items-center gap-1.5"
      >
        <Plus className="w-4 h-4" /> Add
      </button>
    </div>
  );
}

// ── Editable item row ──────────────────────────────────────────────────────────
function ItemRow({ item, onDelete, onUpdate, dayLabel = "Due" }) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(item.name);
  const [amount, setAmount] = useState(item.amount);
  const [day, setDay] = useState(item.day || "");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const confirmTimerRef = React.useRef(null);

  const handleDeleteClick = () => {
    if (confirmingDelete) {
      clearTimeout(confirmTimerRef.current);
      setConfirmingDelete(false);
      onDelete(item.id);
    } else {
      setConfirmingDelete(true);
      confirmTimerRef.current = setTimeout(() => setConfirmingDelete(false), 3000);
    }
  };

  const save = () => {
    if (!name.trim() || !amount) return;
    onUpdate({ ...item, name: name.trim(), amount: parseFloat(amount), day: day ? parseInt(day) : null });
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex flex-wrap gap-2 items-center py-3 border-b border-slate-100">
        <input value={name} onChange={e => setName(e.target.value)}
          className="flex-1 min-w-[120px] text-sm rounded-lg border border-indigo-200 px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        <div className="relative">
          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 text-sm">$</span>
          <input type="number" min="0" step="0.01" value={amount} onChange={e => setAmount(e.target.value)}
            className="w-24 pl-5 pr-2 py-1.5 text-sm rounded-lg border border-indigo-200 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
        </div>
        <DayPicker
          value={day || null}
          onChange={v => setDay(v)}
          label="No date"
        />
        <button onClick={save} className="p-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-600 transition"><Check className="w-4 h-4" /></button>
        <button onClick={() => { setEditing(false); setName(item.name); setAmount(item.amount); setDay(item.day || ""); }}
          className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition"><X className="w-4 h-4" /></button>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between py-3 border-b border-slate-100 last:border-0 group">
      <div className="flex items-center gap-2.5 min-w-0 flex-1">
        <span className="text-sm text-slate-700 truncate">{item.name}</span>
        {item.day && (
          <span className="flex-shrink-0 text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium hidden sm:inline">
            {dayLabel} {ordinal(item.day)}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2 flex-shrink-0 ml-2">
        <span className="text-sm font-semibold text-slate-800 whitespace-nowrap">${fmt(item.amount)}<span className="text-slate-400 font-normal text-xs">/mo</span></span>
        <div className="flex gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
          <button onClick={() => setEditing(true)} className="p-1 rounded hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition"><Pencil className="w-3.5 h-3.5" /></button>
          {confirmingDelete ? (
            <button onClick={handleDeleteClick} className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-red-100 text-red-500 text-xs font-medium transition">
              Sure?
            </button>
          ) : (
            <button onClick={handleDeleteClick} className="p-1 rounded hover:bg-red-50 text-slate-400 hover:text-red-400 transition"><Trash2 className="w-3.5 h-3.5" /></button>
          )}
        </div>
      </div>
    </div>
  );
}

// ── INCOME TAB ────────────────────────────────────────────────────────────────
function IncomeTab({ fin, update }) {
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-base">Income Sources</h3>
          <p className="text-xs text-slate-400 mt-0.5">Add all sources of monthly income</p>
        </div>

        <div className="px-6 pb-2">
          {fin.income_sources.length === 0 ? (
            <div className="py-10 text-center text-slate-400">
              <p className="text-sm">No income sources added yet</p>
              <p className="text-xs mt-1">Add your salary, freelance income, side hustle, etc.</p>
            </div>
          ) : (
            <div>
              {fin.income_sources.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  dayLabel="Received"
                  onDelete={id => update({ income_sources: fin.income_sources.filter(s => s.id !== id) })}
                  onUpdate={updated => update({ income_sources: fin.income_sources.map(s => s.id === updated.id ? updated : s) })}
                />
              ))}
              <div className="flex items-center justify-between py-3 font-semibold text-sm">
                <span className="text-slate-600">Total Monthly Income</span>
                <span className="text-emerald-600 text-base">${fmt(sum(fin.income_sources))}</span>
              </div>
            </div>
          )}
          <AddRow
            placeholder="e.g. Salary, Freelance, Side hustle..."
            dayLabel="Received"
            onAdd={item => update({ income_sources: [...fin.income_sources, item] })}
          />
          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}

// ── EXPENSES TAB ──────────────────────────────────────────────────────────────
function ExpensesTab({ fin, update }) {
  const recurringTotal = sum(fin.recurring_expenses);
  const wishlistTotal  = sum(fin.wishlist_expenses);

  return (
    <div className="space-y-6">
      {/* Recurring / Fixed */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <h3 className="font-semibold text-slate-800 text-base">Recurring Expenses</h3>
          <p className="text-xs text-slate-400 mt-0.5">Fixed monthly bills — rent, subscriptions, insurance, loan payments…</p>
        </div>
        <div className="px-6 pb-2">
          {fin.recurring_expenses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No recurring expenses added yet</div>
          ) : (
            <div>
              {fin.recurring_expenses.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onDelete={id => update({ recurring_expenses: fin.recurring_expenses.filter(e => e.id !== id) })}
                  onUpdate={u => update({ recurring_expenses: fin.recurring_expenses.map(e => e.id === u.id ? u : e) })}
                />
              ))}
              <div className="flex items-center justify-between py-3 font-semibold text-sm border-t border-slate-100">
                <span className="text-slate-600">Total Recurring</span>
                <span className="text-rose-500 text-base">${fmt(recurringTotal)}/mo</span>
              </div>
            </div>
          )}
          <AddRow
            placeholder="e.g. Rent, Netflix, Gym membership..."
            onAdd={item => update({ recurring_expenses: [...fin.recurring_expenses, item] })}
          />
          <div className="pb-4" />
        </div>
      </div>

      {/* Wishlist / Optional */}
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold text-slate-800 text-base">Wishlist / Optional</h3>
            <span className="text-xs px-2 py-0.5 bg-violet-100 text-violet-600 rounded-full font-medium">optional</span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">Nice-to-haves — dining out, shopping, hobbies, travel…</p>
        </div>
        <div className="px-6 pb-2">
          {fin.wishlist_expenses.length === 0 ? (
            <div className="py-8 text-center text-slate-400 text-sm">No wishlist items yet</div>
          ) : (
            <div>
              {fin.wishlist_expenses.map(item => (
                <ItemRow
                  key={item.id}
                  item={item}
                  onDelete={id => update({ wishlist_expenses: fin.wishlist_expenses.filter(e => e.id !== id) })}
                  onUpdate={u => update({ wishlist_expenses: fin.wishlist_expenses.map(e => e.id === u.id ? u : e) })}
                />
              ))}
              <div className="flex items-center justify-between py-3 font-semibold text-sm border-t border-slate-100">
                <span className="text-slate-600">Total Optional</span>
                <span className="text-violet-500 text-base">${fmt(wishlistTotal)}/mo</span>
              </div>
            </div>
          )}
          <AddRow
            placeholder="e.g. Dining out, Spotify, Weekend trips..."
            onAdd={item => update({ wishlist_expenses: [...fin.wishlist_expenses, item] })}
          />
          <div className="pb-4" />
        </div>
      </div>
    </div>
  );
}

// ── OVERVIEW TAB ──────────────────────────────────────────────────────────────
function OverviewTab({ fin }) {
  const [yearly, setYearly] = useState(false);

  // Income and optional spending show exactly what was entered (no x12).
  // Only recurring/fixed expenses are annualised for the yearly view.
  const income    = sum(fin.income_sources);
  const recurring = sum(fin.recurring_expenses) * (yearly ? 12 : 1);
  const wishlist  = sum(fin.wishlist_expenses);
  const totalExp  = recurring + wishlist;
  const savings   = income - totalExp;
  const rate      = (sum(fin.income_sources)) > 0
    ? (((sum(fin.income_sources) - sum(fin.recurring_expenses) - sum(fin.wishlist_expenses)) / sum(fin.income_sources)) * 100).toFixed(1)
    : 0;

  return (
    <div className="space-y-5">
      {/* Breakdown */}
      <div className="bg-white rounded-2xl border border-slate-200 p-6">
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-semibold text-slate-800">{yearly ? "Yearly" : "Monthly"} Breakdown</h3>
          <div className="flex items-center gap-1 bg-slate-100 rounded-xl p-1">
            <button
              onClick={() => setYearly(false)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition", !yearly ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700")}
            >Monthly</button>
            <button
              onClick={() => setYearly(true)}
              className={cn("px-3 py-1.5 rounded-lg text-xs font-medium transition", yearly ? "bg-white shadow text-slate-800" : "text-slate-500 hover:text-slate-700")}
            >Yearly</button>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-2 flex-shrink-0"><TrendingUp className="w-4 h-4 text-emerald-500" />Total Income</span>
            <span className="text-sm font-bold text-emerald-600 whitespace-nowrap ml-2">+${fmt(income)}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-2 flex-shrink-0"><TrendingDown className="w-4 h-4 text-rose-500" />Fixed Expenses</span>
            <span className="text-sm font-bold text-rose-500 whitespace-nowrap ml-2">-${fmt(recurring)}</span>
          </div>
          <div className="flex justify-between items-center py-2.5 border-b border-slate-100">
            <span className="text-sm text-slate-500 flex items-center gap-2 flex-shrink-0"><TrendingDown className="w-4 h-4 text-violet-500" />Optional Spending</span>
            <span className="text-sm font-bold text-violet-500 whitespace-nowrap ml-2">-${fmt(wishlist)}</span>
          </div>
          <div className={cn("flex justify-between items-center rounded-xl p-4 mt-2", savings >= 0 ? "bg-emerald-50 border border-emerald-200" : "bg-red-50 border border-red-200")}>
            <div>
              <p className={cn("font-bold text-sm", savings >= 0 ? "text-emerald-700" : "text-red-600")}>{savings >= 0 ? `${yearly ? "Yearly" : "Monthly"} savings` : `${yearly ? "Yearly" : "Monthly"} deficit`}</p>
              {sum(fin.income_sources) > 0 && <p className="text-xs text-slate-400 mt-0.5">{savings >= 0 ? `${rate}% savings rate` : "Spending exceeds income"}</p>}
            </div>
            <span className={cn("text-xl font-extrabold", savings >= 0 ? "text-emerald-600" : "text-red-600")}>{savings < 0 ? "-" : ""}${fmt(Math.abs(savings))}</span>
          </div>
        </div>
      </div>

      {/* Buffett banner */}
      {income > 0 && (
        <div className="flex gap-3 items-start bg-amber-50 border border-amber-200 rounded-2xl p-4">
          <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-semibold text-amber-800">Buffett's Rule</p>
            <p className="text-sm text-amber-700 mt-0.5">
              "Don't save what's left after spending — spend what's left after saving."
              {parseFloat(rate) < 20
                ? ` Your ${rate}% savings rate is below the recommended 20%. Switch to the AI Advisor tab to get a plan.`
                : ` Your ${rate}% savings rate is solid — keep compounding.`}
            </p>
          </div>
        </div>
      )}

      {/* Income sources breakdown */}
      {fin.income_sources.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200 p-6">
          <h3 className="font-semibold text-slate-800 mb-4">Income Sources</h3>
          {fin.income_sources.map(s => (
            <div key={s.id} className="flex items-center justify-between py-2 border-b border-slate-100 last:border-0 text-sm">
              <div className="flex items-center gap-2 min-w-0 flex-1 mr-3">
                <span className="text-slate-600 truncate">{s.name}</span>
                {s.day && <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-600 font-medium flex-shrink-0 hidden sm:inline">Received {ordinal(s.day)}</span>}
              </div>
              <span className="font-semibold text-slate-800 whitespace-nowrap flex-shrink-0">${fmt(s.amount)}/mo</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── AI ADVISOR TAB ────────────────────────────────────────────────────────────
function AdvisorTab({ fin, update }) {
  const [messages, setMessages] = useState(loadChat);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [isSelectionMode, setIsSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const bottomRef = useRef(null);
  const textareaRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const send = async (text) => {
    if (!text.trim() || loading) return;
    setInput("");
    if (textareaRef.current) { textareaRef.current.style.height = "44px"; }

    const userMsg = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    setMessages(updated);
    saveChat(updated);
    setLoading(true);

    try {
      const reply = await financialAgenticLoop(updated, fin, update);
      const withReply = [...updated, { role: "assistant", content: reply }];
      setMessages(withReply);
      saveChat(withReply);
    } catch (err) {
      const errMsg = { role: "assistant", content: `Something went wrong: ${err.message}` };
      const withErr = [...updated, errMsg];
      setMessages(withErr);
      saveChat(withErr);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleSelect = (idx) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  const handleDeleteSelected = () => {
    const next = messages.filter((_, i) => !selectedIds.has(i));
    setMessages(next);
    saveChat(next);
    setSelectedIds(new Set());
    setIsSelectionMode(false);
  };

  const quickPrompts = [
    "Analyze my savings rate — am I on track?",
    "Which expenses should I cut first?",
    "How do I build a 6-month emergency fund?",
    "Give me a wealth-building plan based on my income",
  ];

  return (
    <div className="flex flex-col bg-white rounded-2xl border border-slate-200 overflow-hidden" style={{ height: "calc(100vh - 340px)", minHeight: 480 }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="w-9 h-9 rounded-xl bg-amber-100 flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <p className="font-semibold text-slate-800">Financial Advisor</p>
          <p className="text-xs text-slate-400">Powered by Buffett & Munger principles · Has full access to your financial data</p>
        </div>
      </div>

      {/* Selection toolbar */}
      {isSelectionMode && (
        <div className="px-6 py-3 bg-indigo-50 border-b border-indigo-200 flex items-center justify-between flex-shrink-0">
          <button
            onClick={() => {
              if (selectedIds.size === messages.length) setSelectedIds(new Set());
              else setSelectedIds(new Set(messages.map((_, i) => i)));
            }}
            className="flex items-center gap-2 text-sm text-indigo-700 hover:text-indigo-800 font-medium"
          >
            {selectedIds.size === messages.length
              ? <CheckSquare className="w-4 h-4" />
              : <Square className="w-4 h-4" />}
            {selectedIds.size === messages.length ? "Deselect All" : "Select All"}
          </button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-indigo-600">{selectedIds.size} selected</span>
            <button
              onClick={handleDeleteSelected}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-600 transition"
            >
              <Trash2 className="w-4 h-4" /> Delete
            </button>
            <button
              onClick={() => { setIsSelectionMode(false); setSelectedIds(new Set()); }}
              className="px-3 py-1.5 rounded-lg bg-white text-slate-700 text-sm font-medium border border-slate-200 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
        {messages.length === 0 && (
          <div className="space-y-4">
            <div className="text-center py-6">
              <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-7 h-7 text-amber-500" />
              </div>
              <p className="font-semibold text-slate-700">Your Financial Advisor</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm mx-auto">
                Add your income and expenses first, then ask anything. I have full access to your financial data.
              </p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {quickPrompts.map(q => (
                <button
                  key={q}
                  onClick={() => send(q)}
                  className="text-left text-sm px-4 py-3 rounded-xl border border-slate-200 hover:border-amber-300 hover:bg-amber-50 text-slate-600 hover:text-amber-800 transition"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={cn("flex gap-3 group", msg.role === "user" ? "justify-end" : "justify-start")}
            onContextMenu={e => { e.preventDefault(); setIsSelectionMode(true); handleToggleSelect(i); }}
          >
            {isSelectionMode && (
              <button
                onClick={() => handleToggleSelect(i)}
                className="flex-shrink-0 self-center text-slate-400 hover:text-indigo-600 transition"
              >
                {selectedIds.has(i)
                  ? <CheckSquare className="w-4 h-4 text-indigo-600" />
                  : <Square className="w-4 h-4" />}
              </button>
            )}
            {msg.role === "assistant" && (
              <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-4 h-4 text-amber-600" />
              </div>
            )}
            <div className={cn(
              "max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap",
              msg.role === "user"
                ? "bg-indigo-600 text-white rounded-tr-sm"
                : "bg-slate-100 text-slate-800 rounded-tl-sm",
              selectedIds.has(i) && "ring-2 ring-indigo-400 ring-offset-1"
            )}>
              {msg.content}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3">
            <div className="w-8 h-8 rounded-xl bg-amber-100 flex items-center justify-center flex-shrink-0">
              <Sparkles className="w-4 h-4 text-amber-600" />
            </div>
            <div className="bg-slate-100 rounded-2xl rounded-tl-sm px-4 py-3">
              <div className="flex gap-1.5">
                {[0, 150, 300].map(d => (
                  <div key={d} className="w-2 h-2 bg-slate-400 rounded-full animate-bounce" style={{ animationDelay: `${d}ms` }} />
                ))}
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="flex gap-3 px-6 py-4 border-t border-slate-100 flex-shrink-0">
        <textarea
          ref={textareaRef}
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
          onInput={e => { e.target.style.height = "44px"; e.target.style.height = Math.min(e.target.scrollHeight, 120) + "px"; }}
          placeholder="Ask your financial advisor..."
          rows={1}
          disabled={loading}
          className="flex-1 resize-none rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300 focus:border-amber-300 placeholder:text-slate-400 transition"
          style={{ minHeight: "44px", maxHeight: "120px" }}
        />
        <button
          onClick={() => send(input)}
          disabled={!input.trim() || loading}
          className="px-4 rounded-xl bg-amber-500 hover:bg-amber-600 text-white disabled:opacity-30 transition flex items-center justify-center"
        >
          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
        </button>
      </div>
    </div>
  );
}

// ── TOP SUMMARY CARDS ──────────────────────────────────────────────────────────
function SummaryCards({ fin }) {
  const income    = sum(fin.income_sources);
  const recurring = sum(fin.recurring_expenses);
  const wishlist  = sum(fin.wishlist_expenses);
  const totalExp  = recurring + wishlist;
  const savings   = income - totalExp;
  const rate      = income > 0 ? ((savings / income) * 100).toFixed(0) : 0;

  const cards = [
    { label: "Monthly Income",  value: `$${fmtWhole(income)}`,    color: "text-emerald-600", icon: TrendingUp,   iconColor: "text-emerald-400" },
    { label: "Total Expenses",  value: `$${fmtWhole(totalExp)}`,  color: "text-rose-500",    icon: TrendingDown, iconColor: "text-rose-400" },
    { label: "Savings Rate",    value: `${Math.max(0, rate)}%`, color: "text-slate-700", icon: Wallet, iconColor: "text-slate-400" },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-8">
      {cards.map(c => (
        <div key={c.label} className="bg-white rounded-2xl border border-slate-200 px-3 py-3 sm:px-5 sm:py-4">
          <div className="flex items-start justify-between gap-1">
            <p className="text-xs sm:text-sm text-slate-500 leading-tight">{c.label}</p>
            <c.icon className={cn("w-4 h-4 sm:w-5 sm:h-5 flex-shrink-0", c.iconColor)} />
          </div>
          <p className={cn("text-lg sm:text-2xl font-bold mt-2 break-all", c.color)}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
const TABS = ["Overview", "Income", "Expenses", "AI Advisor"];

export default function Financials() {
  const [fin, setFin] = useState(loadFin);
  const [activeTab, setActiveTab] = useState("Income");

  // Reload from supabaseStorage once it finishes hydrating from Supabase
  useEffect(() => {
    if (isStorageReady()) { setFin(loadFin()); return; }
    const handler = () => setFin(loadFin());
    window.addEventListener('supabase-storage-ready', handler);
    return () => window.removeEventListener('supabase-storage-ready', handler);
  }, []);

  const update = (patch) => {
    setFin(prev => {
      const next = { ...prev, ...patch };
      saveFin(next);
      return next;
    });
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-800">Financials</h1>
        <p className="text-slate-400 text-sm mt-1">Manage your income, track expenses, and plan your budget</p>
      </div>

      {/* Summary cards */}
      <SummaryCards fin={fin} />

      {/* Tab bar */}
      <div className="flex gap-1 border-b border-slate-200 mb-6 overflow-x-auto scrollbar-hide overscroll-x-contain" style={{ touchAction: 'pan-x' }}>
        {TABS.map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium rounded-t-lg transition-all -mb-px border-b-2",
              activeTab === tab
                ? "text-indigo-600 border-indigo-600 bg-indigo-50/60"
                : "text-slate-500 border-transparent hover:text-slate-700 hover:bg-slate-50"
            )}
          >
            {tab}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === "Overview"    && <OverviewTab fin={fin} />}
      {activeTab === "Income"      && <IncomeTab fin={fin} update={update} />}
      {activeTab === "Expenses"    && <ExpensesTab fin={fin} update={update} />}
      {activeTab === "AI Advisor"  && <AdvisorTab fin={fin} update={update} />}
    </div>
  );
}
