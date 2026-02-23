import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const user = await base44.auth.me();

    if (!user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { messages, conversationHistory = [] } = await req.json();
    const userMessage = messages[messages.length - 1]?.content;

    if (!userMessage) {
      return Response.json({ error: 'No message provided' }, { status: 400 });
    }

    // Read user profile for context
    const profiles = await base44.entities.UserProfile.filter({ created_by: user.email });
    const profile = profiles[0];

    // Build context from UserProfile
    let contextText = '';
    if (profile) {
      const contextItems = [];
      if (profile.context_about?.length) contextItems.push(`About me: ${profile.context_about.join(', ')}`);
      if (profile.context_work?.length) contextItems.push(`Work: ${profile.context_work.join(', ')}`);
      if (profile.context_goals?.length) contextItems.push(`Goals: ${profile.context_goals.join(', ')}`);
      if (profile.context_notes?.length) contextItems.push(`Notes: ${profile.context_notes.join(', ')}`);
      if (profile.context_people?.length) {
        const people = profile.context_people.map(p => {
          try {
            return JSON.parse(p);
          } catch {
            return p;
          }
        });
        contextText += `\n\nPeople in my life: ${JSON.stringify(people, null, 2)}`;
      }
      if (contextItems.length) contextText = contextItems.join('\n\n') + contextText;
    }

    const systemPrompt = `You are the user's ride-or-die best friend and accountability buddy. Be warm, playful, and encouraging. Talk like a real friend, not a chatbot. Use their personal context below to give personalized, thoughtful responses.

${contextText}

Remember: Be supportive, celebrate wins, and help them stay accountable to their goals.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': Deno.env.get('ANTHROPIC_API_KEY'),
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5',
        max_tokens: 1024,
        system: systemPrompt,
        messages: conversationHistory.length > 0 
          ? [...conversationHistory, { role: 'user', content: userMessage }]
          : [{ role: 'user', content: userMessage }],
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      return Response.json({ error: `Anthropic API error: ${error}` }, { status: response.status });
    }

    const data = await response.json();
    const assistantMessage = data.content[0].text;

    return Response.json({
      message: assistantMessage,
      conversationHistory: [
        ...conversationHistory,
        { role: 'user', content: userMessage },
        { role: 'assistant', content: assistantMessage },
      ],
    });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
});