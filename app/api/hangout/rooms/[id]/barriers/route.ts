import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { ROOM_W, ROOM_H, MAX_BARRIERS_PER_ROOM } from '@/app/lib/hangout-objects';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [rows] = await db.execute(
    'SELECT id, x, y FROM hangout_room_barriers WHERE room_id = ?',
    [id]
  ) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM hangout_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can mark blocked areas' }, { status: 403 });
  }

  const { x, y } = await request.json();
  if (!Number.isInteger(x) || !Number.isInteger(y) || x < 0 || y < 0 || x > ROOM_W || y > ROOM_H) {
    return NextResponse.json({ message: 'Invalid position' }, { status: 400 });
  }

  const [countRows] = await db.execute(
    'SELECT COUNT(*) as c FROM hangout_room_barriers WHERE room_id = ?',
    [roomId]
  ) as any[];
  if ((countRows as any[])[0].c >= MAX_BARRIERS_PER_ROOM) {
    return NextResponse.json({ message: `You can only mark up to ${MAX_BARRIERS_PER_ROOM} spots per room` }, { status: 400 });
  }

  const [result] = await db.execute(
    'INSERT INTO hangout_room_barriers (room_id, x, y, placed_by) VALUES (?, ?, ?, ?)',
    [roomId, x, y, session.id]
  ) as any[];
  const barrierId = (result as any).insertId;

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:barrier_placed', { id: barrierId, x, y });

  return NextResponse.json({ id: barrierId }, { status: 201 });
}
