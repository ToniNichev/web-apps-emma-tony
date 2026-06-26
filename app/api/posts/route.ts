import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { POSTS_PAGE_SIZE } from '@/app/lib/constants';
import { checkBadges } from '@/app/lib/badges';
import { isPromptSafe } from '@/app/lib/moderation';
import { logActivity } from '@/app/lib/activity';

export async function GET(request: Request) {
  const session = await getSession();
  const isSuperAdmin = session && (session.is_admin ?? 0) >= 2;
  const hiddenFilter = isSuperAdmin ? '' : 'AND (p.hidden IS NULL OR p.hidden = 0)';

  const { searchParams } = new URL(request.url);
  const before = parseInt(searchParams.get('before') || '', 10);
  const cursorFilter = Number.isInteger(before) ? 'AND p.id < ?' : '';
  const params = [session?.id ?? 0, ...(Number.isInteger(before) ? [before] : [])];

  const [posts] = await db.execute(`
    SELECT p.*, u.username, u.first_name, u.last_name, u.profile_picture,
      (SELECT COUNT(*) FROM likes l WHERE l.post_id = p.id) as like_count,
      (SELECT emoji FROM likes l WHERE l.post_id = p.id AND l.user_id = ?) as my_reaction,
      (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id) as comment_count,
      (SELECT id FROM polls pl WHERE pl.post_id = p.id) as poll_id,
      GROUP_CONCAT(DISTINCT m.url ORDER BY m.order_index SEPARATOR '||') as media_urls,
      GROUP_CONCAT(DISTINCT m.type ORDER BY m.order_index SEPARATOR '||') as media_types,
      GROUP_CONCAT(DISTINCT m.thumbnail_url ORDER BY m.order_index SEPARATOR '||') as media_thumbnails,
      p.right_now_session_id,
      TIMESTAMPDIFF(SECOND, rns.scheduled_for, p.created_at) as right_now_seconds_late
    FROM posts p
    JOIN users u ON p.user_id = u.id
    LEFT JOIN media m ON m.post_id = p.id
    LEFT JOIN right_now_sessions rns ON p.right_now_session_id = rns.id
    WHERE 1=1 ${hiddenFilter} ${cursorFilter}
    GROUP BY p.id
    ORDER BY p.id DESC
    LIMIT ${POSTS_PAGE_SIZE}
  `, params) as any[];

  return NextResponse.json(posts);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { content, media, background, poll, right_now_session_id } = await request.json();

  const pollOptions: string[] = Array.isArray(poll?.options)
    ? poll.options.map((o: string) => o?.trim()).filter(Boolean).slice(0, 4)
    : [];
  const hasPoll = pollOptions.length >= 2;

  if (content && !(await isPromptSafe(content))) {
    return NextResponse.json({ message: "That content isn't allowed here. Try something else! 🌸" }, { status: 400 });
  }

  if (!content && (!media || media.length === 0) && !hasPoll) {
    return NextResponse.json({ message: 'Post must have content, media, or a poll' }, { status: 400 });
  }
  if (poll && !hasPoll) {
    return NextResponse.json({ message: 'A poll needs at least 2 options' }, { status: 400 });
  }

  const validBgs = ['sunset','ocean','purple','forest','gold','midnight','rose','hearts','daisies'];
  const bg = validBgs.includes(background) ? background : null;

  const [result] = await db.execute(
    'INSERT INTO posts (user_id, content, background, right_now_session_id) VALUES (?, ?, ?, ?)',
    [session.id, content || '', bg, right_now_session_id || null]
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

  if (hasPoll) {
    const [pollResult] = await db.execute('INSERT INTO polls (post_id) VALUES (?)', [postId]) as any[];
    const pollId = (pollResult as any).insertId;
    for (let i = 0; i < pollOptions.length; i++) {
      await db.execute(
        'INSERT INTO poll_options (poll_id, option_text, order_index) VALUES (?, ?, ?)',
        [pollId, pollOptions[i], i]
      );
    }
  }

  logActivity(session.id, 'post_created', content?.substring(0, 100));
  checkBadges(session.id).catch(() => {});
  return NextResponse.json({ id: postId }, { status: 201 });
}
