import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { id } = await params;

  // Only the recipient can report a note — hides it from their wall pending admin review.
  const [result] = await db.execute(
    'UPDATE kindness_notes SET hidden = 1 WHERE id = ? AND recipient_id = ?',
    [id, session.id]
  ) as any[];

  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'Note not found' }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
