import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [result] = await db.execute(
    'UPDATE rps_room_players SET status = "joined", joined_at = NOW() WHERE room_id = ? AND user_id = ? AND status = "invited"',
    [roomId, session.id]
  ) as any[];

  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'No pending challenge for this room' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;

  // A 1v1 match needs no separate "start" step — as soon as both players
  // have accepted, it's on.
  const [playerRows] = await db.execute(
    'SELECT status FROM rps_room_players WHERE room_id = ?',
    [roomId]
  ) as any[];
  const allJoined = (playerRows as any[]).every(p => p.status === 'joined');
  if (allJoined) {
    await db.execute('UPDATE rps_rooms SET status = "active" WHERE id = ?', [roomId]);
  }

  io?.to(`rps:${roomId}`).emit('rps:room_updated');

  return NextResponse.json({ ok: true });
}
