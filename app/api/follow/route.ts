import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { following_id } = await request.json();
  if (following_id === session.id) return NextResponse.json({ message: 'Cannot follow yourself' }, { status: 400 });

  const [existing] = await db.execute(
    'SELECT id FROM follows WHERE follower_id = ? AND following_id = ?',
    [session.id, following_id]
  ) as any[];

  if ((existing as any[]).length > 0) {
    await db.execute('DELETE FROM follows WHERE follower_id = ? AND following_id = ?', [session.id, following_id]);
    return NextResponse.json({ following: false });
  }

  await db.execute('INSERT INTO follows (follower_id, following_id) VALUES (?, ?)', [session.id, following_id]);

  await db.execute(
    'INSERT INTO notifications (user_id, actor_id, type) VALUES (?, ?, "follow")',
    [following_id, session.id]
  );

  return NextResponse.json({ following: true });
}
