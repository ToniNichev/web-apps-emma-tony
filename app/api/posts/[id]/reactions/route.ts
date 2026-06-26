import { NextResponse } from 'next/server';
import db from '@/app/lib/db';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const [rows] = await db.execute(
    'SELECT emoji, COUNT(*) as count FROM likes WHERE post_id = ? GROUP BY emoji ORDER BY count DESC',
    [id]
  ) as any[];

  return NextResponse.json(rows);
}
