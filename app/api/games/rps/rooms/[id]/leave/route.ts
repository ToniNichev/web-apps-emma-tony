import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { clearRoomState } from '@/app/lib/rps';

// It's 1v1 — unlike Hangout (up to 6 players), there's no version of this
// match that makes sense with one player gone, so either player leaving
// just ends the room for both, rather than host-only delete + guest-only
// leave-and-keep-going.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [memberRows] = await db.execute(
    'SELECT id FROM rps_room_players WHERE room_id = ? AND user_id = ?',
    [roomId, session.id]
  ) as any[];
  if ((memberRows as any[]).length === 0) {
    return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`rps:${roomId}`).emit('rps:room_deleted');

  clearRoomState(roomId);
  await db.execute('DELETE FROM rps_rooms WHERE id = ?', [roomId]);

  return NextResponse.json({ ok: true });
}
