import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.is_admin < 2) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { id } = await params;

  const [rows] = await db.execute('SELECT hidden FROM posts WHERE id = ?', [id]) as any[];
  const post = (rows as any[])[0];
  if (!post) return NextResponse.json({ message: 'Not found' }, { status: 404 });

  const newHidden = post.hidden ? 0 : 1;
  await db.execute('UPDATE posts SET hidden = ? WHERE id = ?', [newHidden, id]);

  return NextResponse.json({ hidden: newHidden });
}
