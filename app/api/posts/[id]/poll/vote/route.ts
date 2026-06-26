import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const { optionId } = await request.json();

  const [pollRows] = await db.execute('SELECT id, post_id FROM polls WHERE post_id = ?', [id]) as any[];
  const poll = (pollRows as any[])[0];
  if (!poll) return NextResponse.json({ message: 'Poll not found' }, { status: 404 });

  const [optionRows] = await db.execute(
    'SELECT id FROM poll_options WHERE id = ? AND poll_id = ?',
    [optionId, poll.id]
  ) as any[];
  if ((optionRows as any[]).length === 0) {
    return NextResponse.json({ message: 'Invalid option' }, { status: 400 });
  }

  const [existingVote] = await db.execute(
    'SELECT id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
    [poll.id, session.id]
  ) as any[];

  await db.execute(
    'INSERT INTO poll_votes (poll_id, option_id, user_id) VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE option_id = ?',
    [poll.id, optionId, session.id, optionId]
  );

  if ((existingVote as any[]).length === 0) {
    const [postRows] = await db.execute('SELECT user_id FROM posts WHERE id = ?', [poll.post_id]) as any[];
    const post = (postRows as any[])[0];
    if (post && post.user_id !== session.id) {
      await db.execute(
        'INSERT INTO notifications (user_id, actor_id, type, post_id) VALUES (?, ?, "poll_vote", ?)',
        [post.user_id, session.id, poll.post_id]
      );
    }
  }

  const [options] = await db.execute(`
    SELECT po.id, po.option_text,
      (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id = po.id) as vote_count
    FROM poll_options po WHERE po.poll_id = ?
    ORDER BY po.order_index
  `, [poll.id]) as any[];

  return NextResponse.json({ options, myVote: optionId });
}
