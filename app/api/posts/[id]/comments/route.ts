import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const [comments] = await db.execute(`
    SELECT c.*, u.username, u.first_name, u.last_name, u.profile_picture
    FROM comments c
    JOIN users u ON c.user_id = u.id
    WHERE c.post_id = ?
    ORDER BY c.created_at ASC
  `, [id]) as any[];
  return NextResponse.json(comments);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { content } = await request.json();

  if (!content?.trim()) return NextResponse.json({ message: 'Comment cannot be empty' }, { status: 400 });

  await db.execute(
    'INSERT INTO comments (post_id, user_id, content) VALUES (?, ?, ?)',
    [id, session.id, content.trim()]
  );

  // Notify post owner (not self)
  const [postRows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [id]) as any[];
  const post = (postRows as any[])[0];
  if (post && post.user_id !== session.id) {
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, post_id, message_preview) VALUES (?, ?, "comment", ?, ?)',
      [post.user_id, session.id, id, content.trim().substring(0, 100)]
    );
  }

  return NextResponse.json({ message: 'Comment added' }, { status: 201 });
}
