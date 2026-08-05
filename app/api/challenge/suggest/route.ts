import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { rateLimit } from '@/app/lib/rate-limit';

const MAX_LENGTH = 200;

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { prompt, emoji } = await request.json();
  const trimmed = (prompt ?? '').trim();

  if (!trimmed) return NextResponse.json({ message: 'Prompt cannot be empty' }, { status: 400 });
  if (trimmed.length > MAX_LENGTH) return NextResponse.json({ message: `Keep it under ${MAX_LENGTH} characters` }, { status: 400 });

  if (!rateLimit(`challenge-suggest:${session.id}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ message: "You've suggested a lot of challenges today — try again tomorrow! 🎯" }, { status: 429 });
  }

  if (!(await isPromptSafe(trimmed))) {
    return NextResponse.json({ message: "That challenge isn't allowed here. Try something else! 🎯" }, { status: 400 });
  }

  await db.execute(
    'INSERT INTO challenge_suggestions (user_id, prompt, emoji) VALUES (?, ?, ?)',
    [session.id, trimmed, (emoji || '🌟').slice(0, 10)]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
