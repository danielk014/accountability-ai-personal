import { useState, useRef, useEffect } from 'react';
import {
  Plus, Minus, Trash2, X, Loader2, Bot, Camera, ChevronLeft, ChevronRight,
  AlertTriangle, Shield, Droplets,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getUserPrefix } from '@/lib/userStore';
import { supabaseStorage } from '@/api/supabaseStorage';
import { analyzeFoodWithAI } from '@/api/claudeClient';
import { toast } from 'sonner';
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addMonths, subMonths } from 'date-fns';

// ── Cluster Headache Trigger Detection ──────────────────────────────────────
const CH_TRIGGERS = [
  { category: "Alcohol", weight: 3, level: "Critical",
    keywords: ["beer","wine","vodka","whiskey","cocktail","rum","gin","sake","champagne","cider","ale","lager","spirits","bourbon","tequila","margarita","mimosa","sangria","mead","stout","porter"] },
  { category: "Histamine Foods", weight: 2, level: "High",
    keywords: ["aged cheese","parmesan","cheddar","brie","blue cheese","salami","pepperoni","sauerkraut","kimchi","soy sauce","miso","tempeh","kombucha","vinegar","pickled"] },
  { category: "Nitrates/Nitrites", weight: 2, level: "High",
    keywords: ["bacon","hot dog","deli meat","ham","sausage","jerky","pepperoni","salami","corned beef","prosciutto","bratwurst","kielbasa","bologna","pastrami"] },
  { category: "High Sugar Spike", weight: 1, level: "Moderate",
    keywords: ["candy","soda","energy drink","pastry","donut","doughnut","cake","ice cream","milkshake","frappuccino","slurpee","gummy","skittles","pop tart","frosting"] },
  { category: "MSG / Fast Food", weight: 2, level: "High",
    keywords: ["instant noodles","ramen","chips","doritos","fast food","chinese takeout","cheetos","msg","cup noodle","pot noodle","mcdonalds","mcdonald","burger king","wendys","wendy","kfc","taco bell","subway","pizza hut","dominos","domino","popeyes","chick-fil-a","five guys","shake shack","panda express","chipotle","jack in the box","arby"] },
  { category: "Chocolate", weight: 1, level: "Low",
    keywords: ["chocolate","cocoa","nutella","brownie","chocolate cake","chocolate ice cream","mocha"] },
];

// ── Disease Risk Detection (keyword-based) ──────────────────────────────────
const DISEASE_RISKS = [
  { disease: "Colorectal Cancer", risk: "high", icon: "🔴",
    keywords: ["bacon","hot dog","deli meat","ham","sausage","jerky","pepperoni","salami","corned beef","prosciutto","bratwurst","kielbasa","bologna","pastrami","spam"],
    reason: "Processed meat is a WHO Group 1 carcinogen — directly linked to colorectal cancer" },
  { disease: "Colorectal Cancer", risk: "moderate", icon: "🟠",
    keywords: ["beef","steak","pork","lamb","veal","ground beef","meatball","burger patty","ribs"],
    reason: "Red meat is a WHO Group 2A probable carcinogen when consumed regularly" },
  { disease: "Cardiovascular Disease", risk: "high", icon: "🔴",
    keywords: ["trans fat","margarine","shortening","hydrogenated","fried chicken","french fries","fries","deep fried","onion rings"],
    reason: "Trans fats and deep-fried foods increase LDL cholesterol and heart disease risk" },
  { disease: "Cardiovascular Disease", risk: "moderate", icon: "🟠",
    keywords: ["bacon","sausage","hot dog","butter","cream cheese","lard","palm oil"],
    reason: "High in saturated fat — raises LDL cholesterol with regular consumption" },
  { disease: "Type 2 Diabetes", risk: "high", icon: "🔴",
    keywords: ["soda","coca cola","pepsi","fanta","sprite","mountain dew","energy drink","red bull","monster","candy","gummy","skittles","sweet tea"],
    reason: "High sugar beverages/candy cause insulin spikes and insulin resistance over time" },
  { disease: "Type 2 Diabetes", risk: "moderate", icon: "🟠",
    keywords: ["donut","doughnut","pastry","cake","ice cream","milkshake","frappuccino","cookie","brownie","pie","frosting","pop tart","cereal","pancake syrup"],
    reason: "High refined sugar and processed carbs destabilize blood sugar" },
  { disease: "Hypertension", risk: "moderate", icon: "🟠",
    keywords: ["instant noodles","ramen","chips","doritos","cheetos","fast food","pizza","frozen dinner","canned soup","soy sauce","teriyaki"],
    reason: "Very high sodium content raises blood pressure with regular consumption" },
  { disease: "Liver Disease", risk: "high", icon: "🔴",
    keywords: ["beer","wine","vodka","whiskey","cocktail","rum","gin","sake","champagne","tequila","bourbon","spirits","ale","lager","margarita"],
    reason: "Alcohol is directly toxic to liver cells — causes fatty liver, cirrhosis" },
  { disease: "Obesity", risk: "moderate", icon: "🟠",
    keywords: ["mcdonalds","mcdonald","burger king","wendys","kfc","taco bell","dominos","pizza hut","popeyes","chick-fil-a","five guys","shake shack","panda express"],
    reason: "Ultra-processed fast food is calorie-dense, nutrient-poor, and engineered to overconsume" },
  { disease: "Stomach/Esophageal Cancer", risk: "moderate", icon: "🟠",
    keywords: ["pickled","smoked salmon","smoked meat","smoked fish","charred","grilled meat","bbq","barbecue"],
    reason: "Smoked/charred/pickled foods contain carcinogenic compounds (PAHs, nitrosamines)" },
];

function analyzeDiseaseRisks(foods) {
  const risks = new Map(); // disease -> { risk, reason, foods[], icon }

  for (const food of foods) {
    const name = (food.name || "").toLowerCase();

    // AI-provided disease risks
    if (Array.isArray(food.diseaseRisks) && food.diseaseRisks.length > 0) {
      for (const dr of food.diseaseRisks) {
        const key = dr.disease;
        if (!risks.has(key)) {
          risks.set(key, { disease: key, risk: dr.risk, reason: dr.reason, foods: [food.name], icon: dr.risk === 'high' ? '🔴' : dr.risk === 'moderate' ? '🟠' : '🟡' });
        } else {
          const existing = risks.get(key);
          if (!existing.foods.includes(food.name)) existing.foods.push(food.name);
          if (dr.risk === 'high' && existing.risk !== 'high') { existing.risk = 'high'; existing.icon = '🔴'; }
        }
      }
    }

    // Keyword-based detection
    for (const dr of DISEASE_RISKS) {
      for (const kw of dr.keywords) {
        if (name.includes(kw)) {
          const key = `${dr.disease}-${dr.risk}`;
          if (!risks.has(key)) {
            risks.set(key, { disease: dr.disease, risk: dr.risk, reason: dr.reason, foods: [food.name], icon: dr.icon });
          } else {
            const existing = risks.get(key);
            if (!existing.foods.includes(food.name)) existing.foods.push(food.name);
          }
          break;
        }
      }
    }
  }

  // Merge same disease (keep highest risk)
  const merged = new Map();
  for (const entry of risks.values()) {
    if (!merged.has(entry.disease)) {
      merged.set(entry.disease, entry);
    } else {
      const existing = merged.get(entry.disease);
      for (const f of entry.foods) { if (!existing.foods.includes(f)) existing.foods.push(f); }
      if (entry.risk === 'high' && existing.risk !== 'high') { existing.risk = 'high'; existing.icon = '🔴'; existing.reason = entry.reason; }
    }
  }

  const sorted = [...merged.values()].sort((a, b) => {
    const order = { high: 0, moderate: 1, low: 2 };
    return (order[a.risk] ?? 3) - (order[b.risk] ?? 3);
  });

  return sorted;
}

const CH_PROTECTIVE = [
  { category: "Magnesium-rich", keywords: ["spinach","almonds","almond","avocado","pumpkin seeds","cashew","dark chocolate","banana","black beans","edamame","quinoa"] },
  { category: "Omega-3", keywords: ["salmon","sardines","sardine","walnuts","walnut","flaxseed","flax","mackerel","tuna","chia","herring","anchovies"] },
];

function analyzeCHTriggersForFoods(foods, dayWaterMl = 0) {
  const matched = [];
  const protective = [];
  let totalWeight = 0;
  const now = new Date();
  const currentHour = now.getHours();

  for (const food of foods) {
    const name = (food.name || "").toLowerCase();

    // Check AI-flagged triggers first
    if (food.chTrigger) {
      const existing = matched.find(m => m.foodName === food.name);
      if (!existing) {
        matched.push({ foodName: food.name, category: "AI-detected", level: "High", weight: 2, reason: food.chTriggerReason || "Flagged by AI analysis" });
        totalWeight += 2;
      }
    }

    // Keyword-based trigger detection
    for (const trigger of CH_TRIGGERS) {
      for (const kw of trigger.keywords) {
        if (name.includes(kw)) {
          const alreadyMatched = matched.find(m => m.foodName === food.name && m.category === trigger.category);
          if (!alreadyMatched) {
            matched.push({ foodName: food.name, category: trigger.category, level: trigger.level, weight: trigger.weight, reason: `Contains "${kw}" — ${trigger.category.toLowerCase()} trigger` });
            totalWeight += trigger.weight;
          }
          break;
        }
      }
    }

    // Protective factor detection
    for (const prot of CH_PROTECTIVE) {
      for (const kw of prot.keywords) {
        if (name.includes(kw)) {
          const alreadyFound = protective.find(p => p.foodName === food.name && p.category === prot.category);
          if (!alreadyFound) {
            protective.push({ foodName: food.name, category: prot.category });
          }
          break;
        }
      }
    }
  }

  // Add +1 if no food logged by 14:00 (skipped meals risk)
  const skippedMeal = foods.length === 0 && currentHour >= 14;
  if (skippedMeal) totalWeight += 1;

  // Caffeine withdrawal check: if it's afternoon and no coffee/caffeine logged
  const hasCaffeine = foods.some(f => {
    const n = (f.name || "").toLowerCase();
    return n.includes("coffee") || n.includes("espresso") || n.includes("caffeine") || n.includes("tea") || n.includes("latte") || n.includes("cappuccino");
  });
  const caffeineWithdrawalRisk = currentHour >= 14 && !hasCaffeine && foods.length > 0;

  // Dehydration check: uses waterMl from day log if available, falls back to food name check
  const hasWater = dayWaterMl > 500 || foods.some(f => {
    const n = (f.name || "").toLowerCase();
    return n.includes("water") || n.includes("electrolyte") || n.includes("hydra");
  });
  const dehydrationRisk = currentHour >= 12 && !hasWater && foods.length > 0;

  // Long meal gap check: if foods have times, check for gaps > 5 hours
  const foodTimes = foods.map(f => f.time ? parseInt(f.time.split(":")[0]) : null).filter(h => h !== null).sort((a, b) => a - b);
  let longMealGap = false;
  if (foodTimes.length >= 2) {
    for (let i = 1; i < foodTimes.length; i++) {
      if (foodTimes[i] - foodTimes[i - 1] >= 5) { longMealGap = true; break; }
    }
  }
  if (longMealGap) totalWeight += 1;

  let riskLevel, riskColor, riskBg, riskBorder;
  if (totalWeight === 0)      { riskLevel = "Low";      riskColor = "text-green-700";  riskBg = "bg-green-50";  riskBorder = "border-green-200"; }
  else if (totalWeight <= 2)  { riskLevel = "Moderate";  riskColor = "text-yellow-700"; riskBg = "bg-yellow-50"; riskBorder = "border-yellow-200"; }
  else if (totalWeight <= 4)  { riskLevel = "High";      riskColor = "text-orange-700"; riskBg = "bg-orange-50"; riskBorder = "border-orange-200"; }
  else                        { riskLevel = "Critical";  riskColor = "text-red-700";    riskBg = "bg-red-50";    riskBorder = "border-red-200"; }

  return { matched, protective, totalWeight, riskLevel, riskColor, riskBg, riskBorder, skippedMeal, caffeineWithdrawalRisk, dehydrationRisk, longMealGap };
}

// ── Storage helpers (same keys as Gym.jsx — shared data) ─────────────────────
const getNutritionKey  = () => `${getUserPrefix()}gym_nutrition_v1`;
const getBodyweightKey = () => `${getUserPrefix()}gym_bodyweight_v1`;

function _readStorage(key) {
  const raw = supabaseStorage.getItem(key);
  if (raw) return raw;
  const legacy = localStorage.getItem(key);
  if (legacy) { supabaseStorage.setItem(key, legacy); return legacy; }
  return null;
}

export function loadNutrition() {
  try { const raw = _readStorage(getNutritionKey()); return raw ? JSON.parse(raw) : { logs: [] }; }
  catch { return { logs: [] }; }
}

function saveNutrition(data) { supabaseStorage.setItem(getNutritionKey(), JSON.stringify(data)); }

function loadBodyweight() {
  try { const raw = _readStorage(getBodyweightKey()); return raw ? JSON.parse(raw) : { logs: [] }; }
  catch { return { logs: [] }; }
}

function generateId() { return Math.random().toString(36).slice(2, 9) + Date.now().toString(36); }

function readAsBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => resolve(e.target.result.split(",")[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// ── Inline date picker ───────────────────────────────────────────────────────
function DatePicker({ selectedDate, onSelect }) {
  const [open, setOpen] = useState(false);
  const [baseMonth, setBaseMonth] = useState(selectedDate ? new Date(selectedDate + "T12:00:00") : new Date());
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const monthStart = startOfMonth(baseMonth);
  const monthEnd   = endOfMonth(baseMonth);
  const days       = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const firstDay   = monthStart.getDay();
  const displayDate = selectedDate
    ? format(new Date(selectedDate + "T12:00:00"), "MMM d, yyyy")
    : "Pick date";

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen(o => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-200 text-sm font-medium text-slate-700 hover:bg-slate-50 transition">
        {displayDate}
      </button>
      {open && (
        <div className="absolute top-full mt-2 left-0 z-50 bg-white border border-slate-200 rounded-2xl shadow-xl p-3 w-64">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-slate-800">{format(baseMonth, "MMMM yyyy")}</span>
            <div className="flex gap-0.5">
              <button type="button" onClick={() => setBaseMonth(subMonths(baseMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronLeft className="w-3.5 h-3.5 text-slate-500" /></button>
              <button type="button" onClick={() => setBaseMonth(addMonths(baseMonth, 1))} className="p-1.5 hover:bg-slate-100 rounded-lg transition"><ChevronRight className="w-3.5 h-3.5 text-slate-500" /></button>
            </div>
          </div>
          <div className="grid grid-cols-7 mb-1">
            {["Su","Mo","Tu","We","Th","Fr","Sa"].map(d => (
              <div key={d} className="text-center text-xs font-medium text-slate-400 py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {Array.from({ length: firstDay }).map((_, i) => <div key={`e-${i}`} />)}
            {days.map(day => {
              const dayStr = format(day, "yyyy-MM-dd");
              const isSelected = selectedDate === dayStr;
              const isToday = isSameDay(day, new Date());
              return (
                <button type="button" key={dayStr}
                  onClick={() => { onSelect(dayStr); setOpen(false); }}
                  className={cn(
                    "text-xs rounded-lg py-1.5 text-center transition font-medium",
                    isSelected ? "bg-indigo-600 text-white" :
                    isToday    ? "bg-indigo-50 text-indigo-600 border border-indigo-200" :
                                 "hover:bg-slate-100 text-slate-700"
                  )}>
                  {format(day, "d")}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

// ── NutritionView ────────────────────────────────────────────────────────────
export default function NutritionView() {
  const todayStr = format(new Date(), "yyyy-MM-dd");
  const [nutrition, setNutrition] = useState(loadNutrition);
  const [bodyweight] = useState(loadBodyweight);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [addMode, setAddMode] = useState("ai");
  const emptyForm = { name: "", serving: "", calories: "", protein: "", carbs: "", fat: "", fiber: "" };
  const [form, setForm] = useState(emptyForm);
  const [aiText, setAiText] = useState("");
  const [aiImage, setAiImage] = useState(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [aiResult, setAiResult] = useState(null);
  const fileInputRef = useRef(null);

  // Reload when supabase storage becomes ready
  useEffect(() => {
    const reload = () => setNutrition(loadNutrition());
    window.addEventListener('supabase-storage-ready', reload);
    return () => window.removeEventListener('supabase-storage-ready', reload);
  }, []);

  const logs = nutrition.logs || [];
  const dayLog = logs.find(l => l.date === selectedDate) || { date: selectedDate, foods: [], waterMl: 0 };
  const foods = dayLog.foods || [];
  const waterMl = dayLog.waterMl || 0;
  const WATER_GOAL_ML = 2500;

  const updateWater = (delta) => {
    const updated = [...logs];
    const idx = updated.findIndex(l => l.date === selectedDate);
    const current = idx >= 0 ? (updated[idx].waterMl || 0) : 0;
    const newVal = Math.max(0, current + delta);
    const entry = idx >= 0 ? { ...updated[idx], waterMl: newVal } : { date: selectedDate, foods: [], waterMl: newVal };
    if (idx >= 0) updated[idx] = entry; else updated.push(entry);
    onUpdate({ logs: updated });
  };

  const totals = foods.reduce(
    (acc, f) => ({
      calories:     acc.calories     + (parseFloat(f.calories)     || 0),
      protein:      acc.protein      + (parseFloat(f.protein)      || 0),
      carbs:        acc.carbs        + (parseFloat(f.carbs)        || 0),
      fat:          acc.fat          + (parseFloat(f.fat)          || 0),
      fiber:        acc.fiber        + (parseFloat(f.fiber)        || 0),
      saturatedFat: acc.saturatedFat + (parseFloat(f.saturatedFat) || 0),
      sugar:        acc.sugar        + (parseFloat(f.sugar)        || 0),
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, saturatedFat: 0, sugar: 0 }
  );
  const healthyFat = Math.max(0, totals.fat - totals.saturatedFat);

  const navigateDay = (dir) => {
    const d = new Date(selectedDate + "T12:00:00");
    d.setDate(d.getDate() + dir);
    setSelectedDate(format(d, "yyyy-MM-dd"));
  };

  const onUpdate = (patch) => {
    const updated = { ...nutrition, ...patch };
    setNutrition(updated);
    saveNutrition(updated);
  };

  const saveDay = (updatedFoods) => {
    const updated = [...logs];
    const idx = updated.findIndex(l => l.date === selectedDate);
    const existing = idx >= 0 ? updated[idx] : {};
    const entry = { ...existing, date: selectedDate, foods: updatedFoods };
    if (idx >= 0) updated[idx] = entry; else updated.push(entry);
    onUpdate({ logs: updated });
  };

  const addFoodToLog = (foodData) => {
    const entry = {
      id: generateId(),
      name: foodData.name,
      serving: foodData.serving || "",
      calories:      parseFloat(foodData.calories)     || 0,
      protein:       parseFloat(foodData.protein)      || 0,
      carbs:         parseFloat(foodData.carbs)        || 0,
      fat:           parseFloat(foodData.fat)          || 0,
      saturatedFat:  parseFloat(foodData.saturatedFat) || 0,
      sugar:         parseFloat(foodData.sugar)        || 0,
      fiber:         parseFloat(foodData.fiber)        || 0,
      nutritionScore: foodData.nutritionScore ?? null,
      healthScore:    foodData.healthScore ?? null,
      chTrigger:       foodData.chTrigger ?? false,
      chTriggerReason: foodData.chTriggerReason ?? null,
      diseaseRisks:    foodData.diseaseRisks ?? [],
      additivesWarning: foodData.additivesWarning ?? "",
      time: format(new Date(), "HH:mm"),
    };
    saveDay([...foods, entry]);
    setForm(emptyForm);
    setAiResult(null);
    setAiText("");
    setAiImage(null);
    toast.success(`${entry.name} logged`);
  };

  const handleManualSubmit = (e) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    addFoodToLog(form);
  };

  const handleImageSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { toast.error("Images only"); return; }
    try {
      const data    = await readAsBase64(file);
      const preview = URL.createObjectURL(file);
      setAiImage({ data, mediaType: file.type, preview });
    } catch { toast.error("Failed to read image"); }
    e.target.value = "";
  };

  const handleAnalyze = async () => {
    if (!aiText.trim() && !aiImage) return;
    setAnalyzing(true);
    setAiResult(null);
    try {
      const result = await analyzeFoodWithAI(
        aiImage?.data   || null,
        aiImage?.mediaType || null,
        aiText.trim()   || null
      );
      setAiResult(result);
    } catch {
      toast.error("Couldn't analyze food — try describing it more specifically.");
    } finally {
      setAnalyzing(false);
    }
  };

  const isToday = selectedDate === todayStr;
  const dateLabel = isToday
    ? "Today"
    : format(new Date(selectedDate + "T12:00:00"), "EEE, MMM d");

  const macros = [
    { label: "Calories", value: Math.round(totals.calories),                unit: "kcal", color: "text-orange-600", bg: "bg-orange-50", border: "border-orange-200" },
    { label: "Protein",  value: Math.round(totals.protein  * 10) / 10,     unit: "g",    color: "text-blue-600",   bg: "bg-blue-50",   border: "border-blue-200"   },
    { label: "Carbs",    value: Math.round(totals.carbs    * 10) / 10,     unit: "g",    color: "text-amber-600",  bg: "bg-amber-50",  border: "border-amber-200"  },
    { label: "Fat",      value: Math.round(totals.fat      * 10) / 10,     unit: "g",    color: "text-emerald-600",bg: "bg-emerald-50",border: "border-emerald-200"},
    { label: "Fiber",    value: Math.round(totals.fiber    * 10) / 10,     unit: "g",    color: "text-violet-600", bg: "bg-violet-50", border: "border-violet-200" },
  ];

  return (
    <div className="space-y-5">

      {/* ── Date navigation ── */}
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => navigateDay(-1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
          <ChevronLeft className="w-4 h-4" />
        </button>
        <DatePicker selectedDate={selectedDate} onSelect={setSelectedDate} />
        <button onClick={() => navigateDay(1)} className="p-2 rounded-xl hover:bg-slate-100 text-slate-500 transition">
          <ChevronRight className="w-4 h-4" />
        </button>
        {!isToday && (
          <button onClick={() => setSelectedDate(todayStr)}
            className="px-2.5 py-1.5 text-xs rounded-full bg-indigo-600 text-white font-medium hover:bg-indigo-700 transition">
            Today
          </button>
        )}
      </div>

      {/* ── Macro summary cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {macros.map(({ label, value, unit, color, bg, border }) => (
          <div key={label} className={cn("rounded-2xl border px-4 py-3 text-center", bg, border)}>
            <p className={cn("text-xl font-bold tabular-nums", color)}>{value}</p>
            <p className="text-xs text-slate-500 mt-0.5">{unit} {label.toLowerCase()}</p>
          </div>
        ))}
      </div>

      {/* ── Water tracker ── */}
      {(() => {
        const pct = Math.min(100, Math.round((waterMl / WATER_GOAL_ML) * 100));
        const liters = (waterMl / 1000).toFixed(1);
        const goalL = (WATER_GOAL_ML / 1000).toFixed(1);
        const hit = waterMl >= WATER_GOAL_ML;
        return (
          <div className={cn("rounded-2xl border p-4", hit ? "bg-sky-50 border-sky-200" : "bg-white border-slate-200")}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Droplets className={cn("w-4 h-4", hit ? "text-sky-500" : "text-sky-400")} />
                <span className="text-sm font-semibold text-slate-700">Water</span>
                <span className={cn("text-sm font-bold tabular-nums", hit ? "text-sky-600" : "text-slate-600")}>{liters}L</span>
                <span className="text-xs text-slate-400">/ {goalL}L</span>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => updateWater(-250)}
                  className="w-7 h-7 rounded-lg border border-slate-200 bg-white flex items-center justify-center text-slate-400 hover:text-red-500 hover:border-red-200 transition">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                {[250, 500].map(ml => (
                  <button key={ml} onClick={() => updateWater(ml)}
                    className="h-7 px-2 rounded-lg border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold hover:bg-sky-100 transition">
                    +{ml}ml
                  </button>
                ))}
              </div>
            </div>
            <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all", hit ? "bg-sky-500" : "bg-sky-400")}
                style={{ width: `${pct}%` }} />
            </div>
            {!hit && waterMl === 0 && (
              <p className="text-[10px] text-slate-400 mt-1">Dehydration is a major cluster headache trigger — track your water</p>
            )}
            {hit && (
              <p className="text-[10px] text-sky-600 font-medium mt-1">Goal reached — great hydration</p>
            )}
          </div>
        );
      })()}

      {/* ── Daily Assessment ── */}
      {foods.length > 0 && (() => {
        const latestBw = [...(bodyweight?.logs || [])].filter(l => l.weight).sort((a, b) => b.date.localeCompare(a.date))[0];
        const bwKg = latestBw ? parseFloat(latestBw.weight) : null;

        const proteinTarget   = bwKg ? Math.round(bwKg * 1.8) : 150;
        const healthyFatTarget= bwKg ? Math.round(bwKg * 0.5) : 40;
        const satFatLimit     = bwKg ? Math.round(bwKg * 0.15) : 20;
        const sugarLimit      = 40;

        const scoreLinear = (val, excellent, good, moderate) =>
          val >= excellent ? 92 : val >= good ? 74 : val >= moderate ? 50 : 25;
        const scoreLower  = (val, excellent, good, moderate) =>
          val <= excellent ? 92 : val <= good ? 74 : val <= moderate ? 50 : 25;

        const label     = s => s >= 85 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Moderate" : "Poor";
        const barColor  = s => s >= 85 ? "bg-green-500" : s >= 65 ? "bg-yellow-400" : s >= 45 ? "bg-orange-400" : "bg-red-500";
        const textColor = s => s >= 85 ? "text-green-700" : s >= 65 ? "text-yellow-700" : s >= 45 ? "text-orange-700" : "text-red-700";
        const bgColor   = s => s >= 85 ? "bg-green-50 border-green-200" : s >= 65 ? "bg-yellow-50 border-yellow-200" : s >= 45 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";

        const hasAiData = foods.some(f => f.saturatedFat > 0 || f.sugar > 0);

        const metrics = [
          {
            key: "protein", label: "Protein", value: Math.round(totals.protein * 10) / 10, unit: "g",
            note: bwKg ? `Aim for ${proteinTarget}g+ (1.8g x ${bwKg}kg) for max muscle growth` : "Aim for 150g+ for max muscle growth",
            score: scoreLinear(totals.protein, proteinTarget, proteinTarget * 0.8, proteinTarget * 0.55),
          },
          {
            key: "healthyFat", label: "Healthy Fats", value: Math.round(healthyFat * 10) / 10, unit: "g",
            note: bwKg ? `Aim for ${healthyFatTarget}g+ unsaturated (0.5g x ${bwKg}kg)` : "Unsaturated fats — good for hormones & muscle",
            score: scoreLinear(healthyFat, healthyFatTarget, healthyFatTarget * 0.65, healthyFatTarget * 0.3),
          },
          {
            key: "fiber", label: "Fiber", value: Math.round(totals.fiber * 10) / 10, unit: "g",
            note: "Aim for 25-35g/day for gut health & nutrient absorption",
            score: scoreLinear(totals.fiber, 30, 20, 10),
          },
          ...(hasAiData ? [
            {
              key: "satFat", label: "Saturated Fat", value: Math.round(totals.saturatedFat * 10) / 10, unit: "g",
              note: bwKg ? `Keep under ${satFatLimit}g (0.15g x ${bwKg}kg) — lower is better` : "Keep under 20g — lower is better",
              score: scoreLower(totals.saturatedFat, satFatLimit * 0.5, satFatLimit, satFatLimit * 1.5),
              exceeded: totals.saturatedFat > satFatLimit,
            },
            {
              key: "sugar", label: "Sugar", value: Math.round(totals.sugar * 10) / 10, unit: "g",
              note: `Keep under ${sugarLimit}g/day — lower is better`,
              score: scoreLower(totals.sugar, sugarLimit * 0.6, sugarLimit, sugarLimit * 1.5),
              exceeded: totals.sugar > sugarLimit,
            },
          ] : []),
        ];

        const overallScore = Math.round(metrics.reduce((s, m) => s + m.score, 0) / metrics.length);

        return (
          <div className="bg-white rounded-2xl border border-slate-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-700">Daily Assessment</h3>
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold", bgColor(overallScore), textColor(overallScore))}>
                <span className={cn("w-2 h-2 rounded-full", barColor(overallScore))} />
                {overallScore}/100 {label(overallScore)}
              </div>
            </div>
            <div className="space-y-2.5">
              {metrics.map(m => (
                <div key={m.key}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-slate-700">{m.label}</span>
                      <span className="text-xs text-slate-400">{m.value}{m.unit}</span>
                    </div>
                    <span className={cn("text-[11px] font-bold", textColor(m.score))}>{m.score}/100 · {label(m.score)}</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={cn("h-full rounded-full transition-all", m.exceeded ? "bg-red-500" : barColor(m.score))} style={{ width: m.exceeded ? "100%" : `${m.score}%` }} />
                  </div>
                  <p className="text-[10px] text-slate-400 mt-0.5">{m.note}</p>
                </div>
              ))}
            </div>
            {!hasAiData && foods.length > 0 && (
              <p className="text-[10px] text-slate-400 mt-3 pt-3 border-t border-slate-100">Use AI Analyze to unlock saturated fat & sugar tracking</p>
            )}
          </div>
        );
      })()}

      {/* ── Cluster Headache Risk Panel ── */}
      {(() => {
        const ch = analyzeCHTriggersForFoods(foods, waterMl);
        // Always show if there are triggers, or if it's afternoon with no food
        if (ch.matched.length === 0 && !ch.skippedMeal && !ch.caffeineWithdrawalRisk && !ch.dehydrationRisk && !ch.longMealGap && ch.protective.length === 0 && foods.length === 0) return null;
        const dotColor = ch.riskLevel === "Low" ? "bg-green-500" : ch.riskLevel === "Moderate" ? "bg-yellow-400" : ch.riskLevel === "High" ? "bg-orange-500" : "bg-red-500";
        return (
          <div className={cn("rounded-2xl border p-4", ch.riskBg, ch.riskBorder)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className={cn("w-4 h-4", ch.riskColor)} />
                <h3 className="text-sm font-semibold text-slate-700">Cluster Headache Risk</h3>
              </div>
              <div className={cn("flex items-center gap-1.5 px-2.5 py-1 rounded-xl border text-xs font-bold", ch.riskBg, ch.riskBorder, ch.riskColor)}>
                <span className={cn("w-2 h-2 rounded-full", dotColor)} />
                {ch.riskLevel}
              </div>
            </div>

            {/* Triggered foods */}
            {ch.matched.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Triggers Detected</p>
                <div className="space-y-1.5">
                  {ch.matched.map((m, i) => (
                    <div key={i} className="flex items-start gap-2 text-xs">
                      <span className={cn(
                        "flex-shrink-0 px-1.5 py-0.5 rounded-md text-[10px] font-bold border",
                        m.level === "Critical" ? "bg-red-100 text-red-700 border-red-200" :
                        m.level === "High" ? "bg-orange-100 text-orange-700 border-orange-200" :
                        "bg-yellow-100 text-yellow-700 border-yellow-200"
                      )}>
                        {m.level}
                      </span>
                      <div className="min-w-0">
                        <span className="font-semibold text-slate-700">{m.foodName}</span>
                        <span className="text-slate-500 ml-1">— {m.reason}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Warnings */}
            {(ch.skippedMeal || ch.caffeineWithdrawalRisk || ch.dehydrationRisk || ch.longMealGap) && (
              <div className="mb-3 space-y-1">
                {ch.skippedMeal && (
                  <p className="text-xs text-orange-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    No food logged past 2 PM — skipped meals / fasting destabilizes blood sugar and triggers attacks
                  </p>
                )}
                {ch.longMealGap && (
                  <p className="text-xs text-orange-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-orange-400 flex-shrink-0" />
                    5+ hour gap between meals detected — irregular eating is a known CH trigger
                  </p>
                )}
                {ch.caffeineWithdrawalRisk && (
                  <p className="text-xs text-yellow-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    No caffeine logged today — sudden withdrawal can trigger attacks. Keep intake consistent.
                  </p>
                )}
                {ch.dehydrationRisk && (
                  <p className="text-xs text-yellow-700 flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 flex-shrink-0" />
                    No water logged today — dehydration is a major CH trigger. Track your water intake.
                  </p>
                )}
              </div>
            )}

            {/* Protective factors */}
            {ch.protective.length > 0 && (
              <div className="mb-3">
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Protective Factors</p>
                <div className="flex flex-wrap gap-1.5">
                  {ch.protective.map((p, i) => (
                    <span key={i} className="flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-lg bg-green-100 text-green-700 border border-green-200">
                      <Shield className="w-3 h-3" />
                      {p.foodName} ({p.category})
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Reminders */}
            <div className="pt-2 border-t border-slate-200/60">
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500">
                <Droplets className="w-3 h-3" />
                Stay hydrated — dehydration is a CH trigger. Aim for consistent meal timing.
              </div>
            </div>
          </div>
        );
      })()}

      {/* ── Disease Risk Indicator ── */}
      {(() => {
        const diseaseRisks = analyzeDiseaseRisks(foods);
        if (diseaseRisks.length === 0) return null;
        const highCount = diseaseRisks.filter(d => d.risk === 'high').length;
        const modCount = diseaseRisks.filter(d => d.risk === 'moderate').length;
        const overallBg = highCount > 0 ? "bg-red-50" : modCount > 0 ? "bg-amber-50" : "bg-yellow-50";
        const overallBorder = highCount > 0 ? "border-red-200" : modCount > 0 ? "border-amber-200" : "border-yellow-200";
        const overallText = highCount > 0 ? "text-red-700" : modCount > 0 ? "text-amber-700" : "text-yellow-700";
        return (
          <div className={cn("rounded-2xl border p-4", overallBg, overallBorder)}>
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <span className="text-base">🏥</span>
                <h3 className="text-sm font-semibold text-slate-700">Disease Risk Indicator</h3>
              </div>
              <span className={cn("text-xs font-bold px-2 py-0.5 rounded-lg border", overallBg, overallBorder, overallText)}>
                {highCount > 0 ? `${highCount} high risk` : `${modCount} moderate`}
              </span>
            </div>

            <div className="space-y-2.5">
              {diseaseRisks.map((dr, i) => (
                <div key={i} className="bg-white/70 rounded-xl border border-slate-100 px-3 py-2.5">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm">{dr.icon}</span>
                    <span className="text-xs font-bold text-slate-800">{dr.disease}</span>
                    <span className={cn(
                      "text-[10px] font-bold px-1.5 py-0.5 rounded border",
                      dr.risk === 'high' ? "bg-red-100 text-red-700 border-red-200" :
                      dr.risk === 'moderate' ? "bg-amber-100 text-amber-700 border-amber-200" :
                      "bg-yellow-100 text-yellow-700 border-yellow-200"
                    )}>
                      {dr.risk}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 leading-snug">{dr.reason}</p>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {dr.foods.map((f, j) => (
                      <span key={j} className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-slate-400 mt-3 pt-2 border-t border-slate-200/60">
              Based on WHO IARC classifications and epidemiological research. Reducing these foods lowers long-term disease risk.
            </p>
          </div>
        );
      })()}

      {/* ── Food log ── */}
      <div>
        <h3 className="text-sm font-semibold text-slate-700 mb-2">
          {dateLabel}
          {foods.length > 0 && (
            <span className="ml-1.5 text-slate-400 font-normal">({foods.length} item{foods.length !== 1 ? "s" : ""})</span>
          )}
        </h3>
        {foods.length === 0 ? (
          <div className="text-center py-8 text-slate-400">
            <p className="text-sm">No food logged for {dateLabel.toLowerCase()}</p>
            <p className="text-xs mt-1">Add something below</p>
          </div>
        ) : (
          <div className="space-y-2">
            {foods.map(f => (
              <div key={f.id} className="flex items-center gap-3 bg-slate-50 rounded-xl px-4 py-3 border border-slate-100">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-slate-800 truncate">{f.name}</p>
                    {f.nutritionScore != null && (() => {
                      const s = f.nutritionScore;
                      const dot = s >= 85 ? "bg-green-500" : s >= 65 ? "bg-yellow-400" : s >= 45 ? "bg-orange-400" : "bg-red-500";
                      const txt = s >= 85 ? "text-green-700" : s >= 65 ? "text-yellow-700" : s >= 45 ? "text-orange-700" : "text-red-700";
                      const bg = s >= 85 ? "bg-green-50 border-green-200" : s >= 65 ? "bg-yellow-50 border-yellow-200" : s >= 45 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
                      return <span title="Muscle gain" className={cn("text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border flex-shrink-0", txt, bg)}><span className={cn("w-1.5 h-1.5 rounded-full inline-block flex-shrink-0", dot)} />{s}</span>;
                    })()}
                    {f.healthScore != null && (() => {
                      const s = f.healthScore;
                      const dot = s >= 85 ? "bg-green-500" : s >= 65 ? "bg-yellow-400" : s >= 45 ? "bg-orange-400" : "bg-red-500";
                      const txt = s >= 85 ? "text-green-700" : s >= 65 ? "text-yellow-700" : s >= 45 ? "text-orange-700" : "text-red-700";
                      const bg = s >= 85 ? "bg-green-50 border-green-200" : s >= 65 ? "bg-yellow-50 border-yellow-200" : s >= 45 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
                      return <span title="Health" className={cn("text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border flex-shrink-0", txt, bg)}>&#9829;{s}</span>;
                    })()}
                    {(() => {
                      // CH trigger badge — check AI flag or keyword match
                      const name = (f.name || "").toLowerCase();
                      const isAiTrigger = f.chTrigger;
                      const isKeywordTrigger = CH_TRIGGERS.some(t => t.keywords.some(kw => name.includes(kw)));
                      if (!isAiTrigger && !isKeywordTrigger) return null;
                      const reason = f.chTriggerReason || CH_TRIGGERS.find(t => t.keywords.some(kw => name.includes(kw)))?.category || "Trigger";
                      return (
                        <span title={`CH trigger: ${reason}`} className="text-[10px] font-bold flex items-center gap-0.5 px-1.5 py-0.5 rounded-md border flex-shrink-0 bg-red-50 border-red-200 text-red-700">
                          <AlertTriangle className="w-3 h-3" />CH
                        </span>
                      );
                    })()}
                  </div>
                  <p className="text-xs text-slate-500 mt-0.5 flex flex-wrap gap-x-2">
                    {f.serving && <span>{f.serving}</span>}
                    <span className="font-medium text-orange-600">{f.calories} kcal</span>
                    {f.protein      > 0 && <span className="text-blue-600">{f.protein}g P</span>}
                    {f.carbs        > 0 && <span className="text-amber-600">{f.carbs}g C</span>}
                    {f.fat          > 0 && <span className="text-emerald-600">{f.fat}g fat</span>}
                    {f.saturatedFat > 0 && <span className="text-red-500">{f.saturatedFat}g sat</span>}
                    {f.sugar        > 0 && <span className="text-pink-600">{f.sugar}g sugar</span>}
                    {f.fiber        > 0 && <span className="text-violet-600">{f.fiber}g fiber</span>}
                  </p>
                </div>
                <button onClick={() => saveDay(foods.filter(x => x.id !== f.id))}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-500 transition flex-shrink-0">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Add food panel ── */}
      <div className="bg-slate-50 rounded-2xl border border-slate-200 p-5">
        <div className="flex gap-2 mb-4">
          {[{ key: "manual", label: "Manual" }, { key: "ai", label: "AI Analyze" }].map(m => (
            <button key={m.key}
              onClick={() => { setAddMode(m.key); setAiResult(null); }}
              className={cn(
                "px-3.5 py-1.5 rounded-xl text-sm font-medium transition",
                addMode === m.key
                  ? "bg-indigo-600 text-white shadow-sm"
                  : "bg-white border border-slate-200 text-slate-600 hover:border-indigo-300"
              )}>
              {m.label}
            </button>
          ))}
        </div>

        {/* Manual entry */}
        {addMode === "manual" && (
          <form onSubmit={handleManualSubmit} className="space-y-3">
            <div className="flex flex-wrap gap-2">
              <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="Food name *" required
                className="flex-1 min-w-[140px] text-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
              <input value={form.serving} onChange={e => setForm(f => ({ ...f, serving: e.target.value }))}
                placeholder="Serving (e.g. 100g)"
                className="w-36 text-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              {[
                { key: "calories", ph: "Cal",    unit: "kcal" },
                { key: "protein",  ph: "Protein", unit: "g"    },
                { key: "carbs",    ph: "Carbs",   unit: "g"    },
                { key: "fat",      ph: "Fat",     unit: "g"    },
                { key: "fiber",    ph: "Fiber",   unit: "g"    },
              ].map(({ key, ph, unit }) => (
                <div key={key} className="relative">
                  <input type="number" min="0" step="0.1"
                    value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
                    placeholder={ph}
                    className="w-24 text-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 pr-7 focus:outline-none focus:ring-2 focus:ring-indigo-200" />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-slate-400 pointer-events-none">{unit}</span>
                </div>
              ))}
              <button type="submit" disabled={!form.name.trim()}
                className="px-4 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-30 transition flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Add
              </button>
            </div>
          </form>
        )}

        {/* AI analyze */}
        {addMode === "ai" && (
          <div className="space-y-3">
            <input value={aiText} onChange={e => setAiText(e.target.value)}
              placeholder="Describe your food (e.g. 2 scrambled eggs with toast)"
              className="w-full text-sm rounded-xl border border-slate-200 bg-white px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleAnalyze(); } }} />
            <div className="flex gap-2">
              <input type="file" accept="image/*" ref={fileInputRef} className="hidden" onChange={handleImageSelect} />
              <button type="button" onClick={() => fileInputRef.current?.click()}
                className={cn(
                  "px-3 py-2.5 rounded-xl border text-sm transition flex-shrink-0",
                  aiImage
                    ? "border-indigo-300 bg-indigo-50 text-indigo-600"
                    : "border-slate-200 bg-white text-slate-500 hover:border-indigo-300 hover:text-indigo-500"
                )} title="Upload food photo">
                <Camera className="w-4 h-4" />
              </button>
              <button onClick={handleAnalyze} disabled={analyzing || (!aiText.trim() && !aiImage)}
                className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium disabled:opacity-30 transition flex items-center justify-center gap-1.5">
                {analyzing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Bot className="w-4 h-4" />}
                {analyzing ? "Analyzing..." : "Analyze"}
              </button>
            </div>

            {/* Image preview */}
            {aiImage && (
              <div className="relative inline-block">
                <img src={aiImage.preview} alt="Food" className="w-20 h-20 rounded-xl object-cover border border-slate-200" />
                <button onClick={() => setAiImage(null)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-white border border-slate-200 flex items-center justify-center hover:bg-red-50 hover:border-red-200 transition shadow-sm">
                  <X className="w-3 h-3 text-slate-500" />
                </button>
              </div>
            )}

            {/* AI result card */}
            {aiResult && (() => {
              const scoreBadge = (val, label) => {
                const s = val ?? 0;
                const color = s >= 85 ? "bg-green-500" : s >= 65 ? "bg-yellow-400" : s >= 45 ? "bg-orange-400" : "bg-red-500";
                const txt   = s >= 85 ? "text-green-700" : s >= 65 ? "text-yellow-700" : s >= 45 ? "text-orange-700" : "text-red-700";
                const bg    = s >= 85 ? "bg-green-50 border-green-200" : s >= 65 ? "bg-yellow-50 border-yellow-200" : s >= 45 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
                const word  = s >= 85 ? "Excellent" : s >= 65 ? "Good" : s >= 45 ? "Moderate" : "Poor";
                return (
                  <div className={cn("flex flex-col items-center px-3 py-1.5 rounded-xl border text-center flex-1", bg)}>
                    <div className="flex items-center gap-1">
                      <div className={cn("w-2 h-2 rounded-full", color)} />
                      <span className={cn("text-xs font-bold", txt)}>{s}/100</span>
                    </div>
                    <span className={cn("text-[10px] font-medium leading-tight", txt)}>{word}</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">{label}</span>
                  </div>
                );
              };
              const noteScore = aiResult.healthScore ?? aiResult.nutritionScore ?? 0;
              const noteTxt = noteScore >= 85 ? "text-green-700" : noteScore >= 65 ? "text-yellow-700" : noteScore >= 45 ? "text-orange-700" : "text-red-700";
              const noteBg  = noteScore >= 85 ? "bg-green-50 border-green-200" : noteScore >= 65 ? "bg-yellow-50 border-yellow-200" : noteScore >= 45 ? "bg-orange-50 border-orange-200" : "bg-red-50 border-red-200";
              const micronutrients = [
                { label: "Sodium",    val: aiResult.sodiumMg,    unit: "mg" },
                { label: "Potassium", val: aiResult.potassiumMg, unit: "mg" },
                { label: "Calcium",   val: aiResult.calciumMg,   unit: "mg" },
                { label: "Iron",      val: aiResult.ironMg,      unit: "mg" },
                { label: "Magnesium", val: aiResult.magnesiumMg, unit: "mg" },
                { label: "Zinc",      val: aiResult.zincMg,      unit: "mg" },
                { label: "Vit A",     val: aiResult.vitaminAPct, unit: "%" },
                { label: "Vit C",     val: aiResult.vitaminCPct, unit: "%" },
                { label: "Vit D",     val: aiResult.vitaminDPct, unit: "%" },
                { label: "Vit B12",   val: aiResult.vitaminB12Pct, unit: "%" },
              ].filter(m => m.val > 0);
              return (
                <div className="bg-white rounded-2xl border border-indigo-200 p-4 shadow-sm">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0 mr-2">
                      <p className="font-semibold text-slate-800">{aiResult.name}</p>
                      {aiResult.serving && <p className="text-xs text-slate-500 mt-0.5">{aiResult.serving}</p>}
                    </div>
                    <button onClick={() => setAiResult(null)}
                      className="p-1 rounded-lg hover:bg-slate-100 text-slate-400 transition flex-shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  {/* Score badges */}
                  <div className="flex gap-2 mb-3">
                    {scoreBadge(aiResult.nutritionScore, "Muscle Gain")}
                    {scoreBadge(aiResult.healthScore, "Health")}
                  </div>

                  {/* Calories */}
                  <div className="text-center mb-3">
                    <span className="text-3xl font-bold text-orange-600">{aiResult.calories}</span>
                    <span className="text-sm text-orange-500 ml-1">kcal</span>
                  </div>

                  {/* Macros grid */}
                  <div className="grid grid-cols-3 gap-2 mb-3">
                    <div className="bg-blue-50 rounded-xl p-2 text-center">
                      <p className="text-lg font-bold text-blue-700">{aiResult.protein}g</p>
                      <p className="text-[10px] text-blue-500 font-medium">Protein</p>
                    </div>
                    <div className="bg-amber-50 rounded-xl p-2 text-center">
                      <p className="text-lg font-bold text-amber-700">{aiResult.carbs}g</p>
                      <p className="text-[10px] text-amber-500 font-medium">Carbs</p>
                    </div>
                    <div className="bg-emerald-50 rounded-xl p-2 text-center">
                      <p className="text-lg font-bold text-emerald-700">{aiResult.fat}g</p>
                      <p className="text-[10px] text-emerald-500 font-medium">Fat</p>
                    </div>
                  </div>

                  {/* Details */}
                  {(aiResult.saturatedFat > 0 || aiResult.transFat > 0 || aiResult.sugar > 0 || aiResult.fiber > 0) && (
                    <div className="flex flex-wrap gap-2 mb-3">
                      {aiResult.saturatedFat > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-100 text-red-700">{aiResult.saturatedFat}g sat. fat</span>}
                      {aiResult.transFat > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-red-200 text-red-800">{aiResult.transFat}g trans fat</span>}
                      {aiResult.sugar > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-pink-100 text-pink-700">{aiResult.sugar}g sugar</span>}
                      {aiResult.fiber > 0 && <span className="text-xs px-2.5 py-1 rounded-full font-medium bg-violet-100 text-violet-700">{aiResult.fiber}g fiber</span>}
                    </div>
                  )}

                  {/* Additives / cancer risk warning */}
                  {aiResult.additivesWarning && (
                    <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2 mb-3 border bg-amber-50 border-amber-200 text-amber-800">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <span className="font-bold">Additives / Health Concern</span>
                        <p className="mt-0.5">{aiResult.additivesWarning}</p>
                      </div>
                    </div>
                  )}

                  {/* Micronutrients */}
                  {micronutrients.length > 0 && (
                    <div className="mb-3">
                      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Micronutrients</p>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                        {micronutrients.map(m => (
                          <div key={m.label} className="flex justify-between text-xs">
                            <span className="text-slate-500">{m.label}</span>
                            <span className="font-medium text-slate-700">{m.val}{m.unit}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Health note */}
                  {aiResult.healthNote && (
                    <p className={cn("text-xs rounded-xl px-3 py-2 mb-3 border", noteBg, noteTxt)}>
                      {aiResult.healthNote}
                    </p>
                  )}

                  {/* CH trigger warning */}
                  {aiResult.chTrigger && (
                    <div className="flex items-start gap-2 text-xs rounded-xl px-3 py-2 mb-3 border bg-red-50 border-red-200 text-red-700">
                      <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <div>
                        <span className="font-bold">Cluster Headache Trigger</span>
                        {aiResult.chTriggerReason && <span className="ml-1">— {aiResult.chTriggerReason}</span>}
                      </div>
                    </div>
                  )}

                  {/* Disease risks */}
                  {Array.isArray(aiResult.diseaseRisks) && aiResult.diseaseRisks.length > 0 && (
                    <div className="text-xs rounded-xl px-3 py-2 mb-3 border bg-red-50 border-red-200">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <span className="text-sm">🏥</span>
                        <span className="font-bold text-red-700">Disease Risks</span>
                      </div>
                      <div className="space-y-1">
                        {aiResult.diseaseRisks.map((dr, i) => (
                          <div key={i} className="flex items-start gap-1.5">
                            <span>{dr.risk === 'high' ? '🔴' : dr.risk === 'moderate' ? '🟠' : '🟡'}</span>
                            <span className="text-slate-700"><span className="font-semibold">{dr.disease}</span> — {dr.reason}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <button onClick={() => addFoodToLog(aiResult)}
                    className="w-full py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition">
                    Add to log
                  </button>
                </div>
              );
            })()}
          </div>
        )}
      </div>
    </div>
  );
}
