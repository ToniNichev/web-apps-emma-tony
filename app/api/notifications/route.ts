import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(`
    SELECT n.*, 
      u.username as actor_username, u.first_name as actor_first_name,
      u.last_name as actor_last_name, u.profile_picture as actor_profile_picture,
      p.content as post_content
    FROM notifications n
    JOIN users u ON n.actor_id = u.id
    LEFT JOIN posts p ON n.post_id = p.id
    WHERE n.user_id = ?
    ORDER BY n.created_at DESC
    LIMIT 50
  `, [session.id]) as any[];

  return NextResponse.json(rows);
}
