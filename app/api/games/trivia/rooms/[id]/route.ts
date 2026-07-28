import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';
import { getRoundSnapshot, clearRoomState } from '@/app/lib/trivia-game';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute(
    `SELECT r.id, r.status, r.category, r.current_round, r.total_rounds, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM trivia_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [roomId]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, gp.score, u.username, u.first_name, u.profile_picture
     FROM trivia_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.id ASC`,
    [roomId]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) return NextResponse.json({ message: 'Not a member of this room' }, { status: 403 });

  // A client that just joined (or reconnected) mid-round gets replayed the
  // question in progress instead of seeing nothing until the next round.
  const currentRound = room.status === 'active' ? getRoundSnapshot(roomId, session.id) : null;

  return NextResponse.json({
    id: room.id,
    status: room.status,
    category: room.category,
    current_round: room.current_round,
    total_rounds: room.total_rounds,
    host_id: room.created_by,
    host_first_name: room.host_first_name,
    host_username: room.host_username,
    players: playerRows,
    my_status: me.status,
    current_round_snapshot: currentRound,
  });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;
  const roomId = Number(id);

  const [roomRows] = await db.execute('SELECT created_by FROM trivia_rooms WHERE id = ?', [roomId]) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });
  if (room.created_by !== session.id) {
    return NextResponse.json({ message: 'Only the host can delete this room' }, { status: 403 });
  }

  const io = (globalThis as unknown as { __gameIO?: any }).__gameIO;
  io?.to(`trivia:${roomId}`).emit('trivia:room_deleted');

  clearRoomState(roomId);
  await db.execute('DELETE FROM trivia_rooms WHERE id = ?', [roomId]);

  return NextResponse.json({ ok: true });
}
