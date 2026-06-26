import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session || (session.is_admin ?? 0) < 2) {
    return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const limit = Math.min(parseInt(searchParams.get('limit') || '100', 10), 200);

  const [rows] = await db.execute(`
    SELECT a.id, a.event_type, a.preview, a.ip, a.created_at,
      u.id as user_id, u.username, u.first_name, u.last_name, u.profile_picture
    FROM activity_log a
    JOIN users u ON u.id = a.user_id
    ${userId ? 'WHERE a.user_id = ?' : ''}
    ORDER BY a.created_at DESC
    LIMIT ${limit}
  `, userId ? [userId] : []) as any[];

  return NextResponse.json(rows);
}
