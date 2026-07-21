import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

const MAX_INVITEES = 5; // + host = 6 players max

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    `SELECT r.id, r.status, r.current_round, r.created_at,
       h.username as host_username, h.first_name as host_first_name,
       gp.status as my_status,
       (SELECT COUNT(*) FROM game_room_players WHERE room_id = r.id AND status = 'joined') as player_count
     FROM game_room_players gp
     JOIN game_rooms r ON r.id = gp.room_id
     JOIN users h ON h.id = r.created_by
     WHERE gp.user_id = ?
     ORDER BY r.created_at DESC`,
    [session.id]
  ) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { invite_user_ids } = await request.json();
  const inviteeIds: number[] = Array.isArray(invite_user_ids)
    ? [...new Set(invite_user_ids.map(Number).filter(Number.isInteger))].filter(id => id !== session.id)
    : [];

  if (inviteeIds.length === 0) {
    return NextResponse.json({ message: 'Invite at least one friend' }, { status: 400 });
  }
  if (inviteeIds.length > MAX_INVITEES) {
    return NextResponse.json({ message: `You can invite up to ${MAX_INVITEES} friends` }, { status: 400 });
  }

  // Mutual follows only — same gate as the Kindness Wall.
  const [mutualRows] = await db.execute(
    `SELECT u.id FROM users u
     JOIN follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
     WHERE u.id IN (${inviteeIds.map(() => '?').join(',')})`,
    [session.id, session.id, ...inviteeIds]
  ) as any[];
  const mutualIds = new Set((mutualRows as any[]).map(r => r.id));
  const invalid = inviteeIds.filter(id => !mutualIds.has(id));
  if (invalid.length > 0) {
    return NextResponse.json({ message: 'You can only invite friends who follow you back' }, { status: 403 });
  }

  const [result] = await db.execute(
    'INSERT INTO game_rooms (created_by, status) VALUES (?, "lobby")',
    [session.id]
  ) as any[];
  const roomId = (result as any).insertId;

  await db.execute(
    'INSERT INTO game_room_players (room_id, user_id, status, joined_at) VALUES (?, ?, "joined", NOW())',
    [roomId, session.id]
  );

  for (const inviteeId of inviteeIds) {
    await db.execute(
      'INSERT INTO game_room_players (room_id, user_id, status) VALUES (?, ?, "invited")',
      [roomId, inviteeId]
    );
    await db.execute(
      'INSERT INTO notifications (user_id, actor_id, type, message_preview) VALUES (?, ?, "game_invite", ?)',
      [inviteeId, session.id, String(roomId)]
    );
  }

  return NextResponse.json({ id: roomId }, { status: 201 });
}
