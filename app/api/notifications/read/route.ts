import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { ids } = await request.json().catch(() => ({ ids: null }));

  // Only mark as read the notifications the caller actually says it showed —
  // an unscoped update would mark unseen notifications read too (user_id
  // still fully scopes ownership either way).
  if (Array.isArray(ids) && ids.length > 0) {
    const numericIds = ids.map(Number).filter(Number.isInteger);
    if (numericIds.length > 0) {
      await db.execute(
        `UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL AND id IN (${numericIds.map(() => '?').join(',')})`,
        [session.id, ...numericIds]
      );
    }
  } else {
    await db.execute(
      'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
      [session.id]
    );
  }

  return NextResponse.json({ message: 'Marked as read' });
}
