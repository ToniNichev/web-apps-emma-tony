import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function DELETE(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  const [rows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [id]) as any[];
  const post = (rows as any[])[0];

  if (!post) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  if (post.user_id !== session.id && !session.is_admin) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  await db.execute('DELETE FROM posts WHERE id = ?', [id]);
  return NextResponse.json({ message: 'Deleted' });
}
