import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  const body = await request.json();

  if (typeof body.is_admin === 'number') {
    if (session.is_admin < 2) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
    await db.execute('UPDATE users SET is_admin = ? WHERE id = ?', [body.is_admin, id]);
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session || session.is_admin < 2) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { id } = await params;
  if (Number(id) === session.id) return NextResponse.json({ message: 'Cannot delete yourself' }, { status: 400 });

  await db.execute('DELETE FROM users WHERE id = ?', [id]);
  return NextResponse.json({ ok: true });
}
