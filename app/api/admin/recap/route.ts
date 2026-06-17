import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request) {
  const session = await getSession();
  if (!session?.is_admin) return NextResponse.json({ message: 'Forbidden' }, { status: 403 });

  const { searchParams } = new URL(request.url);
  const userId = searchParams.get('userId');
  const period = searchParams.get('period') || 'week';

  if (!userId) return NextResponse.json({ message: 'userId required' }, { status: 400 });

  const since = period === 'today'
    ? 'DATE(NOW())'
    : period === 'week'
    ? 'DATE_SUB(NOW(), INTERVAL 7 DAY)'
    : 'DATE_SUB(NOW(), INTERVAL 30 DAY)';

  const [[posts], [stories], [msgRows], [likesRows], [commentsRows]] = await Promise.all([
    db.execute(`
      SELECT p.id, p.content, p.background, p.created_at,
        GROUP_CONCAT(DISTINCT m.url   ORDER BY m.order_index SEPARATOR '||') AS media_urls,
        GROUP_CONCAT(DISTINCT m.type  ORDER BY m.order_index SEPARATOR '||') AS media_types,
        (SELECT COUNT(*) FROM likes    l WHERE l.post_id    = p.id) AS like_count,
        (SELECT COUNT(*) FROM comments c WHERE c.post_id    = p.id) AS comment_count
      FROM posts p
      LEFT JOIN media m ON m.post_id = p.id
      WHERE p.user_id = ? AND p.created_at >= ${since}
      GROUP BY p.id ORDER BY p.created_at DESC
    `, [userId]),

    db.execute(`
      SELECT s.id, s.media_url, s.media_type, s.caption, s.created_at, s.expires_at,
        (SELECT COUNT(*) FROM story_views sv WHERE sv.story_id = s.id) AS view_count
      FROM stories s
      WHERE s.user_id = ? AND s.created_at >= ${since}
      ORDER BY s.created_at DESC
    `, [userId]),

    db.execute(
      `SELECT COUNT(*) AS cnt FROM messages WHERE sender_id = ? AND created_at >= ${since}`,
      [userId]
    ),

    db.execute(
      `SELECT COUNT(*) AS cnt FROM likes WHERE user_id = ? AND created_at >= ${since}`,
      [userId]
    ),

    db.execute(
      `SELECT COUNT(*) AS cnt FROM comments WHERE user_id = ? AND created_at >= ${since}`,
      [userId]
    ),
  ]) as any[];

  return NextResponse.json({
    posts,
    stories,
    messagesSent:   (msgRows      as any[])[0]?.cnt ?? 0,
    likesGiven:     (likesRows    as any[])[0]?.cnt ?? 0,
    commentsMade:   (commentsRows as any[])[0]?.cnt ?? 0,
  });
}
