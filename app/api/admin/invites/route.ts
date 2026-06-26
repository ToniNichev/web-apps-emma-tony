import { NextResponse } from 'next/server';
import { randomBytes } from 'crypto';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [rows] = await db.execute(`
    SELECT i.id, i.code, i.created_at, i.used_at,
      c.username AS created_by_username,
      u.username AS used_by_username
    FROM invites i
    JOIN users c ON c.id = i.created_by
    LEFT JOIN users u ON u.id = i.used_by
    ORDER BY i.created_at DESC
  `) as any[];

  return NextResponse.json(rows);
}

export async function POST() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const code = randomBytes(12).toString('hex');
  await db.execute('INSERT INTO invites (code, created_by) VALUES (?, ?)', [code, session.id]);
  return NextResponse.json({ code }, { status: 201 });
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { id } = await request.json();
  await db.execute('DELETE FROM invites WHERE id = ? AND used_by IS NULL', [id]);
  return NextResponse.json({ ok: true });
}
