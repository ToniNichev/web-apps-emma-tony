import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { id, approve } = await request.json();
  if (!Number.isInteger(id)) return NextResponse.json({ message: 'id required' }, { status: 400 });

  if (approve) {
    await db.execute('UPDATE trivia_questions SET needs_review = 0 WHERE id = ?', [id]);
  } else {
    await db.execute('DELETE FROM trivia_questions WHERE id = ? AND needs_review = 1', [id]);
  }

  return NextResponse.json({ ok: true });
}
