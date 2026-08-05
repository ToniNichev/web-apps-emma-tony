import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { checkBadges } from '@/app/lib/badges';
import { logRiverEvent } from '@/app/lib/river';
import { isPromptSafe } from '@/app/lib/moderation';
import { rateLimit } from '@/app/lib/rate-limit';

const MAX_LENGTH = 280;

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  // Deliberately no sender fields — the recipient's client must never see who sent a note.
  const [notes] = await db.execute(
    'SELECT id, message, created_at FROM kindness_notes WHERE recipient_id = ? AND hidden = 0 ORDER BY created_at DESC',
    [session.id]
  ) as any[];

  return NextResponse.json(notes);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { recipient_id, message } = await request.json();
  const recipientId = Number(recipient_id);
  const trimmed = (message ?? '').trim();

  if (!recipientId) return NextResponse.json({ message: 'recipient_id required' }, { status: 400 });
  if (recipientId === session.id) return NextResponse.json({ message: "You can't send kindness to yourself" }, { status: 400 });
  if (!trimmed) return NextResponse.json({ message: 'Message cannot be empty' }, { status: 400 });
  if (trimmed.length > MAX_LENGTH) return NextResponse.json({ message: `Keep it under ${MAX_LENGTH} characters` }, { status: 400 });

  // Rate limit only counts requests that pass basic validation — a mistyped
  // recipient or an over-length draft shouldn't burn a kid's daily budget.
  if (!rateLimit(`kindness:${session.id}`, 5, 24 * 60 * 60 * 1000)) {
    return NextResponse.json({ message: "You've sent a lot of kindness today — try again tomorrow! 💛" }, { status: 429 });
  }

  // Mutual follows only — no sending to strangers.
  const [followRows] = await db.execute(
    `SELECT
       (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) as i_follow_them,
       (SELECT COUNT(*) FROM follows WHERE follower_id = ? AND following_id = ?) as they_follow_me`,
    [session.id, recipientId, recipientId, session.id]
  ) as any[];
  const { i_follow_them, they_follow_me } = (followRows as any[])[0];
  if (!i_follow_them || !they_follow_me) {
    return NextResponse.json({ message: 'You can only send kindness to friends who follow you back' }, { status: 403 });
  }

  if (!(await isPromptSafe(trimmed))) {
    return NextResponse.json({ message: "That message isn't allowed here. Try something kinder! 💛" }, { status: 400 });
  }

  await db.execute(
    'INSERT INTO kindness_notes (sender_id, recipient_id, message) VALUES (?, ?, ?)',
    [session.id, recipientId, trimmed]
  );

  await db.execute(
    'INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, "kindness_note")',
    [recipientId, session.id]
  );

  // No sender identity in the river event either — same anonymity rule as the note itself.
  logRiverEvent(recipientId, 'kindness_received', 'Received a kindness note', '💛');

  checkBadges(session.id).catch(() => {});

  return NextResponse.json({ ok: true }, { status: 201 });
}
