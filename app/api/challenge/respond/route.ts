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
