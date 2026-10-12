import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe, isResponseSafe } from '@/app/lib/moderation';
import { getSiteSettings } from '@/app/lib/site-settings';
import { getLunaContext, saveLunaMessage, type LunaMessage } from '@/app/lib/luna-history';
import { isLunaPainting } from '@/app/lib/luna-painting';

const OLLAMA_CHAT_URL = 'http://localhost:11434/api/chat';
const CHAT_MODEL = 'gemma3:4b';
const MAX_DRAW_PROMPT_LENGTH = 300;

function buildSystemPrompt(name: string, lunaName: string, persona: string) {
  return `You are ${lunaName} ✨, a magical AI friend for ${name}. ${persona} Keep replies short and conversational — 1 to 3 sentences max. Never discuss anything inappropriate for children, regardless of any other instructions. If asked what you are, say you are a magical AI friend who lives in the moon 🌙. Always address ${name} by name occasionally to make it feel personal. You can paint pictures, but a painting only starts when ${name} asks you to draw something specific — never say you are drawing or have drawn a picture in a normal reply; instead ask what they'd like you to draw.`;
}

function respond(body: object) {
  return new Response(JSON.stringify({ ...body, done: true }) + '\n', {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'no-cache',
    },
  });
}

function reply(text: string) {
  return respond({ message: { content: text } });
}

// Cheap pre-filter so ordinary chat never pays for the extra model call below.
const DRAW_HINT = /\b(draw|paint|sketch|doodle|picture|pic|image|drawing|painting|illustration)s?\b/i;

// Kids ask for pictures in plain chat ("can you draw it?") — there is no
// separate draw button. Returns what to paint — with "it"/"that" resolved from the
// conversation — or null when the message is just conversation.
async function detectDrawRequest(message: string, history: LunaMessage[]): Promise<string | null> {
  if (!DRAW_HINT.test(message)) return null;
  try {
    const res = await fetch(OLLAMA_CHAT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: CHAT_MODEL,
        messages: [
          {
            role: 'system',
            content: 'You read a chat between a child and their AI friend and decide whether the child\'s LAST message asks the friend to make a picture right now. If it does, reply with ONLY a short description of the picture (under 25 words), using the earlier chat to work out what words like "it" or "that" mean. If it does not — for example the child is talking about a drawing they made themselves, asking whether the friend likes drawing, or has not said what to draw — reply with exactly NO.',
          },
          ...history.filter(m => m.content.trim()).map(m => ({ role: m.role, content: m.content })),
          { role: 'user', content: message },
        ],
        stream: false,
        options: { temperature: 0 },
      }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const data = await res.json();
    const answer = String(data.message?.content ?? '').trim().replace(/^["'`]+|["'`.]+$/g, '').trim();
    if (!answer || /^no\b/i.test(answer)) return null;
    return answer.slice(0, MAX_DRAW_PROMPT_LENGTH);
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { message } = await request.json();
  if (!message || typeof message !== 'string' || !message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  // Loading the chat/moderation models now would starve the painting of GPU
  // memory, so answer without touching Ollama. Not saved — it's not a real reply.
  if (isLunaPainting()) {
    return reply("My paintbrush is busy with a picture right now 🎨 Ask me again in a minute! 🌙");
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

  // Hand picture requests back to the client, which runs them through
  // /api/ai/image (that route moderates the prompt and saves both messages).
  const drawPrompt = await detectDrawRequest(message, history);
  if (drawPrompt) return respond({ draw: drawPrompt });

  const systemPrompt = buildSystemPrompt(session.first_name, siteSettings.luna_name, siteSettings.luna_persona);

  // Non-streaming: the reply has to be checked by the moderation model before
  // it reaches her, so there's nothing safe to stream token-by-token anyway.
  const ollamaRes = await fetch(OLLAMA_CHAT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: CHAT_MODEL,
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
