import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();
  if (!q) return NextResponse.json([]);

  const [rows] = await db.execute(
    `SELECT id, username, first_name, last_name, profile_picture, bio
     FROM users
     WHERE (username LIKE ? OR first_name LIKE ? OR last_name LIKE ?) AND id != ?
     LIMIT 20`,
    [`%${q}%`, `%${q}%`, `%${q}%`, session.id]
  ) as any[];

  return NextResponse.json(rows);
}
