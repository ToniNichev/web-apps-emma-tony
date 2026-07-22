import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { HANGOUT_OBJECT_TYPES, ROOM_W, ROOM_H } from '@/app/lib/hangout-objects';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [rows] = await db.execute(
    'SELECT id, object_type, x, y, placed_by FROM hangout_room_objects WHERE room_id = ?',
    [id]
  ) as any[];

  return NextResponse.json(rows);
}

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

  const { object_type, x, y } = await request.json();
  if (!HANGOUT_OBJECT_TYPES.includes(object_type)) {
    return NextResponse.json({ message: 'Unknown decoration' }, { status: 400 });
  }
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > ROOM_W || y > ROOM_H) {
    return NextResponse.json({ message: 'Invalid position' }, { status: 400 });
  }

  const [result] = await db.execute(
    'INSERT INTO hangout_room_objects (room_id, object_type, x, y, placed_by) VALUES (?, ?, ?, ?, ?)',
    [roomId, object_type, x, y, session.id]
  ) as any[];
  const objectId = (result as any).insertId;

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:object_placed', {
    id: objectId, object_type, x, y, placed_by: session.id,
  });

  return NextResponse.json({ id: objectId }, { status: 201 });
}
