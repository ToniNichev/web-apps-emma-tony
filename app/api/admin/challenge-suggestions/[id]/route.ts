import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { logRiverEvent } from '@/app/lib/river';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const { status } = await request.json();
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
  }

  const [rows] = await db.execute(
    'SELECT user_id FROM challenge_suggestions WHERE id = ? AND status = "pending"',
    [id]
  ) as any[];
  const suggestion = (rows as any[])[0];
  if (!suggestion) return NextResponse.json({ message: 'Already reviewed' }, { status: 404 });

  await db.execute(
    'UPDATE challenge_suggestions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
    [status, session.id, id]
  );

  if (status === 'approved') {
    logRiverEvent(suggestion.user_id, 'challenge_picked', 'Your challenge idea got picked!', '💡');
  }

  return NextResponse.json({ ok: true });
}
