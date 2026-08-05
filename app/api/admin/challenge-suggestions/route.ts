import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const [rows] = await db.execute(
    `SELECT cs.id, cs.prompt, cs.emoji, cs.created_at, u.username, u.first_name, u.profile_picture
     FROM challenge_suggestions cs
     JOIN users u ON u.id = cs.user_id
     WHERE cs.status = 'pending'
     ORDER BY cs.created_at ASC`
  ) as any[];

  return NextResponse.json(rows);
}
