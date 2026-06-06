import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(`
    SELECT c.*,
      CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END as other_user_id,
      u.username as other_username, u.first_name as other_first_name,
      u.last_name as other_last_name, u.profile_picture as other_profile_picture,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id AND m.sender_id != ? AND m.read_at IS NULL) as unread_count
    FROM conversations c
    JOIN users u ON u.id = CASE WHEN c.user1_id = ? THEN c.user2_id ELSE c.user1_id END
    WHERE c.user1_id = ? OR c.user2_id = ?
    ORDER BY last_message_at DESC
  `, [session.id, session.id, session.id, session.id, session.id]) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { other_user_id } = await request.json();
  const u1 = Math.min(session.id, other_user_id);
  const u2 = Math.max(session.id, other_user_id);

  const [existing] = await db.execute(
    'SELECT id FROM conversations WHERE user1_id = ? AND user2_id = ?', [u1, u2]
  ) as any[];

  if ((existing as any[]).length > 0) {
    return NextResponse.json({ id: (existing as any[])[0].id });
  }

  const [result] = await db.execute(
    'INSERT INTO conversations (user1_id, user2_id) VALUES (?, ?)', [u1, u2]
  ) as any[];

  return NextResponse.json({ id: (result as any).insertId }, { status: 201 });
}
