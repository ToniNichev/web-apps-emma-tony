import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  await db.execute(
    'DELETE FROM webauthn_credentials WHERE id = ? AND user_id = ?',
    [id, session.id]
  );

  return NextResponse.json({ ok: true });
}
