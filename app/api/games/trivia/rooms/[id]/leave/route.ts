import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by === session.id) {
    return NextResponse.json({ message: "The host can't leave — delete the room instead" }, { status: 400 });
  }

  const [result] = await db.execute(
    'DELETE FROM trivia_room_players WHERE room_id = ? AND user_id = ?',
    [roomId, session.id]
  ) as any[];
  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'You are not in this room' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`trivia:${roomId}`).emit('trivia:room_updated');

  return NextResponse.json({ ok: true });
}
