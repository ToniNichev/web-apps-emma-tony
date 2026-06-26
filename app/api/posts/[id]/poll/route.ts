import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  const { id } = await params;

  const [pollRows] = await db.execute('SELECT id FROM polls WHERE post_id = ?', [id]) as any[];
  const poll = (pollRows as any[])[0];
  if (!poll) return NextResponse.json(null);

  const [options] = await db.execute(`
    SELECT po.id, po.option_text,
      (SELECT COUNT(*) FROM poll_votes pv WHERE pv.option_id = po.id) as vote_count
    FROM poll_options po WHERE po.poll_id = ?
    ORDER BY po.order_index
  `, [poll.id]) as any[];

  let myVote: number | null = null;
  if (session) {
    const [voteRows] = await db.execute(
      'SELECT option_id FROM poll_votes WHERE poll_id = ? AND user_id = ?',
      [poll.id, session.id]
    ) as any[];
    myVote = (voteRows as any[])[0]?.option_id ?? null;
  }

  return NextResponse.json({ pollId: poll.id, options, myVote });
}
