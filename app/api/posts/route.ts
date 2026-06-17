import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  const isSuperAdmin = session && (session.is_admin ?? 0) >= 2;
  const hiddenFilter = isSuperAdmin ? '' : 'AND (p.hidden IS NULL OR p.hidden = 0)';

  const [posts] = await db.execute(`
    SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
      GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
      GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types,
      GROUP_CONCAT(DISTINCT m.thumbnail_url ORDER BY m.order_index SEPARATOR '||') as media_thumbnails
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN media m ON m.post_id = p.id
    WHERE 1=1 ${hiddenFilter}
    GROUP BY p.id
    ORDER BY p.created_at DESC
    LIMIT 50
  `) as any[];

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { content, media, background } = await request.json();

  if (!content && (!media || media.length === 0)) {
    return NextResponse.json({ message: 'Post must have content or media' }, { status: 400 });
  }

  const validBgs = ['sunset','ocean','purple','forest','gold','midnight','rose','hearts','daisies'];
  const bg = validBgs.includes(background) ? background : null;

  const [result] = await db.execute(
    'INSERT INTO posts (user_id, content, background) VALUES (?, ?, ?)',
    [session.id, content || '', bg]
  ) as any[];

  const postId = (result as any).insertId;

  if (media && media.length > 0) {
    for (let i = 0; i < media.length; i++) {
      const m = media[i];
      await db.execute(
        'INSERT INTO media (post_id, user_id, type, url, thumbnail_url, order_index) VALUES (?, ?, ?, ?, ?, ?)',
        [postId, session.id, m.type, m.url, m.thumbnail_url || null, i]
      );
    }
  }

  return NextResponse.json({ id: postId }, { status: 201 });
}
