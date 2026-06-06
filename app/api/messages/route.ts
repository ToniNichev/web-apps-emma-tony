import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const conversation_id = searchParams.get('conversation_id');
  if (!conversation_id) return NextResponse.json([], { status: 400 });

  const [rows] = await db.execute(`
    SELECT m.*, u.username, u.first_name, u.last_name, u.profile_picture
    FROM messages m
    JOIN users u ON m.sender_id = u.id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
    LIMIT 100
  `, [conversation_id]) as any[];

  await db.execute(
    'UPDATE messages SET read_at = NOW() WHERE conversation_id = ? AND sender_id != ? AND read_at IS NULL',
    [conversation_id, session.id]
  );

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { conversation_id, content } = await request.json();
  if (!content?.trim()) return NextResponse.json({ message: 'Empty message' }, { status: 400 });

  const [result] = await db.execute(
    'INSERT INTO messages (conversation_id, sender_id, content) VALUES (?, ?, ?)',
    [conversation_id, session.id, content.trim()]
  ) as any[];

  // Notify the other person in the conversation
  const [convRows] = await db.execute(
    'SELECT user1_id, user2_id FROM conversations WHERE id = ?',
    [conversation_id]
  ) as any[];
  const conv = (convRows as any[])[0];
  if (conv) {
    const recipientId = conv.user1_id === session.id ? conv.user2_id : conv.user1_id;
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, message_preview) VALUES (?, ?, "message", ?)',
      [recipientId, session.id, content.trim().substring(0, 100)]
    );
  }

  return NextResponse.json({ id: (result as any).insertId }, { status: 201 });
}
