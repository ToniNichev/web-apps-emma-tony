import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; objectId: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id, objectId } = await params;
  const roomId = Number(id);

  const [memberRows] = await db.execute(
    'SELECT id FROM hangout_room_players WHERE room_id = ? AND user_id = ? AND status = "joined"',
    [roomId, session.id]
  ) as any[];
  if ((memberRows as any[]).length === 0) {
    return NextResponse.json({ message: 'You are not in this room' }, { status: 403 });
  }

  const [result] = await db.execute(
    'DELETE FROM hangout_room_objects WHERE id = ? AND room_id = ?',
    [objectId, roomId]
  ) as any[];
  if ((result as any).affectedRows === 0) {
    return NextResponse.json({ message: 'Object not found' }, { status: 404 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:object_removed', { id: Number(objectId) });

  return NextResponse.json({ ok: true });
}
