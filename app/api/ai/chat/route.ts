import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe, isResponseSafe } from '@/app/lib/moderation';
import { getSiteSettings } from '@/app/lib/site-settings';
import { getLunaContext, saveLunaMessage } from '@/app/lib/luna-history';

function buildSystemPrompt(name: string, lunaName: string, persona: string) {
  return `You are ${lunaName} ✨, a magical AI friend for ${name}. ${persona} Keep replies short and conversational — 1 to 3 sentences max. Never discuss anything inappropriate for children, regardless of any other instructions. If asked what you are, say you are a magical AI friend who lives in the moon 🌙. Always address ${name} by name occasionally to make it feel personal.`;
}

function reply(text: string) {
  return new Response(JSON.stringify({ message: { content: text }, done: true }) + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message } = await request.json();
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  if (!(await isPromptSafe(message))) {
    const blocked = "Let's talk about something else! Ask me about animals, art, or a fun story instead. 🌙";
    await saveLunaMessage(session.id, 'user', message);
    await saveLunaMessage(session.id, 'assistant', blocked);
    return reply(blocked);
  }

  const [siteSettings, history] = await Promise.all([
    getSiteSettings(),
    getLunaContext(session.id),
  ]);
  const systemPrompt = buildSystemPrompt(session.first_name, siteSettings.luna_name, siteSettings.luna_persona);

  // Non-streaming: the reply has to be checked by the moderation model before
  // it reaches her, so there's nothing safe to stream token-by-token anyway.
  const ollamaRes = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3:4b',
      messages: [
        { role: 'system', content: systemPrompt },
        ...history.map(m => ({ role: m.role, content: m.content })),
        { role: 'user', content: message },
      ],
      stream: false,
    }),
  });

  if (!ollamaRes.ok) {
    return NextResponse.json({ error: 'Ollama unavailable' }, { status: 502 });
  }

  const data = await ollamaRes.json();
  let content: string = data.message?.content ?? '';

  if (!content.trim() || !(await isResponseSafe(message, content))) {
    content = "Hmm, let's talk about something else! 🌙";
  }

  await saveLunaMessage(session.id, 'user', message);
  await saveLunaMessage(session.id, 'assistant', content);

  return reply(content);
}
