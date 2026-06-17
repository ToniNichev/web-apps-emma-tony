import { NextResponse } from 'next/server';
import { getSession } from '@/app/lib/auth';
import db from '@/app/lib/db';

export const dynamic = 'force-dynamic';

// GET: stories from followed users + own stories (active only)
export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(`
    SELECT
      s.id, s.user_id, s.media_url, s.media_type, s.caption, s.created_at, s.expires_at,
      u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) as view_count,
      EXISTS(SELECT 1 FROM story_views sv WHERE sv.story_id = s.id AND sv.viewer_id = ?) as viewed
    FROM stories s
    JOIN users u ON s.user_id = u.id
    WHERE (s.expires_at IS NULL OR s.expires_at > NOW())
      AND (s.user_id = ? OR s.user_id IN (
        SELECT following_id FROM follows WHERE follower_id = ?
      ))
    ORDER BY s.user_id = ? DESC, s.created_at DESC
  `, [session.id, session.id, session.id, session.id]) as any[];

  // Group by user
  const userMap = new Map<number, any>();
  for (const row of rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        user_id: row.user_id,
        username: row.username,
        first_name: row.first_name,
        last_name: row.last_name,
        profile_picture: row.profile_picture,
        stories: [],
        has_unseen: false,
      });
    }
    const user = userMap.get(row.user_id);
    user.stories.push(row);
    if (!row.viewed) user.has_unseen = true;
  }

  // Own stories first, then others
  const result = Array.from(userMap.values());
  const own = result.filter(u => u.user_id === session.id);
  const others = result.filter(u => u.user_id !== session.id);
  return NextResponse.json([...own, ...others]);
}

// POST: create a story
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { media_url, media_type, caption, permanent } = await request.json();
  if (!media_url) return NextResponse.json({ error: 'media_url required' }, { status: 400 });

  const [result] = await db.execute(
    `INSERT INTO stories (user_id, media_url, media_type, caption, expires_at)
     VALUES (?, ?, ?, ?, ?)`,
    [session.id, media_url, media_type || 'image', caption || null,
     permanent ? null : new Date(Date.now() + 24 * 60 * 60 * 1000)]
  ) as any[];

  return NextResponse.json({ id: result.insertId });
}
