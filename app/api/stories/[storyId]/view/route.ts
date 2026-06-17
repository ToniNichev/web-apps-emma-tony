import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ storyId: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { storyId } = await params;

  await db.execute(
    'INSERT IGNORE INTO story_views (story_id, viewer_id) VALUES (?, ?)',
    [storyId, session.id]
  );

  return NextResponse.json({ ok: true });
}
