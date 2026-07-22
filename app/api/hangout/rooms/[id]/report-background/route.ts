import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [memberRows] = await db.execute(
    'SELECT id FROM hangout_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, session.id]
  ) as any[];
  if ((memberRows as any[]).length === 0) {
    return NextResponse.json({ message: 'You are not in this room' }, { status: 403 });
  }

  const [roomRows] = await db.execute(
    'SELECT background_url, background_status FROM hangout_rooms WHERE id = ?',
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (!room.background_url || room.background_status === 'reported') {
    return NextResponse.json({ message: 'Nothing to report' }, { status: 400 });
  }

  await db.execute('UPDATE hangout_rooms SET background_status = "reported" WHERE id = ?', [roomId]);
  await db.execute(
    'INSERT INTO hangout_background_reports (room_id, reported_url, reported_by) VALUES (?, ?, ?)',
    [roomId, room.background_url, session.id]
  );

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:background_updated', { url: null });

  return NextResponse.json({ ok: true });
}
