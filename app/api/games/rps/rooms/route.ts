import { NextResponse } from 'next/server';
import db from '@/app/lib/db';
import { getSession } from '@/app/lib/auth';

export async function GET() {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const [rows] = await db.execute(
    `SELECT r.id, r.status, r.created_at,
       h.username as host_username, h.first_name as host_first_name,
       gp.status as my_status,
       (SELECT COUNT(*) FROM rps_room_players WHERE room_id = r.id AND status = 'joined') as player_count
     FROM rps_room_players gp
     JOIN rps_rooms r ON r.id = gp.room_id
     JOIN users h ON h.id = r.created_by
     WHERE gp.user_id = ? AND (r.expires_at IS NULL OR r.expires_at > NOW())
     ORDER BY r.created_at DESC`,
    [session.id]
  ) as any[];

  return NextResponse.json(rows);
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });

  const { invite_user_id } = await request.json();
  const inviteeId = Number(invite_user_id);
  if (!Number.isInteger(inviteeId) || inviteeId === session.id) {
    return NextResponse.json({ message: 'Pick a friend to challenge' }, { status: 400 });
  }

  // Mutual follows only — same gate as the other games.
  const [mutualRows] = await db.execute(
    `SELECT u.id FROM users u
     JOIN follows f1 ON f1.follower_id = ? AND f1.following_id = u.id
     JOIN follows f2 ON f2.follower_id = u.id AND f2.following_id = ?
     WHERE u.id = ?`,
    [session.id, session.id, inviteeId]
  ) as any[];
  if ((mutualRows as any[]).length === 0) {
    return NextResponse.json({ message: 'You can only challenge friends who follow you back' }, { status: 403 });
  }

  const [result] = await db.execute(
    'INSERT INTO rps_rooms (created_by) VALUES (?)',
    [session.id]
  ) as any[];
  const roomId = (result as any).insertId;

  await db.execute(
    'INSERT INTO rps_room_players (room_id, user_id, status, joined_at) VALUES (?, ?, "joined", NOW())',
    [roomId, session.id]
  );
  await db.execute(
    'INSERT INTO rps_room_players (room_id, user_id, status) VALUES (?, ?, "invited")',
    [roomId, inviteeId]
  );
  await db.execute(
    'INSERT INTO notifications (user_id, actor_id, type, message_preview) VALUES (?, ?, "rps_invite", ?)',
    [inviteeId, session.id, String(roomId)]
  );

  return NextResponse.json({ id: roomId }, { status: 201 });
}
