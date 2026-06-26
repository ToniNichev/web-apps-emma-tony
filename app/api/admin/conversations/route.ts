import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session || (session.is_admin ?? 0) < 2) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const [rows] = await db.execute(`
    SELECT c.id, c.created_at,
      u1.id as user1_id, u1.username as user1_username, u1.first_name as user1_first_name, u1.profile_picture as user1_pic,
      u2.id as user2_id, u2.username as user2_username, u2.first_name as user2_first_name, u2.profile_picture as user2_pic,
      (SELECT content FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message,
      (SELECT created_at FROM messages m WHERE m.conversation_id = c.id ORDER BY m.created_at DESC LIMIT 1) as last_message_at,
      (SELECT COUNT(*) FROM messages m WHERE m.conversation_id = c.id) as message_count
    FROM conversations c
    JOIN users u1 ON u1.id = c.user1_id
    JOIN users u2 ON u2.id = c.user2_id
    ORDER BY last_message_at DESC
  `) as any[];

  return NextResponse.json(rows);
}
