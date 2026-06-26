import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const today = new Date().toISOString().slice(0, 10);

  const [[challenges]] = await db.execute(
    `SELECT dc.id, dc.prompt, dc.emoji, dc.active_date,
       (SELECT COUNT(*) FROM challenge_responses cr WHERE cr.challenge_id = dc.id) as response_count,
       (SELECT id FROM challenge_responses cr WHERE cr.challenge_id = dc.id AND cr.user_id = ?) as my_response_id
     FROM daily_challenges dc
     WHERE dc.active_date = ?`,
    [session.id, today]
  ) as any[];

  if (!challenges) return NextResponse.json(null);

  const [responses] = await db.execute(
    `SELECT cr.id, cr.content, cr.media_url, cr.media_type, cr.created_at,
       u.username, u.first_name, u.profile_picture
     FROM challenge_responses cr
     JOIN users u ON u.id = cr.user_id
     WHERE cr.challenge_id = ?
     ORDER BY cr.created_at ASC`,
    [challenges.id]
  ) as any[];

  return NextResponse.json({ ...challenges, responses });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { prompt, emoji, active_date } = await request.json();
  if (!prompt?.trim()) return NextResponse.json({ message: 'Prompt required' }, { status: 400 });

  const date = active_date || new Date().toISOString().slice(0, 10);

  await db.execute(
    `INSERT INTO daily_challenges (prompt, emoji, active_date, created_by)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE prompt = VALUES(prompt), emoji = VALUES(emoji)`,
    [prompt.trim(), emoji || '🌟', date, session.id]
  );

  return NextResponse.json({ ok: true }, { status: 201 });
}
