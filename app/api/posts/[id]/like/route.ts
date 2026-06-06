import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [existing] = await db.execute(
    'SELECT id FROM likes WHERE post_id = ? AND user_id = ?',
    [id, session.id]
  ) as any[];

  if ((existing as any[]).length > 0) {
    await db.execute('DELETE FROM likes WHERE post_id = ? AND user_id = ?', [id, session.id]);
    return NextResponse.json({ liked: false });
  }

  await db.execute('INSERT INTO likes (post_id, user_id) VALUES (?, ?)', [id, session.id]);

  // Notify post owner (not self)
  const [postRows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [id]) as any[];
  const post = (postRows as any[])[0];
  if (post && post.user_id !== session.id) {
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, "like", ?)',
      [post.user_id, session.id, id]
    );
  }

  return NextResponse.json({ liked: true });
}
