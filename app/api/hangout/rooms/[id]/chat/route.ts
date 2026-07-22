import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { isPromptSafe } from '@/app/lib/moderation';
import { rateLimit } from '@/app/lib/rate-limit';

const MAX_LENGTH = 200;

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const { message } = await request.json();
  const trimmed = (message ?? '').trim();
  if (!trimmed) return NextResponse.json({ message: 'Message cannot be empty' }, { status: 400 });
  if (trimmed.length > MAX_LENGTH) return NextResponse.json({ message: `Keep it under ${MAX_LENGTH} characters` }, { status: 400 });

  // Rate limit only counts requests that already passed basic validation —
  // same lesson as the Kindness Wall: don't burn a kid's budget on typos.
  if (!rateLimit(`hangout-chat:${session.id}`, 20, 60 * 1000)) {
    return NextResponse.json({ message: 'Slow down a bit! 🏡' }, { status: 429 });
  }

  const [memberRows] = await db.execute(
    'SELECT id FROM hangout_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, session.id]
  ) as any[];
  if ((memberRows as any[]).length === 0) {
    return NextResponse.json({ message: 'You are not in this room' }, { status: 403 });
  }

  if (!(await isPromptSafe(trimmed))) {
    return NextResponse.json({ message: "That message isn't allowed here. Try something else! 🏡" }, { status: 400 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:chat', {
    user_id: session.id,
    first_name: session.first_name,
    profile_picture: session.profile_picture,
    text: trimmed,
    t: Date.now(),
  });

  return NextResponse.json({ ok: true });
}
