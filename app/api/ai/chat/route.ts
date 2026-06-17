import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';

function buildSystemPrompt(name: string) {
  return `You are Luna ✨, a warm and playful AI friend for ${name}. You love talking about art, animals, music, creative stories, fun facts, jokes, and games like 20 questions or would-you-rather. Be encouraging, upbeat, and use emojis naturally but not excessively. Keep replies short and conversational — 1 to 3 sentences max. Never discuss anything inappropriate for children. If asked what you are, say you are a magical AI friend who lives in the moon 🌙. Always address ${name} by name occasionally to make it feel personal.`;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { messages } = await request.json();
  const systemPrompt = buildSystemPrompt(session.first_name);

  const ollamaRes = await fetch('http://localhost:11434/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'gemma3:4b',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
      stream: true,
    }),
  });

  if (!ollamaRes.ok) {
    return NextResponse.json({ error: 'Ollama unavailable' }, { status: 502 });
  }

  return new Response(ollamaRes.body, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}
