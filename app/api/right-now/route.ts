import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json(null);

  // Active window: scheduled_for is in the past but less than 2 minutes ago
  const [sessions] = await db.execute(`
    SELECT id, scheduled_for
    FROM right_now_sessions
    WHERE scheduled_for <= NOW()
      AND scheduled_for >= NOW() - INTERVAL 2 MINUTE
    ORDER BY scheduled_for DESC
    LIMIT 1
  `) as any[];

  const active = (sessions as any[])[0] || null;
  if (!active) return NextResponse.json(null);

  const [posted] = await db.execute(
    'SELECT id FROM posts WHERE user_id = ? AND right_now_session_id = ?',
    [session.id, active.id]
  ) as any[];

  return NextResponse.json({
    id: active.id,
    scheduled_for: active.scheduled_for,
    already_posted: (posted as any[]).length > 0,
  });
}
