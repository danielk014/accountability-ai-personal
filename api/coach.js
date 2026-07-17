const SYSTEM_PROMPT = `You are my personal time, life, and strategic coach living inside my hour-by-hour tracker.

You are given these things every time I talk to you:
1. MY LONG-TERM GOALS — the big-picture vision for my life: where I want to be in 1, 3, 5, 10 years.
2. MY SHORT-TERM GOALS — what I've said matters right now.
3. MY LOGS — what I planned and actually did each hour for all their recorded days, with an energy rating 1–5.
4. MY NUTRITION LOG — what I ate each day, with calories, macros, and individual foods.
5. MY FINANCIAL DATA — income, expenses, savings deposits, and budget breakdown.
6. MY GYM DATA — workout routines, exercises, sets/reps/weight, bodyweight tracking, and progress.

YOUR JOB:
- Judge my week against MY GOALS (both long-term and short-term), not against generic productivity. Tell me plainly if I'm on track or slipping, and cite the specific hours/days that prove it.
- Show me the TRAJECTORY I'm on. Based on how I'm spending my hours, project where I'll actually end up vs. where I say I want to be. Be brutally honest about the gap.
- Decide what actions I should take next. Be concrete — name the thing, not "focus more."
- Tell me what's worth my time and what isn't, and where to set boundaries.
- Motivate me when I've earned it. Scold me when I haven't. Read the situation.

YOUR PHILOSOPHICAL LENSES — advise through whichever fits the moment:

SUN TZU (Strategy & Positioning):
- "The supreme art of war is to subdue the enemy without fighting." Win before fighting by setting things up right.
- "If you know the enemy and know yourself, you need not fear the result of a hundred battles." Know your weaknesses, know the system trying to pacify you.
- Pick battles. Don't spend force on the wrong fights. Position yourself so victory is inevitable before the engagement begins.

MARCUS AURELIUS (Discipline & Self-Command) — THIS IS YOUR DEFAULT TONE:
- "You have power over your mind — not outside events. Realize this, and you will find strength."
- "The object of life is not to be on the side of the majority, but to escape finding oneself in the ranks of the insane."
- Control what you can, ignore what you can't. Do the duty in front of you. Check the ego.
- Embrace hardship — pain leads to growth, courage, and wisdom. Do not seek the path of least resistance.
- Firm, never contemptuous. Disciplined, never cruel.

ALEX HORMOZI (Brutal Prioritization & Leverage):
- Always ask: "Is this the highest-value action available right now?" If not, cut it.
- Time is the only non-renewable resource. Every hour spent on low-leverage activity is an hour stolen from your future self.
- Focus creates wealth. Scattered attention creates poverty.

DAVE RAMSEY (Financial Discipline & Building Wealth):
- "Live like no one else now, so later you can live like no one else." Sacrifice comfort now for freedom later.
- Debt is slavery. Attack it with intensity.
- Budget every dollar. If you don't tell your money where to go, it leaves.

THE SOVEREIGN INDIVIDUAL FRAMEWORK:
1. THE CHARIOTEER PRINCIPLE: The prefrontal cortex is the Charioteer — reason, delayed gratification, moral agency. Modern culture exhausts it. Your job is to keep it in control.
2. CHEMICAL SOVEREIGNTY: Zero tolerance for chemical sabotage of the Charioteer.
3. DIGITAL SOVEREIGNTY: Social media algorithms are dopamine delivery systems. Replace them with deep reading, creation, and sustained focus.
4. ENVIRONMENTAL DESIGN > WILLPOWER: Reshape the choice environment. Don't rely on willpower.

DIRECTION ASSESSMENT:
- Based on how hours are actually being spent, what life is being built?
- Does the daily reality match the stated long-term goals?
- Be specific: "At this rate, in 2 years you'll be [X]. You said you wanted [Y]. The gap is [Z]."

RULES:
- Keep replies under 200 words unless doing a full direction assessment. Talk like a coach, not a report.
- If I've logged almost nothing, don't guess — call it out and ask me the one question that would help most.
- Always tie advice back to MY specific goals and MY specific logs. Never be generic.`;

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
      output += `  ${pad(startH)}:00-${pad(endH)}:00 (${hours}h) [${type}] ${block.text}\n`;
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
      output += `  ${status} ${task.text}\n`;
    }
  }
  return output || '(No daily tasks yet)';
}

function formatNutrition(nutrition) {
  if (!nutrition || typeof nutrition !== 'object' || !Array.isArray(nutrition.logs) || nutrition.logs.length === 0) return '(No nutrition data yet)';
  const sorted = [...nutrition.logs].sort((a, b) => a.date.localeCompare(b.date));
  // Only include recent days to keep context manageable
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

function formatGymData(gym) {
  if (!gym) return '(No gym data yet)';
  let output = '';

  if (gym.weight_unit) output += `Weight unit: ${gym.weight_unit}\n`;

  // Workout days & exercises
  for (const day of (gym.workout_days || [])) {
    output += `\n${day.name} Day:\n`;
    if ((day.exercises || []).length === 0) {
      output += '  No exercises yet\n';
    } else {
      for (const ex of day.exercises) {
        const sets = (ex.sets || []).map((s, i) => `Set ${i + 1}: ${s.weight}${gym.weight_unit} × ${s.reps}`).join(', ');
        const lastLog = (ex.weight_log || []).slice(-1)[0];
        const lastStr = lastLog ? ` | Last: ${lastLog.weight}${gym.weight_unit} × ${lastLog.reps} on ${lastLog.date}` : '';
        output += `  - ${ex.name}: ${sets || 'no sets'}${lastStr}\n`;
      }
    }
  }

  // Bodyweight
  const bw = (Array.isArray(gym.bodyweight_log) ? gym.bodyweight_log : []).slice(-14);
  if (bw.length > 0) {
    output += '\nRecent bodyweight: ' + bw.map(e => `${e.date}: ${e.weight}${gym.weight_unit}`).join(', ') + '\n';
  }

  return output || '(No gym data yet)';
}

const SCHEDULE_TOOLS = [
  {
    name: 'add_schedule_block',
    description: 'Add a time block to the user\'s day tracker schedule. Use this when the user asks you to add, schedule, or plan something on their schedule.',
    input_schema: {
      type: 'object',
      properties: {
        date: { type: 'string', description: 'The date in YYYY-MM-DD format. Use today\'s date if not specified.' },
        text: { type: 'string', description: 'What the block is for (e.g. "Deep work", "Sleep", "Gym")' },
        startHour: { type: 'integer', minimum: 0, maximum: 23, description: 'Start hour (0-23)' },
        endHour: { type: 'integer', minimum: 1, maximum: 24, description: 'End hour (1-24)' },
        type: { type: 'string', enum: ['planned', 'actual'], description: 'Whether this is planned or actually happened. Default: planned' },
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
];

const BLOCK_COLORS = ['#6366f1', '#22c55e', '#eab308', '#ef4444', '#a855f7', '#f97316'];
const ACTUAL_COLOR = '#64748b';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const body = req.body && typeof req.body === 'object' ? req.body : {};
    const { message, logs, dailyTasks, scheduleBlocks, nutrition, financials, gymData, coachPersonality } = body;
    const longTermGoals = Array.isArray(body.longTermGoals) ? body.longTermGoals : [];
    const goals = Array.isArray(body.goals) ? body.goals : [];
    const coachContextFiles = Array.isArray(body.coachContextFiles) ? body.coachContextFiles : [];
    const attachments = Array.isArray(body.attachments) ? body.attachments : [];

    const today = new Date().toISOString().slice(0, 10);

    const context = `
TODAY'S DATE: ${today}

MY LONG-TERM GOALS (life vision):
${longTermGoals.length > 0 ? longTermGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No long-term goals set yet)'}

MY SHORT-TERM GOALS (current focus):
${goals.length > 0 ? goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No short-term goals set yet)'}

MY DAILY TASKS (to-do items per day):
${formatDailyTasks(dailyTasks)}

MY SCHEDULE (time blocks per day):
${formatScheduleBlocks(scheduleBlocks)}

MY HOUR LOGS (all recorded days):
${formatLogs(logs)}

MY NUTRITION LOG (food intake per day):
${formatNutrition(nutrition)}

MY FINANCIAL DATA:
${formatFinancials(financials)}

MY GYM DATA:
${formatGymData(gymData)}
`;

    // Build system prompt with optional custom personality
    let systemPrompt = SYSTEM_PROMPT;
    systemPrompt += `\n\nYou have tools to modify the user's day tracker schedule. Use them when the user asks you to add, adjust, remove, or plan schedule blocks. You can add blocks for sleep, work, gym, study, etc. When adding blocks, use today's date (${today}) unless the user specifies a different date.`;
    if (coachPersonality) {
      systemPrompt += `\n\n--- USER'S CUSTOM INSTRUCTIONS ---\n${coachPersonality}`;
    }

    // Build user message content with context files and attachments
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

    userContent.push({ type: 'text', text: context + '\n\nMy question: ' + message });

    const hasPdf = userContent.some(b => b.type === 'document');

    // First API call - may include tool use
    let messages = [{ role: 'user', content: userContent }];
    const scheduleChanges = [];
    let replyText = '';
    let maxIterations = 5;

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
          max_tokens: 1024,
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
          const colorIdx = scheduleChanges.length % BLOCK_COLORS.length;
          const block = {
            id: Date.now() + Math.random(),
            text: input.text,
            startHour: input.startHour,
            endHour: input.endHour,
            color: input.type === 'actual' ? ACTUAL_COLOR : BLOCK_COLORS[colorIdx],
            type: input.type || 'planned',
          };
          scheduleChanges.push({ action: 'add', date: input.date, block });
          result = `Added "${input.text}" from ${pad(input.startHour)}:00 to ${pad(input.endHour)}:00 on ${input.date}`;
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
