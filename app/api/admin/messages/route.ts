import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.is_admin ?? 0) < 2) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const conversation_id = searchParams.get('conversation_id');
  if (!conversation_id) return NextResponse.json([], { status: 400 });

  const [rows] = await db.execute(`
    SELECT m.id, m.content, m.created_at,
      u.id as sender_id, u.username, u.first_name, u.profile_picture
    FROM messages m
    JOIN users u ON u.id = m.sender_id
    WHERE m.conversation_id = ?
    ORDER BY m.created_at ASC
  `, [conversation_id]) as any[];

  return NextResponse.json(rows);
}
