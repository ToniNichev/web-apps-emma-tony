import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    `SELECT u.id, u.username, u.first_name, u.last_name, u.profile_picture
     FROM users u
     JOIN follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
     ORDER BY u.first_name ASC`,
    [session.id, session.id]
  ) as any[];

  return NextResponse.json(rows);
}
