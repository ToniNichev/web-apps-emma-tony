import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { challenge_id, content, media_url, media_type } = await request.json();
  if (!challenge_id) return NextResponse.json({ message: 'challenge_id required' }, { status: 400 });
  if (!content?.trim() && !media_url) return NextResponse.json({ message: 'Response cannot be empty' }, { status: 400 });

  await db.execute(
    `INSERT INTO challenge_responses (challenge_id, user_id, content, media_url, media_type)
     VALUES (?, ?, ?, ?, ?)`,
    [challenge_id, session.id, content?.trim() || null, media_url || null, media_type || null]
  );

  // Notify: challenge creator + all previous responders (excluding self)
  const [challengeRows] = await db.execute(
    'SELECT created_by, prompt, emoji FROM daily_challenges WHERE id = ?',
    [challenge_id]
  ) as any[];
  const challenge = (challengeRows as any[])[0];

  if (challenge) {
    const preview = content?.trim()
      ? content.trim().substring(0, 80)
      : '(shared a photo/video)';

    // Collect unique user IDs to notify: creator + previous responders
    const [responderRows] = await db.execute(
      'SELECT DISTINCT user_id FROM challenge_responses WHERE challenge_id = ? AND user_id != ?',
      [challenge_id, session.id]
    ) as any[];

    const toNotify = new Set<number>();
    if (challenge.created_by !== session.id) toNotify.add(challenge.created_by);
    for (const r of responderRows as any[]) toNotify.add(r.user_id);

    for (const userId of toNotify) {
      await db.execute(
        `INSERT INTO notifications (user_id, actor_id, type, message_preview)
         VALUES (?, ?, 'challenge_response', ?)`,
        [userId, session.id, preview]
      );
    }
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await request.json();
  await db.execute(
    'DELETE FROM challenge_responses WHERE id = ? AND user_id = ?',
    [id, session.id]
  );

  return NextResponse.json({ ok: true });
}
