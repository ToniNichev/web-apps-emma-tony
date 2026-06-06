import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  await db.execute(
    'UPDATE notifications SET read_at = NOW() WHERE user_id = ? AND read_at IS NULL',
    [session.id]
  );

  return NextResponse.json({ message: 'Marked as read' });
}
