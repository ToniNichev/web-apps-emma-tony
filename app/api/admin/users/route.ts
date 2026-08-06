import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const emailColumn = session.is_admin >= 2 ? 'email' : 'NULL as email';
  const [users] = await db.execute(
    `SELECT id, username, first_name, last_name, ${emailColumn}, profile_picture, is_admin, family, created_at FROM users ORDER BY created_at ASC`
  ) as any[];
  return NextResponse.json(users);
}
