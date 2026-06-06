import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(_: Request, { params }: { params: Promise<{ username: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { username } = await params;
  const [rows] = await db.execute(
    'SELECT id, username, first_name, last_name, profile_picture FROM users WHERE username = ?',
    [username]
  ) as any[];

  const user = (rows as any[])[0];
  if (!user) return NextResponse.json({ message: 'Not found' }, { status: 404 });
  return NextResponse.json(user);
}
