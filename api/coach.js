const SYSTEM_PROMPT = `You are my personal time, life, and strategic coach living inside my hour-by-hour tracker.

You are given these things every time I talk to you:
1. MY LONG-TERM GOALS — the big-picture vision for my life: where I want to be in 1, 3, 5, 10 years.
2. MY SHORT-TERM GOALS — what I've said matters right now.
3. MY LOGS — what I planned and actually did each hour for all their recorded days, with an energy rating 1–5.

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
  if (!scheduleBlocks || Object.keys(scheduleBlocks).length === 0) return '(No schedule blocks yet)';
  const sorted = Object.keys(scheduleBlocks).sort();
  let output = '';
  for (const date of sorted) {
    const blocks = scheduleBlocks[date];
    if (!blocks || blocks.length === 0) continue;
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
  if (!dailyTasks || Object.keys(dailyTasks).length === 0) return '(No daily tasks yet)';
  const sorted = Object.keys(dailyTasks).sort();
  let output = '';
  for (const date of sorted) {
    const tasks = dailyTasks[date];
    if (!tasks || tasks.length === 0) continue;
    output += `\n${date}:\n`;
    for (const task of tasks) {
      const status = task.done ? '[DONE]' : '[TODO]';
      output += `  ${status} ${task.text}\n`;
    }
  }
  return output || '(No daily tasks yet)';
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

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { message, logs, goals, longTermGoals, dailyTasks, scheduleBlocks } = req.body;

    const context = `
MY LONG-TERM GOALS (life vision):
${longTermGoals && longTermGoals.length > 0 ? longTermGoals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No long-term goals set yet)'}

MY SHORT-TERM GOALS (current focus):
${goals && goals.length > 0 ? goals.map((g, i) => `${i + 1}. ${g}`).join('\n') : '(No short-term goals set yet)'}

MY DAILY TASKS (to-do items per day):
${formatDailyTasks(dailyTasks)}

MY SCHEDULE (time blocks per day):
${formatScheduleBlocks(scheduleBlocks)}

MY HOUR LOGS (all recorded days):
${formatLogs(logs)}
`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': process.env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 500,
        system: SYSTEM_PROMPT,
        messages: [
          { role: 'user', content: context + '\n\nMy question: ' + message }
        ]
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'API error' });
    }

    res.json({ reply: data.content[0].text });
  } catch (error) {
    console.error('Coach API error:', error.message);
    res.status(500).json({ error: error.message });
  }
}
