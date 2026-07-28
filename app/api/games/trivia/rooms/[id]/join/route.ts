import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [result] = await db.execute(
    'UPDATE trivia_room_players SET status = "joined", joined_at = NOW() WHERE room_id = ? AND user_id = ? AND status = "invited"',
    [roomId, session.id]
  ) as any[];

  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'No pending invite for this room' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`trivia:${roomId}`).emit('trivia:room_updated');

  return NextResponse.json({ ok: true });
}
