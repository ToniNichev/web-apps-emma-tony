import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const { id } = await params;

  const { status } = await request.json();
  if (!['approved', 'rejected'].includes(status)) {
    return NextResponse.json({ message: 'Invalid status' }, { status: 400 });
  }

  await db.execute(
    'UPDATE challenge_suggestions SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ? AND status = "pending"',
    [status, session.id, id]
  );

  return NextResponse.json({ ok: true });
}
