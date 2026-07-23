import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.background_url, r.background_status, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM hangout_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [id]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, u.username, u.first_name, u.profile_picture,
       u.avatar_emoji, u.avatar_color, u.avatar_accessory
     FROM hangout_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.id ASC`,
    [id]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) return NextResponse.json({ message: 'Not a member of this room' }, { status: 403 });

  const [objectRows] = await db.execute(
    'SELECT id, object_type, x, y, placed_by FROM hangout_room_objects WHERE room_id = ?',
    [id]
  ) as any[];

  const [barrierRows] = await db.execute(
    'SELECT id, x, y FROM hangout_room_barriers WHERE room_id = ?',
    [id]
  ) as any[];

  // A reported background is never served, even to the host — falls back to
  // the built-in default until an admin clears or restores it.
  const effectiveBackgroundUrl = room.background_status === 'reported' ? null : room.background_url;

  return NextResponse.json({
    id: room.id,
    host_id: room.created_by,
    host_first_name: room.host_first_name,
    host_username: room.host_username,
    background_url: effectiveBackgroundUrl,
    background_status: room.background_status,
    players: playerRows,
    objects: objectRows,
    barriers: barrierRows,
    my_status: me.status,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM hangout_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can delete this room' }, { status: 403 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`hangout:${roomId}`).emit('hangout:room_deleted');

  // Cascades to players/objects/barriers/reports via their FK constraints.
  await db.execute('DELETE FROM hangout_rooms WHERE id = ?', [roomId]);

  return NextResponse.json({ ok: true });
}
