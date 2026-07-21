import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
  const { id } = await params;

  const [roomRows] = await db.execute(
    `SELECT r.id, r.status, r.current_round, r.current_drawer_id, r.round_started_at, r.created_by,
       h.first_name as host_first_name, h.username as host_username
     FROM game_rooms r JOIN users h ON h.id = r.created_by
     WHERE r.id = ?`,
    [id]
  ) as any[];
  const room = (roomRows as any[])[0];
  if (!room) return NextResponse.json({ message: 'Room not found' }, { status: 404 });

  const [playerRows] = await db.execute(
    `SELECT gp.user_id, gp.status, gp.score, u.username, u.first_name, u.profile_picture
     FROM game_room_players gp JOIN users u ON u.id = gp.user_id
     WHERE gp.room_id = ?
     ORDER BY gp.score DESC, gp.id ASC`,
    [id]
  ) as any[];

  const me = (playerRows as any[]).find(p => p.user_id === session.id);
  if (!me) return NextResponse.json({ message: 'Not a member of this room' }, { status: 403 });

  // The secret word is only ever included for the current drawer.
  const isDrawer = room.current_drawer_id === session.id;
  let word: string | null = null;
  if (isDrawer) {
    const [wordRows] = await db.execute('SELECT current_word FROM game_rooms WHERE id = ?', [id]) as any[];
    word = (wordRows as any[])[0]?.current_word ?? null;
  }

  return NextResponse.json({
    id: room.id,
    status: room.status,
    current_round: room.current_round,
    current_drawer_id: room.current_drawer_id,
    round_started_at: room.round_started_at,
    host_id: room.created_by,
    host_first_name: room.host_first_name,
    host_username: room.host_username,
    players: playerRows,
    my_status: me.status,
    is_drawer: isDrawer,
    word,
  });
}
