import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const REACTIONS = ['❤️', '🔥', '😍', '😂', '😮', '✨'];

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const body = await request.json().catch(() => ({}));
  const emoji = REACTIONS.includes(body?.emoji) ? body.emoji : '❤️';

  const [existing] = await db.execute(
    'SELECT emoji FROM likes WHERE post_id = ? AND user_id = ?',
    [id, session.id]
  ) as any[];
  const current = (existing as any[])[0];

  if (current && current.emoji === emoji) {
    await db.execute('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [id, session.id]);
    return NextResponse.json({ reacted: false, emoji: null });
  }

  if (current) {
    await db.execute('UPDATE likes SET emoji = ? WHERE post_id = ? AND user_id = ?', [emoji, id, session.id]);
    return NextResponse.json({ reacted: true, emoji });
  }

  await db.execute('INSERT INTO likes (post_id, user_id, emoji) VALUES (?, ?, ?)', [id, session.id, emoji]);

  // Notify post owner (not self)
  const [postRows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [id]) as any[];
  const post = (postRows as any[])[0];
  if (post && post.user_id !== session.id) {
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, "like", ?)',
      [post.user_id, session.id, id]
    );
  }

  return NextResponse.json({ reacted: true, emoji });
}
