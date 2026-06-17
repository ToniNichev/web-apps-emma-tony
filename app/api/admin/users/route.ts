import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });
  const [users] = await db.execute(
    'SELECT id, username, first_name, last_name, email, profile_picture, is_admin, created_at FROM users ORDER BY created_at ASC'
  ) as any[];
  return NextResponse.json(users);
}
