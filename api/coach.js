const SYSTEM_PROMPT = `You are JARVIS — my personal AI command center for life optimization. You live inside my hour-by-hour tracker and have access to EVERYTHING: my schedule, goals, habits, nutrition, gym, finances, and life lessons.

You are NOT a generic chatbot. You are an intelligent system that LEARNS from my data, DETECTS patterns, and PROACTIVELY structures my life.

═══════════════════════════════════════
CORE DATA YOU RECEIVE EVERY MESSAGE:
═══════════════════════════════════════
1. LONG-TERM GOALS — my 1, 3, 5, 10 year vision
2. SHORT-TERM GOALS — what matters right now
3. HOUR LOGS — what I planned vs. actually did, with energy ratings (1-5), across ALL recorded days
4. DAILY TASKS — to-do items per day (done/pending)
5. SCHEDULE BLOCKS — time blocks per day (work, sleep, personal, other)
6. NUTRITION — food intake, calories, macros per day
7. FINANCIALS — income, expenses, savings rate, budget
8. GYM DATA — workouts, exercises, sets/reps/weight, bodyweight
9. LIFE LESSONS — my personal wisdom database (my operating system)
10. CONVERSATION HISTORY — what we've discussed before in this session

═══════════════════════════════════════
YOUR PRIMARY FUNCTIONS:
═══════════════════════════════════════

**1. PATTERN INTELLIGENCE (Learn from my history)**
Before answering ANY question, you MUST silently analyze my data for:
- SLEEP PATTERNS: When do I actually sleep vs. when I plan to? Am I consistent? How does sleep affect next-day energy?
- ENERGY CYCLES: When are my peak energy hours? When do I crash? What activities correlate with high/low energy?
- TASK COMPLETION RATE: What % of tasks do I actually complete? Which types do I skip? Which days am I most productive?
- PLAN vs. REALITY GAP: How often does my actual schedule match my planned schedule? Where do I consistently deviate?
- NUTRITION IMPACT: How does what I eat affect my energy the next day? Am I hitting my macros consistently?
- GYM CONSISTENCY: Am I going regularly? Are my lifts progressing? Is my bodyweight trending the right direction?
- FINANCIAL TRAJECTORY: Am I saving more over time? Are expenses creeping up?
- RECURRING FAILURES: What tasks/habits do I keep failing at? What's the root cause pattern?
- RECURRING WINS: What am I consistently good at? What conditions enable success?

When you detect a pattern, STATE IT EXPLICITLY: "I notice that over the last X days, you [pattern]. This means [implication]."

**2. PROACTIVE DAY STRUCTURING**
When I ask you to plan my day/week, you MUST:
- Study my BEST previous days (highest energy, most tasks completed, good nutrition) and use them as templates
- Study my WORST days and actively avoid those patterns
- Place high-priority work during MY peak energy hours (learn these from my data)
- Schedule meals at times I actually eat (learn from nutrition logs)
- Include gym at times I've historically gone (learn from gym data)
- Add buffer/transition time between blocks (I'm human, not a machine)
- Front-load the hardest tasks when energy is highest
- Include specific tasks for each block, not vague labels
- Plan recovery/wind-down based on what actually works for me
- If I have incomplete tasks from previous days, carry them forward intelligently

**3. TRAJECTORY PROJECTION**
For any area of life, project where I'm headed:
- "At your current rate of [X hours/week on Y], in 6 months you'll be at [Z]. Your goal requires [A]. The gap is [B]."
- Use ACTUAL data, not assumptions. Count the hours. Do the math.
- Compare week-over-week and month-over-month trends
- Flag if trajectory is improving, declining, or stagnant

**4. CROSS-DOMAIN INTELLIGENCE**
Connect the dots across ALL data domains:
- "Your gym performance dropped this week. Looking at your nutrition, you only hit 1800 calories on Tuesday and Wednesday. You need fuel to perform."
- "Your energy crashed at 14:00 three days in a row. Each time you had a high-carb lunch. Consider protein-heavy lunches instead."
- "You're spending 2 hours/day on [low-value activity]. That's 14 hours/week. Your financial goal requires building [X]. Redirect those hours."
- "Your best work days this month all had one thing in common: you slept before 23:00 and trained in the morning."

**5. ACCOUNTABILITY ENGINE**
- Track promises I make to you. If I said "I'll do X tomorrow" and didn't, call it out.
- Keep a running mental model of my commitments and follow up on them.
- Grade my weeks: A (exceeded goals), B (met most), C (mediocre), D (slipping), F (falling apart).
- When grading, cite specific evidence from the data.

═══════════════════════════════════════
YOUR PHILOSOPHICAL LENSES:
═══════════════════════════════════════
Use whichever fits the moment. Blend them when needed.

**MARCUS AURELIUS (Default Tone)** — Discipline & Self-Command:
- Control what you can, ignore what you can't. Do the duty in front of you.
- Embrace hardship — pain leads to growth. Do not seek the path of least resistance.
- Firm, never contemptuous. Disciplined, never cruel.

**SUN TZU** — Strategy & Positioning:
- Win before fighting by setting things up right. Position yourself so victory is inevitable.
- Pick battles. Don't spend force on the wrong fights.

**ALEX HORMOZI** — Brutal Prioritization & Leverage:
- "Is this the highest-value action available right now?" If not, cut it.
- Focus creates wealth. Scattered attention creates poverty.

**DAVE RAMSEY** — Financial Discipline:
- "Live like no one else now, so later you can live like no one else."
- Budget every dollar. If you don't tell your money where to go, it leaves.

**SOVEREIGN INDIVIDUAL**:
- Charioteer Principle: Keep the prefrontal cortex in control. Modern culture exhausts it.
- Chemical/Digital Sovereignty: Zero tolerance for chemical sabotage. Social media = dopamine slavery.
- Environmental Design > Willpower: Reshape the choice environment.

═══════════════════════════════════════
LIFE LESSONS INTEGRATION:
═══════════════════════════════════════
- My life lessons are my personal operating system. They are NON-NEGOTIABLE principles.
- ALWAYS check if a situation connects to one of my lessons. If so, lead with it.
- When I'm slipping: "You wrote this yourself: [lesson title] — [lesson]. But you're doing the opposite."
- When I'm winning: "This is your lesson in action: [lesson title]. Keep building on it."

═══════════════════════════════════════
RESPONSE STYLE:
═══════════════════════════════════════
- Talk like JARVIS — intelligent, precise, slightly dry wit. Not robotic, not overly emotional.
- Lead with the most important insight. Don't bury the lead.
- Use data and numbers when available. "You completed 7/10 tasks" not "you did most tasks."
- Keep replies CONCISE (under 250 words) for quick questions. Go deeper only for full assessments.
- When I ask "plan my day" or "what should I do", TAKE ACTION — use the tools to build my schedule. Don't just describe it.
- When you detect something important in my data that I didn't ask about, MENTION IT. Be proactive.
- If I've logged almost nothing, don't guess — call it out. "I have [X] days of data. I need more to give you real patterns."

═══════════════════════════════════════
ADVANCED BEHAVIORS:
═══════════════════════════════════════
- MORNING BRIEFING: When I say "good morning", "morning", or "start my day": Give me a status report — what's on my plate today, any carryover tasks from yesterday, my recent trajectory, and what I should prioritize. Then build my schedule if I don't have one.
- EVENING DEBRIEF: When I say "end of day", "wrap up", or "how did today go": Score my day, note what I completed vs. missed, identify wins and losses, and suggest what to carry to tomorrow.
- WEEKLY REVIEW: When I ask for a review: Full analysis across all domains — hours logged, task completion rate, nutrition averages, gym consistency, financial moves, and trajectory vs. goals.
- EMERGENCY MODE: If my data shows a clear downward spiral (multiple days of missed tasks, no gym, bad nutrition), escalate your tone. Don't be gentle. Sound the alarm.`;

function formatScheduleBlocks(scheduleBlocks) {
  if (!scheduleBlocks || typeof scheduleBlocks !== 'object' || Array.isArray(scheduleBlocks) || Object.keys(scheduleBlocks).length === 0) return '(No schedule blocks yet)';
  const sorted = Object.keys(scheduleBlocks).sort();
  let output = '';
  for (const date of sorted) {
    const blocks = scheduleBlocks[date];
    if (!Array.isArray(blocks) || blocks.length === 0) continue;
    output += `\n${date}:\n`;
    const sortedBlocks = [...blocks].sort((a, b) => a.startHour - b.startHour);
    for (const block of sortedBlocks) {
      const startH = block.startHour;
      const endH = block.endHour;
      const hours = endH - startH;
      const type = block.type === 'actual' ? 'DID' : 'PLANNED';
      output += `  ${pad(startH)}:00-${pad(endH)}:00 (${hours}h) [${type}] ${block.text} [${block.blockCategory || 'other'}]\n`;
    }
  }
  return output || '(No schedule blocks yet)';
}

function pad(n) { return n.toString().padStart(2, '0'); }

function formatDailyTasks(dailyTasks) {
  if (!dailyTasks || typeof dailyTasks !== 'object' || Array.isArray(dailyTasks) || Object.keys(dailyTasks).length === 0) return '(No daily tasks yet)';
  const sorted = Object.keys(dailyTasks).sort();
  let output = '';
  for (const date of sorted) {
    const tasks = dailyTasks[date];
    if (!Array.isArray(tasks) || tasks.length === 0) continue;
    output += `\n${date}:\n`;
    for (const task of tasks) {
      const status = task.done ? '[DONE]' : '[TODO]';
      output += `  ${status} ${task.text} [${task.blockCategory || 'other'}]\n`;
    }
  }
  return output || '(No daily tasks yet)';
}

function formatNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object' || !Array.isArray(nutrition.logs) || nutrition.logs.length === 0) return '(No nutrition data yet)';
  const sorted = [...nutrition.logs].sort((a, b) => a.date.localeCompare(b.date));
  const recent = sorted.slice(-14);
  let output = '';
  for (const day of recent) {
    if (!day.foods || day.foods.length === 0) continue;
    const totals = day.foods.reduce((acc, f) => ({
      cal: acc.cal + (f.calories || 0),
      pro: acc.pro + (f.protein || 0),
      carb: acc.carb + (f.carbs || 0),
      fat: acc.fat + (f.fat || 0),
      fiber: acc.fiber + (f.fiber || 0),
    }), { cal: 0, pro: 0, carb: 0, fat: 0, fiber: 0 });
    output += `\n${day.date}: ${Math.round(totals.cal)} kcal | ${Math.round(totals.pro)}g protein | ${Math.round(totals.carb)}g carbs | ${Math.round(totals.fat)}g fat | ${Math.round(totals.fiber)}g fiber`;
    output += `\n  Foods: ${day.foods.map(f => `${f.name} (${f.calories} kcal)`).join(', ')}`;
  }
  return output || '(No nutrition data yet)';
}

function formatLogs(logs) {
  if (!logs || Object.keys(logs).length === 0) return '(No logs yet)';
  const sorted = Object.keys(logs).sort();
  let output = '';
  for (const date of sorted) {
    output += `\n${date}:\n`;
    const dayLogs = logs[date];
    for (let h = 0; h < 24; h++) {
      const log = dayLogs[h];
      if (log && (log.planned || log.actual)) {
        const hour = `${h.toString().padStart(2, '0')}:00`;
        output += `  ${hour} | Plan: ${log.planned || '-'} | Did: ${log.actual || '-'} | Energy: ${log.energy || '-'}\n`;
      }
    }
  }
  return output || '(No logs yet)';
}

function formatFinancials(fin) {
  if (!fin || typeof fin !== 'object') return '(No financial data yet)';
  let output = '';
  const currentMonth = new Date().toISOString().slice(0, 7);
  const byMonth = (arr) => (Array.isArray(arr) ? arr : []).filter(e => e.month === currentMonth);

  const income = byMonth(fin.income_sources);
  const recurring = byMonth(fin.recurring_expenses);
  const wishlist = byMonth(fin.wishlist_expenses);
  const oneTime = byMonth(fin.one_time_expenses);
  const savings = byMonth(fin.savings_deposits);

  const sum = (arr) => arr.reduce((t, i) => t + (parseFloat(i.amount) || 0), 0);
  const totalIncome = sum(income);
  const totalExpenses = sum(recurring) + sum(wishlist) + sum(oneTime);
  const totalSaved = sum(savings);
  const allTimeSaved = sum(fin.savings_deposits || []);
  const surplus = totalIncome - totalExpenses;

  output += `Month: ${currentMonth}\n`;
  if (income.length > 0) output += `Income ($${totalIncome.toFixed(0)}): ${income.map(i => `${i.name} $${i.amount}`).join(', ')}\n`;
  if (recurring.length > 0) output += `Recurring expenses ($${sum(recurring).toFixed(0)}): ${recurring.map(i => `${i.name} $${i.amount}`).join(', ')}\n`;
  if (wishlist.length > 0) output += `Optional spending ($${sum(wishlist).toFixed(0)}): ${wishlist.map(i => `${i.name} $${i.amount}`).join(', ')}\n`;
  if (oneTime.length > 0) output += `One-time payments ($${sum(oneTime).toFixed(0)}): ${oneTime.map(i => `${i.name} $${i.amount}`).join(', ')}\n`;
  if (savings.length > 0) output += `Savings deposits this month ($${totalSaved.toFixed(0)}): ${savings.map(i => `${i.name} $${i.amount}`).join(', ')}\n`;
  output += `Monthly surplus: $${surplus.toFixed(0)} | Savings rate: ${totalIncome > 0 ? ((surplus / totalIncome) * 100).toFixed(0) : 0}%\n`;
  output += `Total saved all time: $${allTimeSaved.toFixed(0)}`;

  return output || '(No financial data yet)';
}

function formatLifeLessons(lessons) {
  if (!Array.isArray(lessons) || lessons.length === 0) return '(No life lessons recorded yet)';
  let output = '';
  for (const lesson of lessons) {
    output += `\n[${lesson.category || 'General'}] "${lesson.title}"`;
    output += `\n  Lesson: ${lesson.lesson}`;
    if (lesson.context) output += `\n  Context: ${lesson.context}`;
    if (lesson.source) output += `\n  Source: ${lesson.source}`;
    output += `\n  Reviewed ${lesson.reviewCount || 0} times`;
    output += '\n';
  }
  return output;
}

function formatGymData(gym) {
  if (!gym) return '(No gym data yet)';
  let output = '';

  if (gym.weight_unit) output += `Weight unit: ${gym.weight_unit}\n`;

  for (const day of (gym.workout_days || [])) {
    output += `\n${day.name} Day:\n`;
    if ((day.exercises || []).length === 0) {
      output += '  No exercises yet\n';
    } else {
      for (const ex of day.exercises) {
        const sets = (ex.sets || []).map((s, i) => `Set ${i + 1}: ${s.weight}${gym.weight_unit} x ${s.reps}`).join(', ');
        const lastLog = (ex.weight_log || []).slice(-1)[0];
        const lastStr = lastLog ? ` | Last: ${lastLog.weight}${gym.weight_unit} x ${lastLog.reps} on ${lastLog.date}` : '';
        output += `  - ${ex.name}: ${sets || 'no sets'}${lastStr}\n`;
      }
    }
  }

  const bw = (Array.isArray(gym.bodyweight_log) ? gym.bodyweight_log : []).slice(-14);
  if (bw.length > 0) {
    output += '\nRecent bodyweight: ' + bw.map(e => `${e.date}: ${e.weight}${gym.weight_unit}`).join(', ') + '\n';
  }

  return output || '(No gym data yet)';
}

// Compute pattern analysis summary from raw data
function computePatternAnalysis(logs, dailyTasks, scheduleBlocks, nutrition) {
  const analysis = [];

  // Task completion rate analysis
  if (dailyTasks && typeof dailyTasks === 'object' && !Array.isArray(dailyTasks)) {
    const dates = Object.keys(dailyTasks).sort();
    const recentDates = dates.slice(-14);
    let totalTasks = 0, completedTasks = 0;
    const dailyRates = [];
    for (const date of recentDates) {
      const tasks = dailyTasks[date];
      if (!Array.isArray(tasks) || tasks.length === 0) continue;
      const done = tasks.filter(t => t.done).length;
      totalTasks += tasks.length;
      completedTasks += done;
      dailyRates.push({ date, rate: Math.round((done / tasks.length) * 100), done, total: tasks.length });
    }
    if (totalTasks > 0) {
      const overallRate = Math.round((completedTasks / totalTasks) * 100);
      analysis.push(`TASK COMPLETION (last ${recentDates.length} days): ${completedTasks}/${totalTasks} tasks completed (${overallRate}%)`);
      const worst = dailyRates.filter(d => d.rate < 50).map(d => `${d.date} (${d.done}/${d.total})`);
      if (worst.length > 0) analysis.push(`  Low completion days: ${worst.join(', ')}`);
      const best = dailyRates.filter(d => d.rate === 100 && d.total >= 2).map(d => d.date);
      if (best.length > 0) analysis.push(`  Perfect days: ${best.join(', ')}`);
      // Incomplete tasks to carry forward
      const lastDate = dates[dates.length - 1];
      if (lastDate && Array.isArray(dailyTasks[lastDate])) {
        const incomplete = dailyTasks[lastDate].filter(t => !t.done);
        if (incomplete.length > 0) {
          analysis.push(`  CARRYOVER from ${lastDate}: ${incomplete.map(t => t.text).join(', ')}`);
        }
      }
    }
  }

  // Energy pattern analysis
  if (logs && typeof logs === 'object') {
    const dates = Object.keys(logs).sort().slice(-14);
    const hourlyEnergy = {};
    let totalEntries = 0;
    for (const date of dates) {
      const dayLogs = logs[date];
      for (let h = 0; h < 24; h++) {
        const log = dayLogs[h];
        if (log && log.energy && log.energy > 0) {
          if (!hourlyEnergy[h]) hourlyEnergy[h] = [];
          hourlyEnergy[h].push(log.energy);
          totalEntries++;
        }
      }
    }
    if (totalEntries > 5) {
      const avgByHour = Object.entries(hourlyEnergy)
        .map(([h, vals]) => ({ hour: parseInt(h), avg: vals.reduce((a, b) => a + b, 0) / vals.length, count: vals.length }))
        .filter(e => e.count >= 2)
        .sort((a, b) => b.avg - a.avg);
      if (avgByHour.length > 0) {
        const peak = avgByHour.slice(0, 3).map(e => `${pad(e.hour)}:00 (avg ${e.avg.toFixed(1)})`);
        const low = avgByHour.slice(-3).map(e => `${pad(e.hour)}:00 (avg ${e.avg.toFixed(1)})`);
        analysis.push(`ENERGY PEAKS: ${peak.join(', ')}`);
        analysis.push(`ENERGY LOWS: ${low.join(', ')}`);
      }
    }

    // Plan vs Reality gap
    let matchCount = 0, mismatchCount = 0;
    for (const date of dates) {
      const dayLogs = logs[date];
      for (let h = 0; h < 24; h++) {
        const log = dayLogs[h];
        if (log && log.planned && log.actual) {
          if (log.planned.toLowerCase().trim() === log.actual.toLowerCase().trim()) matchCount++;
          else mismatchCount++;
        }
      }
    }
    const total = matchCount + mismatchCount;
    if (total > 5) {
      const adherence = Math.round((matchCount / total) * 100);
      analysis.push(`PLAN ADHERENCE: ${adherence}% of planned hours matched actual (${matchCount}/${total})`);
    }

    // Sleep pattern detection
    const sleepData = [];
    for (const date of dates) {
      const dayLogs = logs[date];
      let sleepStart = -1, sleepEnd = -1;
      for (let h = 0; h < 24; h++) {
        const log = dayLogs[h];
        const activity = (log?.actual || log?.planned || '').toLowerCase();
        if (activity.includes('sleep') || activity.includes('bed')) {
          if (sleepStart === -1) sleepStart = h;
          sleepEnd = h + 1;
        }
      }
      if (sleepStart >= 0) sleepData.push({ date, start: sleepStart, end: sleepEnd, hours: sleepEnd - sleepStart });
    }
    if (sleepData.length >= 3) {
      const avgSleep = sleepData.reduce((a, b) => a + b.hours, 0) / sleepData.length;
      const avgBedtime = sleepData.filter(s => s.start >= 20).reduce((a, b) => a + b.start, 0) / sleepData.filter(s => s.start >= 20).length;
      analysis.push(`SLEEP PATTERN: Avg ${avgSleep.toFixed(1)}h/night${avgBedtime ? `, avg bedtime ~${pad(Math.round(avgBedtime))}:00` : ''}`);
    }
  }

  // Nutrition consistency
  if (nutrition && Array.isArray(nutrition.logs) && nutrition.logs.length > 0) {
    const recent = nutrition.logs.slice(-14);
    const cals = recent.filter(d => d.foods && d.foods.length > 0).map(d =>
      d.foods.reduce((acc, f) => acc + (f.calories || 0), 0)
    );
    const proteins = recent.filter(d => d.foods && d.foods.length > 0).map(d =>
      d.foods.reduce((acc, f) => acc + (f.protein || 0), 0)
    );
    if (cals.length >= 3) {
      const avgCal = Math.round(cals.reduce((a, b) => a + b, 0) / cals.length);
      const avgPro = Math.round(proteins.reduce((a, b) => a + b, 0) / proteins.length);
      const daysLogged = cals.length;
      const daysInRange = recent.length;
      analysis.push(`NUTRITION (${daysLogged}/${daysInRange} days logged): Avg ${avgCal} kcal/day, ${avgPro}g protein/day`);
    }
  }

  return analysis.length > 0 ? analysis.join('\n') : '(Not enough data for pattern analysis yet)';
}

const CATEGORY_COLORS = {
  work: '#f97316',
  sleep: '#6366f1',
  personal: '#22c55e',
  other: '#64748b',
};

const SCHEDULE_TOOLS = [
  {
    name: 'add_schedule_block',
    description: 'Add a time block to the user\'s day tracker schedule. Use this when the user asks you to add, schedule, or plan something on their schedule. For sleep that crosses midnight, create TWO blocks: one ending at hour 24 on the current day and one starting at hour 0 on the next day.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The date in YYYY-MM-DD format. Use today\'s date if not specified.' },
        text: { type: 'string', description: 'What the block is for (e.g. "Deep work - build API endpoints", "Sleep", "Gym - Push day", "Lunch break")' },
        startHour: { type: 'integer', minimum: 0, maximum: 23, description: 'Start hour (0-23)' },
        endHour: { type: 'integer', minimum: 1, maximum: 24, description: 'End hour (1-24)' },
        type: { type: 'string', enum: ['planned', 'actual'], description: 'Whether this is planned or actually happened. Default: planned' },
        category: { type: 'string', enum: ['work', 'sleep', 'personal', 'other'], description: 'Category of the block. Use "work" for work/meetings/business, "sleep" for sleep/nap/rest, "personal" for gym/errands/social, "other" for everything else.' },
      },
      required: ['date', 'text', 'startHour', 'endHour'],
    },
  },
  {
    name: 'remove_schedule_block',
    description: 'Remove a time block from the user\'s schedule by matching the text and date.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The date in YYYY-MM-DD format' },
        text: { type: 'string', description: 'The text of the block to remove (partial match is fine)' },
      },
      required: ['date', 'text'],
    },
  },
  {
    name: 'update_schedule_block',
    description: 'Update an existing time block on the user\'s schedule (change time, text, etc).',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The date in YYYY-MM-DD format' },
        matchText: { type: 'string', description: 'Text of the existing block to find (partial match)' },
        newText: { type: 'string', description: 'New text for the block (optional)' },
        newStartHour: { type: 'integer', minimum: 0, maximum: 23, description: 'New start hour (optional)' },
        newEndHour: { type: 'integer', minimum: 1, maximum: 24, description: 'New end hour (optional)' },
      },
      required: ['date', 'matchText'],
    },
  },
  {
    name: 'add_task',
    description: 'Add a task to the user\'s day tracker task list for a specific day. Tasks appear in the sidebar and can be dragged onto the schedule.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The date in YYYY-MM-DD format.' },
        text: { type: 'string', description: 'The task description.' },
        category: { type: 'string', enum: ['work', 'sleep', 'personal', 'other'], description: 'Category of the task.' },
      },
      required: ['date', 'text'],
    },
  },
];

const ACTUAL_COLOR = '#64748b';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { message, logs, dailyTasks, scheduleBlocks, nutrition, financials, gymData, coachPersonality, lifeLessons } = body;
    const longTermGoals = Array.isArray(body.longTermGoals) ? body.longTermGoals : [];
    const goals = Array.isArray(body.goals) ? body.goals : [];
    const coachContextFiles = Array.isArray(body.coachContextFiles) ? body.coachContextFiles : [];
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    const conversationHistory = Array.isArray(body.conversationHistory) ? body.conversationHistory : [];

    const today = new Date().toISOString().slice(0, 10);
    const now = new Date();
    const currentHour = now.getHours();
    const dayOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][now.getDay()];

    // Compute pattern analysis
    const patternAnalysis = computePatternAnalysis(logs, dailyTasks, scheduleBlocks, nutrition);

    const context = `
═══ CURRENT STATUS ═══
DATE: ${today} (${dayOfWeek})
TIME: ${pad(currentHour)}:00
DAYS OF DATA: ${logs ? Object.keys(logs).length : 0} days logged

═══ PATTERN ANALYSIS (auto-computed from your data) ═══
${patternAnalysis}

═══ LONG-TERM GOALS (life vision) ═══
${longTermGoals.length > 0 ? longTermGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No long-term goals set yet)'}

═══ SHORT-TERM GOALS (current focus) ═══
${goals.length > 0 ? goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No short-term goals set yet)'}

═══ DAILY TASKS (to-do items per day) ═══
${formatDailyTasks(dailyTasks)}

═══ SCHEDULE BLOCKS (time blocks per day) ═══
${formatScheduleBlocks(scheduleBlocks)}

═══ HOUR LOGS (all recorded days) ═══
${formatLogs(logs)}

═══ NUTRITION LOG (food intake per day) ═══
${formatNutrition(nutrition)}

═══ FINANCIAL DATA ═══
${formatFinancials(financials)}

═══ GYM DATA ═══
${formatGymData(gymData)}

═══ LIFE LESSONS (personal operating system) ═══
${formatLifeLessons(lifeLessons)}
`;

    // Build system prompt with optional custom personality
    let systemPrompt = SYSTEM_PROMPT;
    systemPrompt += `\n\nYou have tools to modify the user's day tracker schedule and add tasks. Use them PROACTIVELY — when the user asks to plan, or when you see they need structure, BUILD IT for them.

SCHEDULE PLANNING RULES:
- Today's date is ${today} (${dayOfWeek}). Current time: ${pad(currentHour)}:00.
- You can plan ANY day — today, tomorrow, next week, etc.
- When planning today, only schedule blocks AFTER the current hour (${pad(currentHour)}:00). Don't schedule the past.
- When the user asks to "plan my day" or "plan my week", create a COMPLETE schedule based on their ACTUAL patterns from previous days.
- For sleep that crosses midnight (e.g. 22:00 to 07:00), create TWO separate blocks: one from 22:00-24:00 on the current day, and one from 0:00-7:00 on the NEXT day.
- Always include meals, breaks, and transitions. Humans need rest.
- Always set the correct category: "work" for work/meetings/coding/business, "sleep" for sleep/rest/nap, "personal" for gym/errands/social/meals/breaks, "other" for anything else.
- Make block descriptions SPECIFIC, not vague. "Deep work - build dashboard feature" not just "Work".
- If the user has incomplete tasks from previous days, include them in today's plan.
- Use their energy pattern data to place demanding tasks during peak hours.
- When planning multiple days, plan each day individually.
- Be realistic — don't overschedule. Include buffer time.`;
    if (coachPersonality) {
      systemPrompt += `\n\n--- USER'S CUSTOM INSTRUCTIONS ---\n${coachPersonality}`;
    }

    // Build conversation messages with history
    let messages = [];

    // Add previous conversation messages (for memory within the session)
    if (conversationHistory.length > 0) {
      for (const msg of conversationHistory) {
        if (msg.role === 'user') {
          messages.push({ role: 'user', content: [{ type: 'text', text: msg.text }] });
        } else if (msg.role === 'assistant') {
          messages.push({ role: 'assistant', content: [{ type: 'text', text: msg.text }] });
        }
      }
    }

    // Build current user message content with context files and attachments
    const userContent = [];

    // Add persistent context files
    if (coachContextFiles.length > 0) {
      for (const f of coachContextFiles) {
        if (f.mediaType === 'application/pdf') {
          userContent.push({ type: 'document', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
        } else if (f.mediaType?.startsWith('image/')) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: f.mediaType, data: f.data } });
        }
      }
    }

    // Add per-message attachments
    if (attachments.length > 0) {
      for (const att of attachments) {
        if (att.mediaType === 'application/pdf') {
          userContent.push({ type: 'document', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
        } else if (att.mediaType?.startsWith('image/')) {
          userContent.push({ type: 'image', source: { type: 'base64', media_type: att.mediaType, data: att.data } });
        }
      }
    }

    userContent.push({ type: 'text', text: context + '\n\nMy message: ' + message });

    const hasPdf = userContent.some(b => b.type === 'document');

    messages.push({ role: 'user', content: userContent });

    const scheduleChanges = [];
    let replyText = '';
    let maxIterations = 15;

    while (maxIterations-- > 0) {
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
          ...(hasPdf && { 'anthropic-beta': 'pdfs-2024-09-25' }),
        },
        body: JSON.stringify({
          model: 'claude-opus-4-6',
          max_tokens: 8192,
          system: systemPrompt,
          messages,
          tools: SCHEDULE_TOOLS,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        return res.status(response.status).json({ error: data.error?.message || 'API error' });
      }

      // Process response content
      const toolUseBlocks = data.content.filter(b => b.type === 'tool_use');
      const textBlocks = data.content.filter(b => b.type === 'text');

      if (textBlocks.length > 0) {
        replyText += textBlocks.map(b => b.text).join('\n');
      }

      // If no tool use, we're done
      if (toolUseBlocks.length === 0 || data.stop_reason !== 'tool_use') {
        break;
      }

      // Process tool calls and build tool results
      messages.push({ role: 'assistant', content: data.content });

      const toolResults = [];
      for (const toolBlock of toolUseBlocks) {
        const { name, input, id } = toolBlock;
        let result = '';

        if (name === 'add_schedule_block') {
          const cat = input.category || 'other';
          const block = {
            id: Date.now() + Math.random(),
            text: input.text,
            startHour: input.startHour,
            endHour: input.endHour,
            color: CATEGORY_COLORS[cat] || ACTUAL_COLOR,
            type: input.type || 'planned',
            blockCategory: cat,
          };
          scheduleChanges.push({ action: 'add', date: input.date, block });
          result = `Added "${input.text}" (${cat}) from ${pad(input.startHour)}:00 to ${pad(input.endHour)}:00 on ${input.date}`;
        } else if (name === 'add_task') {
          const cat = input.category || 'other';
          scheduleChanges.push({
            action: 'add_task',
            date: input.date,
            task: { id: Date.now() + Math.random(), text: input.text, done: false, color: '#f1f5f9', blockCategory: cat },
          });
          result = `Added task "${input.text}" for ${input.date}`;
        } else if (name === 'remove_schedule_block') {
          scheduleChanges.push({ action: 'remove', date: input.date, matchText: input.text });
          result = `Removed block matching "${input.text}" on ${input.date}`;
        } else if (name === 'update_schedule_block') {
          scheduleChanges.push({
            action: 'update',
            date: input.date,
            matchText: input.matchText,
            updates: {
              ...(input.newText && { text: input.newText }),
              ...(input.newStartHour !== undefined && { startHour: input.newStartHour }),
              ...(input.newEndHour !== undefined && { endHour: input.newEndHour }),
            },
          });
          result = `Updated block "${input.matchText}" on ${input.date}`;
        } else {
          result = 'Unknown tool';
        }

        toolResults.push({ type: 'tool_result', tool_use_id: id, content: result });
      }

      messages.push({ role: 'user', content: toolResults });
    }

    res.json({ reply: replyText, scheduleChanges });
  } catch (error) {
    console.error('Coach API error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
