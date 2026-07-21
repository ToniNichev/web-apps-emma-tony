import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [notes] = await db.execute(`
    SELECT k.id, k.message, k.created_at,
      s.username as sender_username, s.first_name as sender_first_name,
      r.username as recipient_username, r.first_name as recipient_first_name
    FROM kindness_notes k
    JOIN users s ON k.sender_id = s.id
    JOIN users r ON k.recipient_id = r.id
    WHERE k.hidden = 1
    ORDER BY k.created_at DESC
  `) as any[];

  return NextResponse.json(notes);
}

export async function DELETE(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { id, restore } = await request.json();
  if (!id) return NextResponse.json({ message: 'id required' }, { status: 400 });

  if (restore) {
    await db.execute('UPDATE kindness_notes SET hidden = 0 WHERE id = ?', [id]);
  } else {
    await db.execute('DELETE FROM kindness_notes WHERE id = ?', [id]);
  }

  return NextResponse.json({ ok: true });
}
