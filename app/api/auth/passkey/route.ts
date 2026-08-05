import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    `SELECT id, nickname, device_type, backed_up, created_at, last_used_at
     FROM webauthn_credentials WHERE user_id = ? ORDER BY created_at DESC`,
    [session.id]
  ) as any[];

  return NextResponse.json(rows);
}
