import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; barrierId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id, barrierId } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM hangout_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can remove blocked areas' }, { status: 403 });
  }

  const [result] = await db.execute(
    'DELETE FROM hangout_room_barriers WHERE id = ? AND room_id = ?',
    [barrierId, roomId]
  ) as any[];
  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'Barrier not found' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:barrier_removed', { id: Number(barrierId) });

  return NextResponse.json({ ok: true });
}
